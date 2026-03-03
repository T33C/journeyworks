/**
 * Agent Executor Service
 *
 * Implements the ReAct (Reasoning and Acting) agent loop.
 * The agent thinks, decides on an action, observes the result, and repeats.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LlmClientService,
  PromptTemplateService,
} from '../../infrastructure/llm';
import { AgentTools } from './agent-tools.service';
import { SkillManagerService } from './skill-manager.service';
import {
  ResearchRequest,
  ResearchResponse,
  ResearchSource,
  ReasoningStep,
  AgentAction,
  AgentState,
  StreamEventCallback,
  InsightChart,
} from './research.types';

/** Agent configuration constants */
const AGENT_CONFIG = {
  /** Default maximum iterations for the agent loop */
  DEFAULT_MAX_ITERATIONS: 10,
  /** Minimum characters for follow-up question */
  MIN_FOLLOWUP_LENGTH: 10,
  /** Timeout for LLM calls in milliseconds (90 seconds) */
  LLM_TIMEOUT_MS: 90_000,
  /** Maximum number of follow-up questions */
  MAX_FOLLOWUP_COUNT: 3,
  /** Maximum characters for final answer summary in follow-up generation */
  MAX_SUMMARY_LENGTH: 500,
  /** Minimum iterations before allowing Final Answer without tool calls (safety valve) */
  MIN_TOOL_FORCE_ITERATIONS: 5,
  /** Maximum number of parallel tool calls per iteration */
  MAX_PARALLEL_ACTIONS: 5,
  /** Maximum retries for a timed-out iteration */
  MAX_TIMEOUT_RETRIES: 1,
  /** Timeout for first-turn repair prompt in milliseconds */
  FIRST_TURN_REPAIR_TIMEOUT_MS: 25_000,
} as const;

/** Confidence calculation weights */
const CONFIDENCE_WEIGHTS = {
  /** Base confidence score */
  BASE: 0.5,
  /** Bonus per unique source found */
  SOURCE_BONUS: 0.05,
  /** Maximum source bonus cap */
  MAX_SOURCE_BONUS: 0.2,
  /** Penalty for each failed tool call */
  FAILURE_PENALTY: 0.1,
  /** Penalty for hitting max iterations without answer */
  MAX_ITERATION_PENALTY: 0.2,
  /** Bonus for completing within few iterations */
  EFFICIENCY_BONUS: 0.1,
  /** Bonus for having a final answer */
  FINAL_ANSWER_BONUS: 0.1,
} as const;

/** Error types for agent execution */
export class AgentExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AgentExecutionError';
  }
}

export class ToolValidationError extends AgentExecutionError {
  constructor(
    toolName: string,
    message: string,
    public readonly validationErrors: string[],
  ) {
    super(
      `Tool validation failed for ${toolName}: ${message}`,
      'TOOL_VALIDATION_ERROR',
      {
        toolName,
        validationErrors,
      },
    );
    this.name = 'ToolValidationError';
  }
}

@Injectable()
export class AgentExecutor {
  private readonly logger = new Logger(AgentExecutor.name);
  private readonly defaultMaxIterations: number;
  private readonly modelName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly llmClient: LlmClientService,
    private readonly promptTemplate: PromptTemplateService,
    private readonly tools: AgentTools,
    private readonly skillManager: SkillManagerService,
  ) {
    this.defaultMaxIterations =
      this.configService.get<number>('agent.maxIterations') ||
      AGENT_CONFIG.DEFAULT_MAX_ITERATIONS;
    this.modelName =
      this.configService.get<string>('llm.anthropic.model') ||
      'claude-sonnet-4-20250514';
  }

  /**
   * Execute the research agent
   */
  async execute(request: ResearchRequest): Promise<ResearchResponse> {
    const startTime = Date.now();
    const maxIterations = request.maxIterations || this.defaultMaxIterations;

    // Initialize agent state
    const state: AgentState = {
      iteration: 0,
      maxIterations,
      steps: [],
      actions: [],
      sources: [],
      isDone: false,
      _reactMetrics: {
        firstTurnInvalid: 0,
        firstTurnRepairSuccess: 0,
        firstTurnRepairFailed: 0,
      },
    };

    this.logger.log(`Starting agent execution for query: "${request.query}"`);

    // Main agent loop
    while (!state.isDone && state.iteration < maxIterations) {
      state.iteration++;
      this.logger.debug(`Agent iteration ${state.iteration}/${maxIterations}`);

      try {
        // Run one iteration of the agent
        await this.runIteration(request, state);
      } catch (error) {
        const isTimeout = /timed? ?out/i.test(error.message);

        // Retry once on timeout before giving up
        if (isTimeout && !state._timeoutRetried) {
          state._timeoutRetried = true;
          this.logger.warn(
            `Iteration ${state.iteration} timed out — retrying once`,
          );
          state.iteration--;
          continue;
        }

        this.logger.error(`Agent iteration failed: ${error.message}`);
        state.error = error.message;
        state.isDone = true;
        break;
      }
    }

    // Synthesize an answer from tool results when the agent couldn't
    // produce one itself (timeout, max-iterations, or parse failure)
    if (!state.finalAnswer && state.actions.some((a) => a.success)) {
      this.logger.log(
        'No final answer from agent loop — synthesizing from tool results',
      );
      try {
        state.finalAnswer = await this.synthesizeFinalAnswer(request, state);
      } catch (synthesisError) {
        this.logger.error(
          `Synthesis fallback also failed: ${synthesisError.message}`,
        );
        // Fall through — the generic "unable to find" message will be used
      }
    }

    const totalTime = Date.now() - startTime;

    this.logReactMetrics(state, false);

    // Generate follow-up questions (async) while computing sync fields below
    const followUpQuestions = await this.generateFollowUpQuestions(
      request,
      state,
    );

    return {
      answer:
        state.finalAnswer || 'I was unable to find a satisfactory answer.',
      confidence: this.calculateConfidence(state),
      sources: this.deduplicateSources(state.sources),
      charts: this.extractChartsFromActions(state),
      reasoning: state.steps,
      actions: state.actions,
      followUpQuestions,
      stats: {
        totalTime,
        iterations: state.iteration,
        toolCalls: state.actions.length,
        model: this.modelName,
      },
    };
  }

  /**
   * Execute the research agent with streaming events.
   * Emits progress events via the callback as the agent works through
   * the ReAct loop, enabling real-time UI updates via WebSocket.
   */
  async executeStreaming(
    request: ResearchRequest,
    sessionId: string,
    onEvent: StreamEventCallback,
  ): Promise<ResearchResponse> {
    const startTime = Date.now();
    const maxIterations = request.maxIterations || this.defaultMaxIterations;
    const timestamp = () => new Date().toISOString();

    // Initialize agent state
    const state: AgentState = {
      iteration: 0,
      maxIterations,
      steps: [],
      actions: [],
      sources: [],
      isDone: false,
      _reactMetrics: {
        firstTurnInvalid: 0,
        firstTurnRepairSuccess: 0,
        firstTurnRepairFailed: 0,
      },
    };

    this.logger.log(
      `Starting streaming agent execution for query: "${request.query}"`,
    );

    // Main agent loop
    while (!state.isDone && state.iteration < maxIterations) {
      state.iteration++;
      this.logger.debug(
        `[Streaming] Agent iteration ${state.iteration}/${maxIterations}`,
      );

      // Emit thinking event
      onEvent({
        type: 'thinking',
        timestamp: timestamp(),
        sessionId,
        iteration: state.iteration,
        maxIterations,
      });

      try {
        await this.runStreamingIteration(request, state, sessionId, onEvent);
      } catch (error) {
        const isTimeout = /timed? ?out/i.test(error.message);

        // Retry once on timeout before giving up
        if (isTimeout && !state._timeoutRetried) {
          state._timeoutRetried = true;
          this.logger.warn(
            `[Streaming] Iteration ${state.iteration} timed out — retrying once`,
          );
          // Don't increment iteration count for the retry
          state.iteration--;
          continue;
        }

        this.logger.error(
          `[Streaming] Agent iteration failed: ${error.message}`,
        );
        state.error = error.message;
        state.isDone = true;

        // Only emit error to the client when we have no successful tool
        // results to fall back on. When results exist, the post-loop
        // synthesis will attempt to produce an answer instead.
        if (!state.actions.some((a) => a.success)) {
          onEvent({
            type: 'error',
            timestamp: timestamp(),
            sessionId,
            message: error.message,
            code: error instanceof AgentExecutionError ? error.code : 'UNKNOWN',
          });
        } else {
          this.logger.log(
            `[Streaming] Suppressing error event — ${state.actions.filter((a) => a.success).length} successful tool result(s) available for synthesis`,
          );
        }
        break;
      }
    }

    // Synthesize an answer from tool results when the agent couldn't
    // produce one itself (timeout, max-iterations, or parse failure)
    if (!state.finalAnswer && state.actions.some((a) => a.success)) {
      this.logger.log(
        '[Streaming] No final answer from agent loop — synthesizing from tool results',
      );
      onEvent({
        type: 'thinking',
        timestamp: timestamp(),
        sessionId,
        iteration: state.iteration,
        maxIterations,
      });
      try {
        state.finalAnswer = await this.synthesizeFinalAnswer(request, state);
      } catch (synthesisError) {
        this.logger.error(
          `[Streaming] Synthesis fallback also failed: ${synthesisError.message}`,
        );
        onEvent({
          type: 'error',
          timestamp: timestamp(),
          sessionId,
          message: `Synthesis failed: ${synthesisError.message}`,
          code: 'SYNTHESIS_TIMEOUT',
        });
        // Fall through — the generic "unable to find" message will be used
      }
    }

    const totalTime = Date.now() - startTime;

    this.logReactMetrics(state, true);

    // Generate follow-up questions (async) while computing sync fields below
    const followUpQuestions = await this.generateFollowUpQuestions(
      request,
      state,
    );

    const response: ResearchResponse = {
      answer:
        state.finalAnswer || 'I was unable to find a satisfactory answer.',
      confidence: this.calculateConfidence(state),
      sources: this.deduplicateSources(state.sources),
      charts: this.extractChartsFromActions(state),
      reasoning: state.steps,
      actions: state.actions,
      followUpQuestions,
      stats: {
        totalTime,
        iterations: state.iteration,
        toolCalls: state.actions.length,
        model: this.modelName,
      },
    };

    // Emit complete event
    onEvent({
      type: 'complete',
      timestamp: timestamp(),
      sessionId,
      response,
    });

    return response;
  }

  /**
   * Run a single streaming iteration of the agent loop.
   * Emits reasoning-step, tool-call, and tool-result events.
   * Supports parallel execution when the LLM outputs multiple Action blocks.
   */
  private async runStreamingIteration(
    request: ResearchRequest,
    state: AgentState,
    sessionId: string,
    onEvent: StreamEventCallback,
  ): Promise<void> {
    const timestamp = () => new Date().toISOString();

    // Build the prompt with scratchpad
    const prompt = this.buildPrompt(request, state);
    this.logger.debug(
      `[Streaming] Prompt size: ${prompt.length} chars (~${Math.round(prompt.length / 4)} tokens)`,
    );

    // Get the agent's response
    const response = await this.promptWithTimeout(
      prompt,
      this.promptTemplate.getTemplate('system:researcher'),
      { rateLimitKey: 'llm:agent' },
    );

    // Parse the response (may contain multiple actions)
    const preferActionOverFinal = this.shouldUseActionOnlyFirstTurnPrompt(
      request,
      state,
    );
    let parsed = this.parseAgentResponse(response, {
      preferActionWhenFinalAlsoPresent: preferActionOverFinal,
    });

    parsed = await this.repairFirstTurnResponseIfNeeded(
      request,
      state,
      response,
      parsed,
      true,
    );

    const firstAction = parsed.actions[0];

    // Create the reasoning step (include the full LLM prompt for transparency)
    const step: ReasoningStep = {
      step: state.iteration,
      thought: parsed.thought,
      action: firstAction?.action,
      actionInput: firstAction?.actionInput,
      parallelActions: parsed.actions.length > 1 ? parsed.actions : undefined,
      llmPrompt: prompt,
    };

    // Check for final answer
    if (firstAction?.action === 'Final Answer' || parsed.finalAnswer) {
      // Log if the LLM also included tool actions alongside Final Answer
      if (parsed.actions.length > 1) {
        const droppedTools = parsed.actions
          .filter((a) => a.action !== 'Final Answer')
          .map((a) => a.action);
        if (droppedTools.length > 0) {
          this.logger.warn(
            `[Streaming] Iteration ${state.iteration}: Dropping ${droppedTools.length} tool call(s) (${droppedTools.join(', ')}) because Final Answer was also present`,
          );
        }
      }
      const isMeta = this.isMetaQuestion(request.query);
      if (
        state.actions.length === 0 &&
        state.iteration < AGENT_CONFIG.MIN_TOOL_FORCE_ITERATIONS &&
        !isMeta
      ) {
        this.logger.warn(
          `[Streaming] Iteration ${state.iteration}: Agent attempted Final Answer without calling any tools - forcing tool use`,
        );
        const suggestedTool = this.suggestToolForQuery(request.query);
        step.thought = `${parsed.thought}\n\n[System: REJECTED - You MUST call at least one tool before providing a Final Answer. Do NOT fabricate data. ${suggestedTool}]`;
        step.action = undefined;
        step.observation = `SYSTEM OVERRIDE: Final Answer rejected because no tools have been called yet (iteration ${state.iteration}). You MUST output an Action with a tool call on your next response.`;
        state.steps.push(step);

        // Emit the rejected reasoning step
        onEvent({
          type: 'reasoning-step',
          timestamp: timestamp(),
          sessionId,
          step,
        });
        return;
      } else {
        if (state.actions.length === 0) {
          this.logger.warn(
            `[Streaming] Iteration ${state.iteration}: Allowing Final Answer without tool calls (safety valve)`,
          );
        }
        state.isDone = true;
        state.finalAnswer = parsed.finalAnswer || firstAction?.actionInput;
        state.steps.push(step);

        // Emit the final reasoning step
        onEvent({
          type: 'reasoning-step',
          timestamp: timestamp(),
          sessionId,
          step,
        });
        return;
      }
    }

    // Guard: no action parsed
    if (parsed.actions.length === 0) {
      this.logger.warn(
        `[Streaming] Iteration ${state.iteration}: No parseable Action - redirecting`,
      );
      const suggestedTool = this.suggestToolForQuery(request.query);
      step.observation = `SYSTEM: Your response did not contain a valid Action. You must respond in the exact format:\nThought: [your reasoning]\nAction: {"tool": "tool_name", "input": {"param": "value"}}\n\n${suggestedTool}`;
      state.steps.push(step);

      onEvent({
        type: 'reasoning-step',
        timestamp: timestamp(),
        sessionId,
        step,
      });
      return;
    }

    // Emit reasoning step (before tool calls)
    onEvent({
      type: 'reasoning-step',
      timestamp: timestamp(),
      sessionId,
      step: { ...step }, // snapshot before observation is added
    });

    // Emit tool-call events for all actions
    for (const pa of parsed.actions) {
      onEvent({
        type: 'tool-call',
        timestamp: timestamp(),
        sessionId,
        tool: pa.action,
        input: pa.actionInput,
        iteration: state.iteration,
      });
    }

    // Cap parallel actions to prevent runaway tool calls
    let actionsToRun = parsed.actions;
    if (actionsToRun.length > AGENT_CONFIG.MAX_PARALLEL_ACTIONS) {
      this.logger.warn(
        `[Streaming] Capping parallel actions from ${actionsToRun.length} to ${AGENT_CONFIG.MAX_PARALLEL_ACTIONS}`,
      );
      actionsToRun = actionsToRun.slice(0, AGENT_CONFIG.MAX_PARALLEL_ACTIONS);
    }

    // Execute actions in parallel
    const isParallel = actionsToRun.length > 1;
    if (isParallel) {
      this.logger.log(
        `[Streaming] Executing ${actionsToRun.length} tools in parallel: ${actionsToRun.map((a) => a.action).join(', ')}`,
      );
    }

    const results = await Promise.all(
      actionsToRun.map(async (pa) => {
        const actionStart = Date.now();
        let output: any;
        let success = true;
        let error: string | undefined;
        let sources: any[] = [];

        try {
          const result = await this.tools.executeTool(
            pa.action,
            pa.actionInput,
          );
          output = result.output;
          sources = result.sources;
        } catch (e) {
          success = false;
          error = e.message;
          output = { error: e.message };
        }

        return {
          pa,
          output,
          success,
          error,
          sources,
          duration: Date.now() - actionStart,
        };
      }),
    );

    // Record actions and build combined observation
    // (sources collected here to avoid concurrent array mutation)
    const observations: string[] = [];
    for (const r of results) {
      state.sources.push(...r.sources);

      const actionRecord: AgentAction = {
        tool: r.pa.action,
        input: r.pa.actionInput,
        output: r.output,
        duration: r.duration,
        success: r.success,
        error: r.error,
      };
      state.actions.push(actionRecord);

      const obs = this.tools.formatToolObservation(r.pa.action, r.output);
      observations.push(isParallel ? `[${r.pa.action}] ${obs}` : obs);

      // Emit tool-result event for each action
      onEvent({
        type: 'tool-result',
        timestamp: timestamp(),
        sessionId,
        tool: r.pa.action,
        success: r.success,
        duration: r.duration,
        outputSummary: this.summarizeToolOutput(r.output),
        error: r.error,
      });
    }

    step.observation = observations.join('\n\n');
    state.steps.push(step);
  }

  /**
   * Summarize tool output for streaming (brief, for UI display)
   */
  private summarizeToolOutput(output: any): string {
    if (!output) return 'No output';
    if (typeof output === 'string') return output.substring(0, 200);
    if (output.error) return `Error: ${output.error}`;

    // Summarize based on common output patterns
    const keys = Object.keys(output);
    const parts: string[] = [];

    if (output.totalResults !== undefined) {
      parts.push(`${output.totalResults} results found`);
    }
    if (output.answer) {
      parts.push(output.answer.substring(0, 100));
    }
    if (output.results?.length !== undefined) {
      parts.push(`${output.results.length} items`);
    }
    if (output.sentimentBreakdown) {
      const b = output.sentimentBreakdown;
      parts.push(
        `Sentiment: +${b.positive || 0} =${b.neutral || 0} -${b.negative || 0}`,
      );
    }
    if (output.daily?.length) {
      parts.push(`${output.daily.length} days of data`);
    }

    return parts.length > 0
      ? parts.join(' | ')
      : `Returned ${keys.length} field(s)`;
  }

  // Theme colors from chart.config.ts
  private static readonly CATEGORICAL_COLORS = [
    '#1494C6', // DATA_VIS.blue[3]
    '#F14E73', // DATA_VIS.pink[3]
    '#ED500D', // DATA_VIS.orange[3]
    '#4DA90F', // DATA_VIS.green[3]
    '#266076', // DATA_VIS.blue[1]
    '#C03954', // DATA_VIS.pink[2]
  ];

  private static readonly RAG_COLORS = {
    green: '#00847F',
    amber: '#FFBB33',
    red: '#A8000B',
  };

  /**
   * Extract chart data from successful tool actions
   * Only generates charts when relevant tools provide aggregation data
   */
  private extractChartsFromActions(state: AgentState): InsightChart[] {
    const charts: (InsightChart | null)[] = [];

    this.logger.debug(`Extracting charts from ${state.actions.length} actions`);

    for (const action of state.actions) {
      this.logger.debug(
        `Chart check - Tool: ${action.tool}, Success: ${action.success}, Output keys: ${action.output ? Object.keys(action.output).join(', ') : 'null'}`,
      );
      if (!action.success || !action.output) continue;

      const output = action.output;
      this.logger.debug(
        `Processing tool: ${action.tool}, output keys: ${Object.keys(output).join(', ')}`,
      );

      // Category breakdown → Bar chart
      if (
        action.tool === 'get_category_breakdown' &&
        output.byCategory?.length
      ) {
        this.logger.debug(
          `Building bar chart from get_category_breakdown: ${output.byCategory.length} categories`,
        );
        charts.push(
          this.buildBarChart(
            'Categories Breakdown',
            output.byCategory.map((item: any) => ({
              label: item.category,
              value: item.count,
            })),
          ),
        );
      }

      // query_data tool returns aggregations in a different format
      if (action.tool === 'query_data' && output.aggregations) {
        const aggs = output.aggregations;
        // Handle terms aggregations (e.g., by_category, by_channel)
        for (const [aggName, aggData] of Object.entries(aggs)) {
          if (
            Array.isArray(aggData) &&
            aggData.length > 0 &&
            'key' in aggData[0]
          ) {
            this.logger.debug(
              `Building bar chart from query_data aggregation: ${aggName}`,
            );
            charts.push(
              this.buildBarChart(
                this.formatAggTitle(aggName),
                aggData.slice(0, 10).map((item: any) => ({
                  label: item.key,
                  value: item.doc_count || item.count || item.value,
                })),
              ),
            );
          }
        }
      }

      // CDD cases analysis → Bar chart for reasons, Pie for status
      if (action.tool === 'analyze_cdd_cases') {
        this.logger.debug(
          `analyze_cdd_cases - byReason: ${output.byReason?.length ?? 0}, byStatus: ${output.byStatus?.length ?? 0}`,
        );
        if (output.byReason?.length) {
          const chartData = output.byReason.map((item: any) => ({
            label: item.reason,
            value: item.count,
          }));
          charts.push(this.buildBarChart('Cases by Reason', chartData));
        }
        if (output.byStatus?.length) {
          charts.push(
            this.buildStatusPieChart(
              'Case Status Distribution',
              output.byStatus.map((item: any) => ({
                label: item.status,
                value: item.count,
              })),
            ),
          );
        }
      }

      // SLA compliance → Pie chart
      if (
        action.tool === 'analyze_sla_compliance' &&
        output.breachedCount !== undefined
      ) {
        charts.push(
          this.buildPieChart('SLA Compliance', [
            {
              label: 'Compliant',
              value: output.compliantCount || 0,
              color: AgentExecutor.RAG_COLORS.green,
            },
            {
              label: 'Breached',
              value: output.breachedCount || 0,
              color: AgentExecutor.RAG_COLORS.red,
            },
          ]),
        );
      }

      // Sentiment analysis → Pie chart
      if (action.tool === 'analyze_sentiment' && output.sentimentBreakdown) {
        const breakdown = output.sentimentBreakdown;
        charts.push(
          this.buildPieChart('Sentiment Distribution', [
            {
              label: 'Positive',
              value: breakdown.positive || 0,
              color: AgentExecutor.RAG_COLORS.green,
            },
            {
              label: 'Neutral',
              value: breakdown.neutral || 0,
              color: AgentExecutor.RAG_COLORS.amber,
            },
            {
              label: 'Negative',
              value: breakdown.negative || 0,
              color: AgentExecutor.RAG_COLORS.red,
            },
          ]),
        );
      }

      // Daily volumes → Time-series chart
      if (action.tool === 'get_daily_volumes' && output.daily?.length) {
        charts.push(
          this.buildTimeSeriesChart(
            'Daily Volume Trend',
            output.daily,
            'Date',
            'Volume',
          ),
        );
      }

      // Trend analysis with daily data
      if (action.tool === 'analyze_trends' && output.dailyVolume?.length) {
        charts.push(
          this.buildTimeSeriesChart(
            'Volume Trend',
            output.dailyVolume,
            'Date',
            'Volume',
          ),
        );
      }

      // Anomaly detection → Bar chart of anomaly severity
      if (action.tool === 'detect_anomalies' && output.anomalies?.length) {
        const byField: Record<string, number> = {};
        for (const a of output.anomalies) {
          const key = `${a.field} (${a.severity})`;
          byField[key] = (byField[key] || 0) + 1;
        }
        charts.push(
          this.buildBarChart(
            'Detected Anomalies',
            Object.entries(byField).map(([label, value]) => ({
              label,
              value,
              color: label.includes('high')
                ? AgentExecutor.RAG_COLORS.red
                : AgentExecutor.RAG_COLORS.amber,
            })),
            'Anomaly Type',
            'Count',
          ),
        );
      }

      // Channel escalation → Time-series chart of daily escalations
      if (
        action.tool === 'analyze_channel_escalation' &&
        output.dailyBreakdown?.length
      ) {
        charts.push(
          this.buildTimeSeriesChart(
            'Channel Escalations Over Time',
            output.dailyBreakdown,
            'Date',
            'Escalations',
          ),
        );
      }

      // Topic analysis → Bar chart of top topics
      if (action.tool === 'analyze_topics') {
        this.logger.debug(
          `analyze_topics chart check — topTopics type: ${typeof output.topTopics}, length: ${output.topTopics?.length ?? 'N/A'}, sample: ${JSON.stringify(output.topTopics?.[0] ?? null)}`,
        );
        if (output.topTopics?.length) {
          charts.push(
            this.buildBarChart(
              'Top Topics',
              output.topTopics.slice(0, 8).map((t: any) => ({
                label: t.topic || t.name || t.key,
                value: t.count || t.doc_count || 0,
              })),
              'Topic',
              'Mentions',
            ),
          );
        }
      }

      // Resolution times → Bar chart of avg/min/max
      if (
        action.tool === 'analyze_resolution_times' &&
        output.avgResolutionDays !== undefined
      ) {
        charts.push(
          this.buildBarChart(
            'Resolution Times (Days)',
            [
              { label: 'Average', value: output.avgResolutionDays },
              { label: 'Minimum', value: output.minResolutionDays },
              { label: 'Maximum', value: output.maxResolutionDays },
            ],
            'Metric',
            'Days',
          ),
        );
      }

      // Issue detection → Pie chart of issues vs clean communications
      if (
        action.tool === 'detect_issues' &&
        output.totalCommunications !== undefined
      ) {
        const problematicCount = output.problematicCount || 0;
        const cleanCount = (output.totalCommunications || 0) - problematicCount;
        if (problematicCount > 0 || cleanCount > 0) {
          charts.push(
            this.buildPieChart('Issue Distribution', [
              {
                label: 'Problematic',
                value: problematicCount,
                color: AgentExecutor.RAG_COLORS.red,
              },
              {
                label: 'Clean',
                value: cleanCount > 0 ? cleanCount : 0,
                color: AgentExecutor.RAG_COLORS.green,
              },
            ]),
          );
        }
      }
    }

    // Filter out nulls (e.g. empty time-series) and limit to 3 charts
    const validCharts = charts.filter((c): c is InsightChart => c !== null);
    if (validCharts.length > 3) {
      this.logger.warn(
        `Built ${validCharts.length} charts but limiting to 3 — ${validCharts.length - 3} chart(s) dropped`,
      );
    }
    this.logger.debug(`Returning ${Math.min(validCharts.length, 3)} charts`);
    return validCharts.slice(0, 3);
  }

  /**
   * Format aggregation name to readable title
   */
  private formatAggTitle(aggName: string): string {
    // Convert snake_case or by_X to readable format
    return aggName
      .replace(/^by_/, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  /**
   * Build a bar chart from aggregation data
   */
  private buildBarChart(
    title: string,
    data: Array<{ label: string; value: number; color?: string }>,
    xLabel?: string,
    yLabel?: string,
  ): InsightChart {
    return {
      type: 'bar',
      title,
      xLabel: xLabel || 'Category',
      yLabel: yLabel || 'Count',
      data: data.slice(0, 6).map((item, index) => ({
        label: item.label,
        value: item.value,
        color:
          item.color ||
          AgentExecutor.CATEGORICAL_COLORS[
            index % AgentExecutor.CATEGORICAL_COLORS.length
          ],
      })),
    };
  }

  /**
   * Build a pie chart with explicit colors
   */
  private buildPieChart(
    title: string,
    data: Array<{ label: string; value: number; color: string }>,
  ): InsightChart {
    return {
      type: 'pie',
      title,
      data: data.filter((d) => d.value > 0), // Remove zero-value segments
    };
  }

  /**
   * Build a pie chart for status-type data (uses categorical colors)
   */
  private buildStatusPieChart(
    title: string,
    data: Array<{ label: string; value: number }>,
  ): InsightChart {
    return {
      type: 'pie',
      title,
      data: data
        .filter((d) => d.value > 0)
        .map((item, index) => ({
          label: item.label,
          value: item.value,
          color:
            AgentExecutor.CATEGORICAL_COLORS[
              index % AgentExecutor.CATEGORICAL_COLORS.length
            ],
        })),
    };
  }

  /**
   * Build a time-series chart from daily data
   */
  private buildTimeSeriesChart(
    title: string,
    dailyData: Array<{ date: string; count: number }>,
    xLabel?: string,
    yLabel?: string,
  ): InsightChart | null {
    const validData = dailyData.filter(
      (d) => d.date && !isNaN(new Date(d.date).getTime()),
    );
    if (validData.length === 0) return null;

    return {
      type: 'time-series',
      title,
      xLabel: xLabel || 'Date',
      yLabel: yLabel || 'Volume',
      data: validData.map((d) => ({
        label: new Date(d.date).toLocaleDateString('en-GB', {
          month: 'short',
          day: 'numeric',
        }),
        value: d.count,
        date: d.date,
        color: AgentExecutor.CATEGORICAL_COLORS[0],
      })),
    };
  }

  /**
   * Run a single iteration of the agent loop.
   * Supports parallel execution when the LLM outputs multiple Action blocks.
   */
  private async runIteration(
    request: ResearchRequest,
    state: AgentState,
  ): Promise<void> {
    // Build the prompt with scratchpad
    const prompt = this.buildPrompt(request, state);

    // Get the agent's response (with timeout to prevent hanging)
    const response = await this.promptWithTimeout(
      prompt,
      this.promptTemplate.getTemplate('system:researcher'),
      { rateLimitKey: 'llm:agent' },
    );

    // Parse the response (may contain multiple actions)
    const preferActionOverFinal = this.shouldUseActionOnlyFirstTurnPrompt(
      request,
      state,
    );
    let parsed = this.parseAgentResponse(response, {
      preferActionWhenFinalAlsoPresent: preferActionOverFinal,
    });

    parsed = await this.repairFirstTurnResponseIfNeeded(
      request,
      state,
      response,
      parsed,
      false,
    );

    const firstAction = parsed.actions[0];

    // Create the reasoning step (include the full LLM prompt for transparency)
    const step: ReasoningStep = {
      step: state.iteration,
      thought: parsed.thought,
      action: firstAction?.action,
      actionInput: firstAction?.actionInput,
      parallelActions: parsed.actions.length > 1 ? parsed.actions : undefined,
      llmPrompt: prompt,
    };

    // Check if the agent is done
    if (firstAction?.action === 'Final Answer' || parsed.finalAnswer) {
      // Log if the LLM also included tool actions alongside Final Answer
      if (parsed.actions.length > 1) {
        const droppedTools = parsed.actions
          .filter((a) => a.action !== 'Final Answer')
          .map((a) => a.action);
        if (droppedTools.length > 0) {
          this.logger.warn(
            `Iteration ${state.iteration}: Dropping ${droppedTools.length} tool call(s) (${droppedTools.join(', ')}) because Final Answer was also present`,
          );
        }
      }
      // Prevent premature Final Answer - require at least one tool call
      // Allow Final Answer after MIN_TOOL_FORCE_ITERATIONS to prevent infinite loops
      // EXCEPTION: Meta questions about capabilities can be answered immediately
      const isMeta = this.isMetaQuestion(request.query);
      if (
        state.actions.length === 0 &&
        state.iteration < AGENT_CONFIG.MIN_TOOL_FORCE_ITERATIONS &&
        !isMeta
      ) {
        this.logger.warn(
          `Iteration ${state.iteration}: Agent attempted Final Answer without calling any tools - forcing tool use`,
        );

        // Suggest a concrete tool based on the query to guide the agent
        const suggestedTool = this.suggestToolForQuery(request.query);

        // Add a step with system feedback so the agent knows to use tools
        step.thought = `${parsed.thought}\n\n[System: REJECTED - You MUST call at least one tool before providing a Final Answer. Do NOT fabricate data. ${suggestedTool}]`;
        step.action = undefined;
        step.observation = `SYSTEM OVERRIDE: Final Answer rejected because no tools have been called yet (iteration ${state.iteration}). You MUST output an Action with a tool call on your next response. Do not provide a Final Answer until you have called at least one tool and received real data. Example format:\nThought: I need to retrieve real data\nAction: {"tool": "analyze_cdd_cases", "input": {}}`;
        state.steps.push(step);
        // Continue to next iteration - agent will see system feedback in scratchpad
        return;
      } else {
        if (state.actions.length === 0) {
          this.logger.warn(
            `Iteration ${state.iteration}: Allowing Final Answer without tool calls (safety valve after ${AGENT_CONFIG.MIN_TOOL_FORCE_ITERATIONS} iterations)`,
          );
        }
        state.isDone = true;
        state.finalAnswer = parsed.finalAnswer || firstAction?.actionInput;
        state.steps.push(step);
        return;
      }
    }

    // Guard: if no action was parsed, the LLM response didn't follow the ReAct format.
    // Inject feedback to redirect the agent back to tool use.
    if (parsed.actions.length === 0) {
      this.logger.warn(
        `Iteration ${state.iteration}: Agent response contained no parseable Action - redirecting to tool use`,
      );
      const suggestedTool = this.suggestToolForQuery(request.query);
      step.observation = `SYSTEM: Your response did not contain a valid Action. You must respond in the exact format:\nThought: [your reasoning]\nAction: {"tool": "tool_name", "input": {"param": "value"}}\n\n${suggestedTool}`;
      state.steps.push(step);
      return;
    }

    // Cap parallel actions to prevent runaway tool calls
    let actionsToRun = parsed.actions;
    if (actionsToRun.length > AGENT_CONFIG.MAX_PARALLEL_ACTIONS) {
      this.logger.warn(
        `Capping parallel actions from ${actionsToRun.length} to ${AGENT_CONFIG.MAX_PARALLEL_ACTIONS}`,
      );
      actionsToRun = actionsToRun.slice(0, AGENT_CONFIG.MAX_PARALLEL_ACTIONS);
    }

    // Execute actions in parallel
    const isParallel = actionsToRun.length > 1;
    if (isParallel) {
      this.logger.log(
        `Executing ${actionsToRun.length} tools in parallel: ${actionsToRun.map((a) => a.action).join(', ')}`,
      );
    }

    const results = await Promise.all(
      actionsToRun.map(async (pa) => {
        const actionStart = Date.now();
        let output: any;
        let success = true;
        let error: string | undefined;
        let sources: any[] = [];

        try {
          const result = await this.tools.executeTool(
            pa.action,
            pa.actionInput,
          );
          output = result.output;
          sources = result.sources;
        } catch (e) {
          success = false;
          error = e.message;
          output = { error: e.message };
        }

        return {
          pa,
          output,
          success,
          error,
          sources,
          duration: Date.now() - actionStart,
        };
      }),
    );

    // Record actions and build combined observation
    // (sources collected here to avoid concurrent array mutation)
    const observations: string[] = [];
    for (const r of results) {
      state.sources.push(...r.sources);

      const actionRecord: AgentAction = {
        tool: r.pa.action,
        input: r.pa.actionInput,
        output: r.output,
        duration: r.duration,
        success: r.success,
        error: r.error,
      };
      state.actions.push(actionRecord);

      const obs = this.tools.formatToolObservation(r.pa.action, r.output);
      observations.push(isParallel ? `[${r.pa.action}] ${obs}` : obs);
    }

    step.observation = observations.join('\n\n');
    state.steps.push(step);
  }

  /**
   * Detect whether the user is asking about the agent's own capabilities,
   * available tools, or what kind of analysis it can perform.
   * These "meta" questions can be answered directly without tool calls.
   */
  private isMetaQuestion(query: string): boolean {
    const q = query.toLowerCase();
    const metaPatterns = [
      'what can you do',
      'what do you do',
      'what are you capable',
      'what are your capabilities',
      'what tools do you have',
      'what tools are available',
      'list your tools',
      'describe your tools',
      'what kind of analysis',
      'what types of analysis',
      'what analysis can you',
      'how can you help',
      'what can you help',
      'what are you able to',
      'tell me about your',
      'explain your capabilities',
      'what functions do you',
      'what features do you',
      'help me understand what you can',
      'what insights can you',
      'what reports can you',
      'what information can you',
      'how is nps',
      'how nps is',
      'how are nps',
      'what is nps',
      'nps calculated',
      'nps methodology',
      'nps estimation',
      'how do you calculate nps',
      'how do you estimate nps',
      'explain nps',
      'how does nps work',
    ];
    return metaPatterns.some((pattern) => q.includes(pattern));
  }

  /**
   * Suggest a specific tool based on query keywords to help the agent
   * pick the right tool when it keeps trying to skip tool calls.
   */
  private suggestToolForQuery(query: string): string {
    const q = query.toLowerCase();

    if (
      q.includes('cdd') ||
      q.includes('due diligence') ||
      q.includes('case status')
    ) {
      return 'Try calling: Action: {"tool": "analyze_cdd_cases", "input": {}}';
    }
    if (
      q.includes('category') ||
      q.includes('breakdown') ||
      q.includes('complaint')
    ) {
      return 'Try calling: Action: {"tool": "get_category_breakdown", "input": {}}';
    }
    if (q.includes('sentiment')) {
      return 'Try calling: Action: {"tool": "analyze_sentiment", "input": {}}';
    }
    if (
      q.includes('anomal') ||
      q.includes('outlier') ||
      q.includes('spike') ||
      q.includes('unusual') ||
      q.includes('abnormal') ||
      q.includes('deviation')
    ) {
      return 'Try calling: Action: {"tool": "detect_anomalies", "input": {}}';
    }
    if (q.includes('volume') || q.includes('daily') || q.includes('trend')) {
      return 'Try calling: Action: {"tool": "get_daily_volumes", "input": {}}';
    }
    if (q.includes('sla') || q.includes('compliance') || q.includes('breach')) {
      return 'Try calling: Action: {"tool": "analyze_sla_compliance", "input": {}}';
    }
    if (q.includes('resolution') || q.includes('time')) {
      return 'Try calling: Action: {"tool": "analyze_resolution_times", "input": {}}';
    }
    if (q.includes('risk')) {
      return 'Try calling: Action: {"tool": "assess_risk", "input": {}}';
    }
    if (
      q.includes('issue') ||
      q.includes('problem') ||
      q.includes('detect') ||
      q.includes('recurring')
    ) {
      return 'Try calling: Action: {"tool": "detect_issues", "input": {}}';
    }
    if (
      q.includes('relationship') ||
      q.includes('history with') ||
      q.includes('interactions with')
    ) {
      return 'Try calling: Action: {"tool": "get_relationship_summary", "input": {"customerId": "<ID>"}}';
    }
    // Default suggestion
    return (
      'Try calling: Action: {"tool": "query_data", "input": {"query": "' +
      query.replace(/"/g, "'") +
      '"}}'
    );
  }

  /**
   * Build the prompt for the agent.
   * Uses enabledTools from the request to filter both tool parameter
   * descriptions and the "Your Capabilities" section (loaded from .skill.md files).
   */
  private buildPrompt(request: ResearchRequest, state: AgentState): string {
    if (this.shouldUseActionOnlyFirstTurnPrompt(request, state)) {
      return this.buildActionOnlyFirstTurnPrompt(request);
    }

    const toolDescriptions = this.tools.getToolDescriptions(
      request.enabledTools,
    );
    const scratchpad = this.buildScratchpad(state.steps);

    const conversationContext = request.conversationHistory
      ? request.conversationHistory
          .map((turn) => `${turn.role}: ${turn.content}`)
          .join('\n')
      : '';

    // Build the capabilities section from skill definitions
    const capabilities = this.skillManager.formatCapabilitiesPrompt(
      request.enabledTools,
    );

    return this.promptTemplate.renderNamed('agent:react', {
      tools: toolDescriptions,
      capabilities,
      question: request.query,
      context: request.context || '',
      conversationHistory: conversationContext,
      customerId: request.customerId || '',
      scratchpad,
    });
  }

  private shouldUseActionOnlyFirstTurnPrompt(
    request: ResearchRequest,
    state: AgentState,
  ): boolean {
    return (
      state.iteration === 1 &&
      state.actions.length === 0 &&
      state.steps.length === 0 &&
      !this.isMetaQuestion(request.query)
    );
  }

  private buildActionOnlyFirstTurnPrompt(request: ResearchRequest): string {
    const toolDescriptions = this.tools.getToolDescriptions(
      request.enabledTools,
    );

    const conversationContext = request.conversationHistory
      ? request.conversationHistory
          .map((turn) => `${turn.role}: ${turn.content}`)
          .join('\n')
      : '';

    return `You are in FIRST-STEP ACTION MODE.

You MUST choose one or more tools and output only Thought + Action block(s).
Do NOT output Final Answer.
Do NOT fabricate data.

User Request: ${request.query}

${request.context ? `Context:\n${request.context}\n` : ''}
${conversationContext ? `Conversation History:\n${conversationContext}\n` : ''}
${request.customerId ? `Customer ID: ${request.customerId}\n` : ''}

Available Tools:
${toolDescriptions}

Output format:
Thought: [short reasoning]
Action: {"tool": "tool_name", "input": {}}

You may include multiple Action lines only when they are independent.`;
  }

  private async repairFirstTurnResponseIfNeeded(
    request: ResearchRequest,
    state: AgentState,
    rawResponse: string,
    parsed: {
      thought: string;
      actions: Array<{ action: string; actionInput: any }>;
      finalAnswer?: string;
    },
    isStreaming: boolean,
  ): Promise<{
    thought: string;
    actions: Array<{ action: string; actionInput: any }>;
    finalAnswer?: string;
  }> {
    if (!this.shouldUseActionOnlyFirstTurnPrompt(request, state)) {
      return parsed;
    }

    const attemptedFinalAnswer =
      parsed.actions[0]?.action === 'Final Answer' || !!parsed.finalAnswer;
    const noActions = parsed.actions.length === 0;

    if (!attemptedFinalAnswer && !noActions) {
      return parsed;
    }

    const mode = isStreaming ? '[Streaming] ' : '';
    const reason = attemptedFinalAnswer
      ? 'it provided Final Answer before using tools'
      : 'it did not contain a parseable Action';

    this.logger.warn(
      `${mode}Iteration ${state.iteration}: First-turn response invalid (${reason}) - running one-shot repair prompt`,
    );
    this.incrementReactMetric(state, 'firstTurnInvalid');

    const suggestedTool = this.suggestToolForQuery(request.query);
    const repairPrompt = `Your previous response was rejected because ${reason}.

You MUST now respond with at least one Action tool call.
Do NOT output Final Answer.

Original user request:
${request.query}

Rejected response:
${rawResponse}

Guidance:
${suggestedTool}

Required output format:
Thought: [short reasoning]
Action: {"tool": "tool_name", "input": {}}

If useful, include additional independent Action lines.`;

    try {
      const repairedResponse = await this.promptWithTimeout(
        repairPrompt,
        this.promptTemplate.getTemplate('system:researcher'),
        { rateLimitKey: 'llm:agent' },
        AGENT_CONFIG.FIRST_TURN_REPAIR_TIMEOUT_MS,
      );

      const repairedParsed = this.parseAgentResponse(repairedResponse, {
        preferActionWhenFinalAlsoPresent: true,
      });
      const repairedIsStillInvalid =
        repairedParsed.actions.length === 0 ||
        repairedParsed.actions[0]?.action === 'Final Answer' ||
        !!repairedParsed.finalAnswer;

      if (repairedIsStillInvalid) {
        this.logger.warn(
          `${mode}Iteration ${state.iteration}: Repair prompt did not produce valid tool action; continuing with normal rejection flow`,
        );
        this.incrementReactMetric(state, 'firstTurnRepairFailed');
        return parsed;
      }

      this.logger.log(
        `${mode}Iteration ${state.iteration}: Repair prompt recovered a valid tool action response`,
      );
      this.incrementReactMetric(state, 'firstTurnRepairSuccess');
      return repairedParsed;
    } catch (error) {
      this.logger.warn(
        `${mode}Iteration ${state.iteration}: Repair prompt failed (${error.message}); continuing with normal rejection flow`,
      );
      this.incrementReactMetric(state, 'firstTurnRepairFailed');
      return parsed;
    }
  }

  private incrementReactMetric(
    state: AgentState,
    metric:
      | 'firstTurnInvalid'
      | 'firstTurnRepairSuccess'
      | 'firstTurnRepairFailed',
  ): void {
    if (!state._reactMetrics) {
      state._reactMetrics = {
        firstTurnInvalid: 0,
        firstTurnRepairSuccess: 0,
        firstTurnRepairFailed: 0,
      };
    }
    state._reactMetrics[metric] += 1;
  }

  private logReactMetrics(state: AgentState, isStreaming: boolean): void {
    const metrics = state._reactMetrics;
    if (!metrics) {
      return;
    }

    const prefix = isStreaming ? '[Streaming] ' : '';
    this.logger.log(
      `${prefix}ReAct first-turn metrics: first_turn_invalid=${metrics.firstTurnInvalid}, first_turn_repair_success=${metrics.firstTurnRepairSuccess}, first_turn_repair_failed=${metrics.firstTurnRepairFailed}`,
    );
  }

  /**
   * Build the scratchpad from previous steps.
   * For parallel-action steps, replays all Action blocks so the LLM
   * sees the same multi-action format it produced.
   */
  private buildScratchpad(steps: ReasoningStep[]): string {
    if (steps.length === 0) {
      return '';
    }

    return steps
      .map((step) => {
        let text = `Thought: ${step.thought}`;
        if (step.parallelActions && step.parallelActions.length > 1) {
          // Replay all parallel actions so the LLM sees the multi-action format
          for (const pa of step.parallelActions) {
            text += `\nAction: ${JSON.stringify({ tool: pa.action, input: pa.actionInput || {} })}`;
          }
        } else if (step.action) {
          // Single action — standard format
          text += `\nAction: ${JSON.stringify({ tool: step.action, input: step.actionInput || {} })}`;
        }
        if (step.observation) {
          text += `\nObservation: ${step.observation}`;
        }
        return text;
      })
      .join('\n\n');
  }

  /**
   * Parse the agent's response into structured components.
   * Supports single and multi-action responses:
   *   - JSON: Action: {"tool": "tool_name", "input": {...}}
   *   - Plain: Action: tool_name\nAction Input: {...}
   *   - Multiple: Action: {...}\nAction: {...}  (parallel)
   */
  private parseAgentResponse(
    response: string,
    options?: { preferActionWhenFinalAlsoPresent?: boolean },
  ): {
    thought: string;
    actions: Array<{ action: string; actionInput: any }>;
    finalAnswer?: string;
  } {
    const preferActionWhenFinalAlsoPresent =
      options?.preferActionWhenFinalAlsoPresent ?? true;

    // Try to extract thought
    const thoughtMatch = response.match(
      /Thought:\s*([\s\S]*?)(?=Action:|Final Answer:|$)/i,
    );
    const thought = thoughtMatch?.[1]?.trim() || response.split('\n')[0];

    // Check for final answer
    const finalAnswerMatch = response.match(/Final Answer:\s*([\s\S]*?)$/i);

    // Find ALL Action: blocks (supports parallel multi-action)
    const actions: Array<{ action: string; actionInput: any }> = [];

    // Find all JSON-format actions: Action: {"tool": "...", "input": {...}}
    const actionRegex = /Action:\s*\{/gi;
    let match: RegExpExecArray | null;
    while ((match = actionRegex.exec(response)) !== null) {
      const braceStart = response.indexOf('{', match.index);
      const jsonStr = this.extractJsonObject(response, braceStart);
      if (jsonStr) {
        try {
          const actionJson = JSON.parse(jsonStr);
          if (actionJson.tool) {
            actions.push({
              action: actionJson.tool,
              actionInput: actionJson.input || {},
            });
          }
        } catch {
          this.logger.debug(
            `Failed to parse JSON action: ${jsonStr.substring(0, 100)}`,
          );
        }
        // Advance past this JSON block to avoid re-matching
        actionRegex.lastIndex = braceStart + (jsonStr?.length || 1);
      }
    }

    if (actions.length > 0) {
      if (finalAnswerMatch) {
        if (preferActionWhenFinalAlsoPresent) {
          this.logger.warn(
            'Agent response included both Action and Final Answer; preferring Action and ignoring Final Answer for this iteration',
          );
        } else {
          return {
            thought,
            actions: [{ action: 'Final Answer', actionInput: undefined }],
            finalAnswer: finalAnswerMatch[1].trim(),
          };
        }
      }
      if (actions.length > 1) {
        this.logger.log(
          `Parsed ${actions.length} parallel actions: ${actions.map((a) => a.action).join(', ')}`,
        );
      }
      return { thought, actions };
    }

    if (finalAnswerMatch) {
      return {
        thought,
        actions: [{ action: 'Final Answer', actionInput: undefined }],
        finalAnswer: finalAnswerMatch[1].trim(),
      };
    }

    // Fallback: Try plain format: Action: tool_name\nAction Input: {...}
    const plainMatch = response.match(/Action:\s*(\w+)/i);
    const actionInputMatch = response.match(
      /Action Input:\s*([\s\S]*?)(?=Thought:|Observation:|$)/i,
    );

    let actionInput: any;
    if (actionInputMatch) {
      const inputText = actionInputMatch[1].trim();
      try {
        actionInput = JSON.parse(inputText);
      } catch {
        actionInput = { query: inputText };
      }
    }

    if (plainMatch?.[1]) {
      return {
        thought,
        actions: [{ action: plainMatch[1], actionInput }],
      };
    }

    // No actions parsed
    return { thought, actions: [] };
  }

  /**
   * Extract a complete JSON object from a string starting at the given brace position.
   * Handles nested braces correctly, unlike regex-based approaches.
   */
  private extractJsonObject(str: string, startIndex: number): string | null {
    if (str[startIndex] !== '{') return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = startIndex; i < str.length; i++) {
      const ch = str[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (ch === '\\') {
        escape = true;
        continue;
      }

      if (ch === '"') {
        inString = !inString;
        continue;
      }

      if (inString) continue;

      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) {
          return str.substring(startIndex, i + 1);
        }
      }
    }

    return null; // Unbalanced braces
  }

  /**
   * Synthesize a final answer from collected information
   */
  private async synthesizeFinalAnswer(
    request: ResearchRequest,
    state: AgentState,
  ): Promise<string> {
    // Collect all observations, filtering out injected system messages
    const observations = state.steps
      .filter(
        (s) =>
          s.observation &&
          !s.observation.startsWith('SYSTEM OVERRIDE:') &&
          !s.observation.startsWith('SYSTEM:'),
      )
      .map((s) => `Tool: ${s.action}\nResult: ${s.observation}`)
      .join('\n\n---\n\n');

    const prompt = `Based on the following research findings, provide a comprehensive answer to the question.

Question: ${request.query}

Research Findings:
${observations}

Provide a clear, concise answer that synthesizes the findings. If the information is incomplete, acknowledge what is known and what couldn't be determined.`;

    return this.promptWithTimeout(prompt, undefined, {
      rateLimitKey: 'llm:agent',
    });
  }

  /**
   * Calculate confidence score based on agent performance
   * Uses a more robust algorithm that considers:
   * - Source diversity (unique sources found)
   * - Iteration efficiency (completed quickly)
   * - Tool success rate
   * - Whether a final answer was reached
   */
  private calculateConfidence(state: AgentState): number {
    const w = CONFIDENCE_WEIGHTS;
    let confidence = w.BASE;

    // Bonus for unique sources (capped to prevent gaming)
    const uniqueSources = new Set(state.sources.map((s) => s.id)).size;
    const sourceBonus = Math.min(
      uniqueSources * w.SOURCE_BONUS,
      w.MAX_SOURCE_BONUS,
    );
    confidence += sourceBonus;

    // Calculate tool success rate (not raw count)
    const totalCalls = state.actions.length;
    const failedCalls = state.actions.filter((a) => !a.success).length;
    const successRate =
      totalCalls > 0 ? (totalCalls - failedCalls) / totalCalls : 1;

    // Penalty based on failure rate, not just count
    if (successRate < 1) {
      const failurePenalty = (1 - successRate) * w.FAILURE_PENALTY * 2;
      confidence -= Math.min(failurePenalty, w.FAILURE_PENALTY * 2);
    }

    // Bonus for having a final answer
    if (state.finalAnswer) {
      confidence += w.FINAL_ANSWER_BONUS;
    }

    // Efficiency bonus: completed well before max iterations
    const iterationRatio = state.iteration / state.maxIterations;
    if (iterationRatio < 0.5 && state.isDone) {
      confidence += w.EFFICIENCY_BONUS;
    }

    // Penalty if hit max iterations without clear answer
    if (state.iteration >= state.maxIterations && !state.isDone) {
      confidence -= w.MAX_ITERATION_PENALTY;
    }

    // Clamp to 0-1
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Deduplicate sources
   */
  private deduplicateSources(sources: ResearchSource[]): ResearchSource[] {
    const seen = new Set<string>();
    return sources.filter((source) => {
      if (seen.has(source.id)) {
        return false;
      }
      seen.add(source.id);
      return true;
    });
  }

  /**
   * Generate follow-up questions
   */
  private async generateFollowUpQuestions(
    request: ResearchRequest,
    state: AgentState,
  ): Promise<string[]> {
    // Skip follow-ups if no tools were called, an error occurred, or there's no meaningful answer
    if (state.actions.length === 0 || state.error || !state.finalAnswer) {
      return [];
    }

    const prompt = `Based on this research question and findings, suggest ${AGENT_CONFIG.MAX_FOLLOWUP_COUNT} follow-up questions the user might want to explore.

Original Question: ${request.query}

Answer Summary: ${state.finalAnswer?.substring(0, AGENT_CONFIG.MAX_SUMMARY_LENGTH) || 'In progress'}

Return only the questions, one per line.`;

    try {
      const response = await this.promptWithTimeout(prompt, undefined, {
        rateLimitKey: 'llm:agent',
      });
      return response
        .split('\n')
        .map((q) => q.replace(/^\d+\.\s*/, '').trim())
        .filter((q) => q.length > AGENT_CONFIG.MIN_FOLLOWUP_LENGTH)
        .slice(0, AGENT_CONFIG.MAX_FOLLOWUP_COUNT);
    } catch {
      return [];
    }
  }

  /**
   * Prompt the LLM with a timeout to prevent indefinite hangs.
   * Uses centralized timeout handling with timer cleanup.
   */
  private promptWithTimeout(
    prompt: string,
    systemPrompt?: string,
    options?: { rateLimitKey?: string },
    timeoutMs: number = AGENT_CONFIG.LLM_TIMEOUT_MS,
  ): Promise<string> {
    return this.llmClient.promptWithTimeout(
      prompt,
      systemPrompt,
      options,
      timeoutMs,
    );
  }
}
