/* eslint-disable @typescript-eslint/no-explicit-any */

// Polyfill for Jest/node test environment used by undici via Elasticsearch client.
import { ReadableStream as NodeReadableStream } from 'node:stream/web';

if (!(global as any).ReadableStream) {
  (global as any).ReadableStream = NodeReadableStream;
}

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AgentExecutor } from './agent-executor.service';
import {
  LlmClientService,
  PromptTemplateService,
} from '../../infrastructure/llm';
import { AgentTools } from './agent-tools.service';
import { SkillManagerService } from './skill-manager.service';

describe('AgentExecutor - parseAgentResponse', () => {
  let service: AgentExecutor;
  let llmClientMock: { promptWithTimeout: jest.Mock };

  beforeEach(async () => {
    llmClientMock = {
      promptWithTimeout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentExecutor,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(() => undefined),
          },
        },
        {
          provide: LlmClientService,
          useValue: llmClientMock,
        },
        {
          provide: PromptTemplateService,
          useValue: {
            getTemplate: jest.fn(() => ''),
            renderNamed: jest.fn(() => ''),
          },
        },
        {
          provide: AgentTools,
          useValue: {
            getToolDescriptions: jest.fn(() => ''),
          },
        },
        {
          provide: SkillManagerService,
          useValue: {
            formatCapabilitiesPrompt: jest.fn(() => ''),
          },
        },
      ],
    }).compile();

    service = module.get<AgentExecutor>(AgentExecutor);
  });

  const mixedResponse = `Thought: I should query real data first
Action: {"tool": "search_knowledge_base", "input": {"query": "call failures"}}
Final Answer: Here is the answer.`;

  it('prefers Action when Final Answer is also present and preference is enabled', () => {
    const parsed = (service as any).parseAgentResponse(mixedResponse, {
      preferActionWhenFinalAlsoPresent: true,
    });

    expect(parsed.actions).toHaveLength(1);
    expect(parsed.actions[0].action).toBe('search_knowledge_base');
    expect(parsed.finalAnswer).toBeUndefined();
  });

  it('prefers Final Answer when Action is also present and preference is disabled', () => {
    const parsed = (service as any).parseAgentResponse(mixedResponse, {
      preferActionWhenFinalAlsoPresent: false,
    });

    expect(parsed.actions).toHaveLength(1);
    expect(parsed.actions[0].action).toBe('Final Answer');
    expect(parsed.finalAnswer).toBe('Here is the answer.');
  });

  it('defaults to preferring Action when no option is provided', () => {
    const parsed = (service as any).parseAgentResponse(mixedResponse);

    expect(parsed.actions).toHaveLength(1);
    expect(parsed.actions[0].action).toBe('search_knowledge_base');
    expect(parsed.finalAnswer).toBeUndefined();
  });

  it('execute() synthesizes final answer when tools succeeded but no final answer was produced', async () => {
    const runIterationSpy = jest
      .spyOn(service as any, 'runIteration')
      .mockImplementation(async (_request: any, state: any) => {
        state.actions.push({
          tool: 'search_knowledge_base',
          input: { query: 'q' },
          output: { ok: true },
          duration: 10,
          success: true,
        });
        state.isDone = true;
      });

    const synthesizeSpy = jest
      .spyOn(service as any, 'synthesizeFinalAnswer')
      .mockResolvedValue('Synthesized answer');

    const response = await service.execute({ query: 'test query' });

    expect(runIterationSpy).toHaveBeenCalled();
    expect(synthesizeSpy).toHaveBeenCalled();
    expect(response.answer).toBe('Synthesized answer');
  });

  it('repairFirstTurnResponseIfNeeded falls back cleanly when repair prompt call fails', async () => {
    llmClientMock.promptWithTimeout.mockRejectedValue(
      new Error('provider failure'),
    );

    const state: any = {
      iteration: 1,
      maxIterations: 10,
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

    const parsed = {
      thought: 'I can answer directly',
      actions: [{ action: 'Final Answer', actionInput: undefined }],
      finalAnswer: 'answer',
    };

    const result = await (service as any).repairFirstTurnResponseIfNeeded(
      { query: 'real data question' },
      state,
      'Final Answer: answer',
      parsed,
      false,
    );

    expect(result).toBe(parsed);
    expect(state._reactMetrics.firstTurnInvalid).toBe(1);
    expect(state._reactMetrics.firstTurnRepairFailed).toBe(1);
    expect(state._reactMetrics.firstTurnRepairSuccess).toBe(0);
  });
});
