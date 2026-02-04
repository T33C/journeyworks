/**
 * Agent Executor Service
 *
 * Implements the ReAct (Reasoning and Acting) agent loop.
 * The agent thinks, decides on an action, observes the result, and repeats.
 */

import { Injectable, Logger } from '@nestjs/common';
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
} from './research.types';

@Injectable()
export class AgentExecutor {
  private readonly logger = new Logger(AgentExecutor.name);
  private readonly maxIterations = 10;

  constructor(
    private readonly llmClient: LlmClientService,
    private readonly promptTemplate: PromptTemplateService,
    private readonly tools: AgentTools,
  ) {}

  /**
   * Execute the research agent
   */
  async execute(request: ResearchRequest): Promise<ResearchResponse> {
    const startTime = Date.now();
    const maxIterations = request.maxIterations || this.maxIterations;

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
        model: 'claude-sonnet-4-20250514',
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

    // Extract action and action input
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
    if (typeof output === 'string') {
      return output.substring(0, 2000);
    }

    const formatted = JSON.stringify(output, null, 2);
    if (formatted.length > 2000) {
      return formatted.substring(0, 1997) + '...';
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
   */
  private calculateConfidence(state: AgentState): number {
    let confidence = 0.5; // Base confidence

    // Increase for successful tool calls
    const successfulCalls = state.actions.filter((a) => a.success).length;
    confidence += successfulCalls * 0.1;

    // Decrease for failed calls
    const failedCalls = state.actions.filter((a) => !a.success).length;
    confidence -= failedCalls * 0.1;

    // Increase for having sources
    if (state.sources.length > 0) {
      confidence += 0.1;
    }

    // Decrease if hit max iterations without answer
    if (state.iteration >= state.maxIterations && !state.finalAnswer) {
      confidence -= 0.2;
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

    const prompt = `Based on this research question and findings, suggest 3 follow-up questions the user might want to explore.

Original Question: ${request.query}

Answer Summary: ${state.finalAnswer?.substring(0, 500) || 'In progress'}

Return only the questions, one per line.`;

    try {
      const response = await this.llmClient.prompt(prompt, undefined, {
        rateLimitKey: 'llm:agent',
      });
      return response
        .split('\n')
        .map((q) => q.replace(/^\d+\.\s*/, '').trim())
        .filter((q) => q.length > 10)
        .slice(0, 3);
    } catch {
      return [];
    }
  }
}
