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
import {
  ResearchRequest,
  ResearchResponse,
  ResearchSource,
  ReasoningStep,
  AgentAction,
  AgentState,
  ToolParameters,
} from './research.types';

/** Agent configuration constants */
const AGENT_CONFIG = {
  /** Default maximum iterations for the agent loop */
  DEFAULT_MAX_ITERATIONS: 10,
  /** Maximum characters for observation truncation */
  MAX_OBSERVATION_LENGTH: 2000,
  /** Minimum characters for follow-up question */
  MIN_FOLLOWUP_LENGTH: 10,
  /** Maximum number of follow-up questions */
  MAX_FOLLOWUP_COUNT: 3,
  /** Maximum characters for final answer summary in follow-up generation */
  MAX_SUMMARY_LENGTH: 500,
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
        this.logger.error(`Agent iteration failed: ${error.message}`);
        state.error = error.message;
        break;
      }
    }

    // If we hit max iterations without finishing, synthesize an answer
    if (!state.isDone && !state.finalAnswer) {
      state.finalAnswer = await this.synthesizeFinalAnswer(request, state);
    }

    const totalTime = Date.now() - startTime;

    // Generate follow-up questions
    const followUpQuestions = await this.generateFollowUpQuestions(
      request,
      state,
    );

    return {
      answer:
        state.finalAnswer || 'I was unable to find a satisfactory answer.',
      confidence: this.calculateConfidence(state),
      sources: this.deduplicateSources(state.sources),
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
   * Run a single iteration of the agent loop
   */
  private async runIteration(
    request: ResearchRequest,
    state: AgentState,
  ): Promise<void> {
    // Build the prompt with scratchpad
    const prompt = this.buildPrompt(request, state);

    // Get the agent's response
    const response = await this.llmClient.prompt(
      prompt,
      this.promptTemplate.getTemplate('system:researcher'),
      { rateLimitKey: 'llm:agent' },
    );

    // Parse the response
    const parsed = this.parseAgentResponse(response);

    // Create the reasoning step
    const step: ReasoningStep = {
      step: state.iteration,
      thought: parsed.thought,
      action: parsed.action,
      actionInput: parsed.actionInput,
    };

    // Check if the agent is done
    if (parsed.action === 'Final Answer' || parsed.finalAnswer) {
      state.isDone = true;
      state.finalAnswer = parsed.finalAnswer || parsed.actionInput;
      state.steps.push(step);
      return;
    }

    // Execute the action
    if (parsed.action) {
      const actionStart = Date.now();
      let output: any;
      let success = true;
      let error: string | undefined;

      try {
        const result = await this.tools.executeTool(
          parsed.action,
          parsed.actionInput,
        );
        output = result.output;
        state.sources.push(...result.sources);
      } catch (e) {
        success = false;
        error = e.message;
        output = { error: e.message };
      }

      const action: AgentAction = {
        tool: parsed.action,
        input: parsed.actionInput,
        output,
        duration: Date.now() - actionStart,
        success,
        error,
      };

      state.actions.push(action);
      step.observation = this.formatObservation(output);
    }

    state.steps.push(step);
  }

  /**
   * Build the prompt for the agent
   */
  private buildPrompt(request: ResearchRequest, state: AgentState): string {
    const toolDescriptions = this.tools.getToolDescriptions();
    const scratchpad = this.buildScratchpad(state.steps);

    const conversationContext = request.conversationHistory
      ? request.conversationHistory
          .map((turn) => `${turn.role}: ${turn.content}`)
          .join('\n')
      : '';

    return this.promptTemplate.renderNamed('agent:react', {
      tools: toolDescriptions,
      question: request.query,
      context: request.context || '',
      conversationHistory: conversationContext,
      customerId: request.customerId || '',
      scratchpad,
    });
  }

  /**
   * Build the scratchpad from previous steps
   */
  private buildScratchpad(steps: ReasoningStep[]): string {
    if (steps.length === 0) {
      return '';
    }

    return steps
      .map((step) => {
        let text = `Thought: ${step.thought}`;
        if (step.action) {
          text += `\nAction: ${step.action}`;
          text += `\nAction Input: ${JSON.stringify(step.actionInput)}`;
        }
        if (step.observation) {
          text += `\nObservation: ${step.observation}`;
        }
        return text;
      })
      .join('\n\n');
  }

  /**
   * Parse the agent's response into structured components
   * Supports both formats:
   *   - JSON: Action: {"tool": "tool_name", "input": {...}}
   *   - Plain: Action: tool_name\nAction Input: {...}
   */
  private parseAgentResponse(response: string): {
    thought: string;
    action?: string;
    actionInput?: any;
    finalAnswer?: string;
  } {
    // Try to extract thought
    const thoughtMatch = response.match(
      /Thought:\s*([\s\S]*?)(?=Action:|Final Answer:|$)/i,
    );
    const thought = thoughtMatch?.[1]?.trim() || response.split('\n')[0];

    // Check for final answer
    const finalAnswerMatch = response.match(/Final Answer:\s*([\s\S]*?)$/i);
    if (finalAnswerMatch) {
      return {
        thought,
        action: 'Final Answer',
        finalAnswer: finalAnswerMatch[1].trim(),
      };
    }

    // Try JSON format first: Action: {"tool": "name", "input": {...}}
    const jsonActionMatch = response.match(
      /Action:\s*(\{[\s\S]*?\})(?=\s*(?:Thought:|Observation:|$))/i,
    );
    if (jsonActionMatch) {
      try {
        const actionJson = JSON.parse(jsonActionMatch[1].trim());
        if (actionJson.tool) {
          return {
            thought,
            action: actionJson.tool,
            actionInput: actionJson.input || {},
          };
        }
      } catch {
        // Fall through to plain format
      }
    }

    // Try plain format: Action: tool_name\nAction Input: {...}
    const actionMatch = response.match(/Action:\s*(\w+)/i);
    const actionInputMatch = response.match(
      /Action Input:\s*([\s\S]*?)(?=Thought:|Observation:|$)/i,
    );

    let actionInput: any;
    if (actionInputMatch) {
      const inputText = actionInputMatch[1].trim();
      try {
        actionInput = JSON.parse(inputText);
      } catch {
        // Try to parse as a simple value
        actionInput = { query: inputText };
      }
    }

    return {
      thought,
      action: actionMatch?.[1],
      actionInput,
    };
  }

  /**
   * Format observation from tool output
   */
  private formatObservation(output: any): string {
    const maxLength = AGENT_CONFIG.MAX_OBSERVATION_LENGTH;

    if (typeof output === 'string') {
      return output.substring(0, maxLength);
    }

    const formatted = JSON.stringify(output, null, 2);
    if (formatted.length > maxLength) {
      return formatted.substring(0, maxLength - 3) + '...';
    }
    return formatted;
  }

  /**
   * Synthesize a final answer from collected information
   */
  private async synthesizeFinalAnswer(
    request: ResearchRequest,
    state: AgentState,
  ): Promise<string> {
    // Collect all observations
    const observations = state.steps
      .filter((s) => s.observation)
      .map((s) => `Tool: ${s.action}\nResult: ${s.observation}`)
      .join('\n\n---\n\n');

    const prompt = `Based on the following research findings, provide a comprehensive answer to the question.

Question: ${request.query}

Research Findings:
${observations}

Provide a clear, concise answer that synthesizes the findings. If the information is incomplete, acknowledge what is known and what couldn't be determined.`;

    return this.llmClient.prompt(prompt, undefined, {
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
    if (state.actions.length === 0) {
      return [];
    }

    const prompt = `Based on this research question and findings, suggest ${AGENT_CONFIG.MAX_FOLLOWUP_COUNT} follow-up questions the user might want to explore.

Original Question: ${request.query}

Answer Summary: ${state.finalAnswer?.substring(0, AGENT_CONFIG.MAX_SUMMARY_LENGTH) || 'In progress'}

Return only the questions, one per line.`;

    try {
      const response = await this.llmClient.prompt(prompt, undefined, {
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
}
