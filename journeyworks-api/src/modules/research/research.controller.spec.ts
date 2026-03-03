/* eslint-disable @typescript-eslint/no-explicit-any */

import { ResearchController } from './research.controller';

describe('ResearchController', () => {
  let controller: ResearchController;
  let serviceMock: {
    research: jest.Mock;
    quickQuestion: jest.Mock;
    startConversation: jest.Mock;
    researchWithContext: jest.Mock;
    getConversation: jest.Mock;
    clearConversation: jest.Mock;
    researchCustomer: jest.Mock;
    getAvailableTools: jest.Mock;
    getExampleQuestions: jest.Mock;
    getInsight: jest.Mock;
  };

  beforeEach(() => {
    serviceMock = {
      research: jest.fn(),
      quickQuestion: jest.fn(),
      startConversation: jest.fn(),
      researchWithContext: jest.fn(),
      getConversation: jest.fn(),
      clearConversation: jest.fn(),
      researchCustomer: jest.fn(),
      getAvailableTools: jest.fn(),
      getExampleQuestions: jest.fn(),
      getInsight: jest.fn(),
    };

    controller = new ResearchController(serviceMock as any);
  });

  it('delegates research() request payload', async () => {
    const dto = { query: 'what happened?' } as any;
    serviceMock.research.mockResolvedValue({ answer: 'ok' });

    const result = await controller.research(dto);

    expect(serviceMock.research).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ answer: 'ok' });
  });

  it('maps quickQuestion payload', async () => {
    serviceMock.quickQuestion.mockResolvedValue({ answer: 'a' });

    await controller.quickQuestion({
      question: 'q',
      customerId: 'cust-1',
    } as any);

    expect(serviceMock.quickQuestion).toHaveBeenCalledWith('q', 'cust-1');
  });

  it('startConversation wraps conversationId response', async () => {
    serviceMock.startConversation.mockResolvedValue('conv-1');

    const result = await controller.startConversation();

    expect(result).toEqual({ conversationId: 'conv-1' });
  });

  it('continueConversation forwards context/options', async () => {
    serviceMock.researchWithContext.mockResolvedValue({ answer: 'ok' });

    await controller.continueConversation('conv-1', {
      query: 'next',
      customerId: 'cust-1',
      maxIterations: 4,
      context: { product: 'credit-card', channel: 'email' },
    } as any);

    expect(serviceMock.researchWithContext).toHaveBeenCalledWith(
      'conv-1',
      'next',
      {
        customerId: 'cust-1',
        maxIterations: 4,
        context: { product: 'credit-card', channel: 'email' },
      },
    );
  });

  it('clearConversation returns cleared=true and calls service', () => {
    const result = controller.clearConversation('conv-9');

    expect(serviceMock.clearConversation).toHaveBeenCalledWith('conv-9');
    expect(result).toEqual({ cleared: true });
  });

  it('maps getConversation into history envelope', async () => {
    serviceMock.getConversation.mockResolvedValue([
      { role: 'user', content: 'x' },
    ]);

    const result = await controller.getConversation('conv-1');

    expect(result).toEqual({ history: [{ role: 'user', content: 'x' }] });
  });

  it('researchCustomer wraps results envelope', async () => {
    serviceMock.researchCustomer.mockResolvedValue([
      { question: 'q1', answer: 'a1' },
    ]);

    const result = await controller.researchCustomer('cust-1', {
      questions: ['q1'],
    } as any);

    expect(result).toEqual({ results: [{ question: 'q1', answer: 'a1' }] });
  });

  it('returns tools/examples passthrough envelopes', () => {
    serviceMock.getAvailableTools.mockReturnValue([
      { name: 't', description: 'd' },
    ]);
    serviceMock.getExampleQuestions.mockReturnValue(['e1']);

    expect(controller.getTools()).toEqual({
      tools: [{ name: 't', description: 'd' }],
    });
    expect(controller.getExamples()).toEqual({ examples: ['e1'] });
  });

  it('delegates getInsight payload', async () => {
    serviceMock.getInsight.mockResolvedValue({ summary: 'insight' });

    const dto = { context: { product: 'cards' } } as any;
    const result = await controller.getInsight(dto);

    expect(serviceMock.getInsight).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ summary: 'insight' });
  });
});
