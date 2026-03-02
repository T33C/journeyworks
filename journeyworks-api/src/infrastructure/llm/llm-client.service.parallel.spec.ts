/* eslint-disable @typescript-eslint/no-explicit-any */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LlmClientService } from './llm-client.service';
import { AnthropicService } from './anthropic.service';
import { OpenAIService } from './openai.service';
import { RedisRateLimiterService } from '../redis';

/**
 * Tests for the parallelPrompt and parallelComplete methods
 * on LlmClientService.
 */
describe('LlmClientService — parallel methods', () => {
  let service: LlmClientService;
  let anthropicMock: { isAvailable: jest.Mock; complete: jest.Mock };
  let openaiMock: { isAvailable: jest.Mock; complete: jest.Mock };
  let rateLimiterMock: { checkLimit: jest.Mock };

  beforeEach(async () => {
    anthropicMock = {
      isAvailable: jest.fn().mockReturnValue(true),
      complete: jest.fn().mockResolvedValue({
        content: 'test response',
        model: 'claude-test',
        provider: 'anthropic',
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        stopReason: 'end_turn',
      }),
    };

    openaiMock = {
      isAvailable: jest.fn().mockReturnValue(false),
      complete: jest.fn(),
    };

    rateLimiterMock = {
      checkLimit: jest.fn().mockResolvedValue({ allowed: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmClientService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const defaults: Record<string, any> = {
                'llm.primaryProvider': 'anthropic',
                'llm.fallbackEnabled': false,
                'llm.rateLimitRequests': 100,
                'llm.rateLimitWindowMs': 60000,
                'llm.maxRetries': 0,
                'llm.baseDelayMs': 100,
              };
              return defaults[key];
            }),
          },
        },
        { provide: AnthropicService, useValue: anthropicMock },
        { provide: OpenAIService, useValue: openaiMock },
        { provide: RedisRateLimiterService, useValue: rateLimiterMock },
      ],
    }).compile();

    service = module.get<LlmClientService>(LlmClientService);
  });

  // ── parallelPrompt ──────────────────────────────────────────────

  describe('parallelPrompt', () => {
    it('should return empty array for empty input', async () => {
      const results = await service.parallelPrompt([]);
      expect(results).toEqual([]);
      expect(anthropicMock.complete).not.toHaveBeenCalled();
    });

    it('should handle a single request without Semaphore overhead', async () => {
      const results = await service.parallelPrompt([{ userMessage: 'hello' }]);

      expect(results).toHaveLength(1);
      expect(results[0]).toBe('test response');
      expect(anthropicMock.complete).toHaveBeenCalledTimes(1);
    });

    it('should execute multiple requests and return results in order', async () => {
      let callCount = 0;
      anthropicMock.complete.mockImplementation(async () => {
        callCount++;
        return {
          content: `response-${callCount}`,
          model: 'claude-test',
          provider: 'anthropic',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          stopReason: 'end_turn',
        };
      });

      const results = await service.parallelPrompt([
        { userMessage: 'q1' },
        { userMessage: 'q2' },
        { userMessage: 'q3' },
      ]);

      expect(results).toHaveLength(3);
      // All should be non-null
      expect(results.every((r) => r !== null)).toBe(true);
      expect(anthropicMock.complete).toHaveBeenCalledTimes(3);
    });

    it('should return null for failed requests without failing others', async () => {
      let callIndex = 0;
      anthropicMock.complete.mockImplementation(async () => {
        callIndex++;
        if (callIndex === 2) {
          throw new Error('Simulated LLM failure');
        }
        return {
          content: `response-${callIndex}`,
          model: 'claude-test',
          provider: 'anthropic',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          stopReason: 'end_turn',
        };
      });

      const results = await service.parallelPrompt(
        [{ userMessage: 'q1' }, { userMessage: 'q2' }, { userMessage: 'q3' }],
        {},
        2,
      );

      expect(results).toHaveLength(3);
      expect(results[0]).toBe('response-1');
      expect(results[1]).toBeNull(); // Failed request
      expect(results[2]).toBe('response-3');
    });

    it('should respect maxConcurrency limit', async () => {
      let maxConcurrent = 0;
      let current = 0;

      anthropicMock.complete.mockImplementation(async () => {
        current++;
        maxConcurrent = Math.max(maxConcurrent, current);
        await new Promise((r) => setTimeout(r, 30));
        current--;
        return {
          content: 'ok',
          model: 'claude-test',
          provider: 'anthropic',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          stopReason: 'end_turn',
        };
      });

      await service.parallelPrompt(
        Array.from({ length: 6 }, (_, i) => ({
          userMessage: `q${i}`,
        })),
        {},
        2, // maxConcurrency = 2
      );

      expect(maxConcurrent).toBeLessThanOrEqual(2);
      expect(anthropicMock.complete).toHaveBeenCalledTimes(6);
    });
  });

  // ── parallelComplete ────────────────────────────────────────────

  describe('parallelComplete', () => {
    it('should return empty array for empty input', async () => {
      const results = await service.parallelComplete([]);
      expect(results).toEqual([]);
    });

    it('should handle a single request', async () => {
      const results = await service.parallelComplete([
        { messages: [{ role: 'user', content: 'hello' }] },
      ]);

      expect(results).toHaveLength(1);
      expect(results[0]?.content).toBe('test response');
    });

    it('should execute multiple requests in parallel', async () => {
      let callCount = 0;
      anthropicMock.complete.mockImplementation(async () => {
        callCount++;
        return {
          content: `response-${callCount}`,
          model: 'claude-test',
          provider: 'anthropic',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          stopReason: 'end_turn',
        };
      });

      const results = await service.parallelComplete(
        [
          { messages: [{ role: 'user', content: 'q1' }] },
          { messages: [{ role: 'user', content: 'q2' }] },
        ],
        {},
        2,
      );

      expect(results).toHaveLength(2);
      expect(results.every((r) => r !== null)).toBe(true);
      expect(anthropicMock.complete).toHaveBeenCalledTimes(2);
    });

    it('should return null for failed requests', async () => {
      anthropicMock.complete
        .mockResolvedValueOnce({
          content: 'ok',
          model: 'claude-test',
          provider: 'anthropic',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          stopReason: 'end_turn',
        })
        .mockRejectedValueOnce(new Error('fail'));

      const results = await service.parallelComplete(
        [
          { messages: [{ role: 'user', content: 'q1' }] },
          { messages: [{ role: 'user', content: 'q2' }] },
        ],
        {},
        2,
      );

      expect(results[0]?.content).toBe('ok');
      expect(results[1]).toBeNull();
    });
  });
});
