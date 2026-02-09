/**
 * Research WebSocket Gateway
 *
 * Provides real-time streaming of agent reasoning steps via WebSocket.
 * Clients connect to the /research namespace and emit 'startResearch'
 * to begin a streaming research session.
 *
 * Events emitted to client:
 *   - connected: WebSocket connection confirmed
 *   - thinking: Agent is calling the LLM (iteration N of M)
 *   - reasoning-step: Agent parsed a thought/action from LLM response
 *   - tool-call: Agent is about to execute a tool
 *   - tool-result: Tool execution completed
 *   - complete: Research finished, full response attached
 *   - error: An error occurred during research
 *
 * Events received from client:
 *   - startResearch: Begin a streaming research query
 *   - cancelResearch: (future) Cancel an in-progress research
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { AgentExecutor } from './agent-executor.service';
import { ResearchService } from './research.service';
import {
  ResearchRequest,
  ResearchStreamEvent,
  AnalysisContext,
} from './research.types';

interface StartResearchPayload {
  query: string;
  sessionId: string;
  context?: AnalysisContext;
  customerId?: string;
  maxIterations?: number;
}

@WebSocketGateway({
  namespace: '/research',
  cors: {
    origin: ['http://localhost:4200', 'http://localhost:4280'],
    credentials: true,
  },
})
export class ResearchGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ResearchGateway.name);

  /** Track active research sessions so we can support cancellation later */
  private readonly activeResearch = new Map<string, { aborted: boolean }>();

  constructor(
    private readonly agentExecutor: AgentExecutor,
    private readonly researchService: ResearchService,
  ) {}

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('connected', {
      type: 'connected',
      timestamp: new Date().toISOString(),
      sessionId: client.id,
    });
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Mark any active research as aborted
    const session = this.activeResearch.get(client.id);
    if (session) {
      session.aborted = true;
      this.activeResearch.delete(client.id);
    }
  }

  @SubscribeMessage('startResearch')
  async handleResearch(
    @MessageBody() data: StartResearchPayload,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const { query, sessionId, context, customerId, maxIterations } = data;

    if (!query?.trim()) {
      client.emit('error', {
        type: 'error',
        timestamp: new Date().toISOString(),
        sessionId: sessionId || client.id,
        message: 'Query is required',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    this.logger.log(
      `[WS] Starting streaming research for session ${sessionId}: "${query}"`,
    );

    // Track this research session for potential cancellation
    const session = { aborted: false };
    this.activeResearch.set(client.id, session);

    try {
      // Build conversation history from existing session
      const conversationHistory =
        await this.researchService.getConversation(sessionId);

      // Build the research request
      const request: ResearchRequest = {
        query,
        conversationHistory,
        customerId,
        maxIterations,
        context: context ? this.buildContextString(context) : undefined,
      };

      // Execute with streaming - events are emitted to the client in real-time
      const response = await this.agentExecutor.executeStreaming(
        request,
        sessionId,
        (event: ResearchStreamEvent) => {
          // Check if session was aborted (client disconnected)
          if (session.aborted) {
            this.logger.debug(
              `[WS] Skipping event for aborted session ${sessionId}`,
            );
            return;
          }
          // Emit the event to the specific client
          client.emit(event.type, event);
        },
      );

      // Store the conversation turn in Redis for history
      await this.researchService.addConversationTurn(
        sessionId,
        query,
        response,
      );
    } catch (error) {
      this.logger.error(
        `[WS] Research failed for session ${sessionId}: ${error.message}`,
      );
      if (!session.aborted) {
        client.emit('error', {
          type: 'error',
          timestamp: new Date().toISOString(),
          sessionId,
          message: error.message || 'Research failed',
          code: 'EXECUTION_ERROR',
        });
      }
    } finally {
      this.activeResearch.delete(client.id);
    }
  }

  @SubscribeMessage('cancelResearch')
  handleCancel(@ConnectedSocket() client: Socket): void {
    const session = this.activeResearch.get(client.id);
    if (session) {
      this.logger.log(`[WS] Research cancelled by client ${client.id}`);
      session.aborted = true;
    }
  }

  /**
   * Build a context string from the analysis context object
   * (mirrors what the REST controller does via researchService)
   */
  private buildContextString(context: AnalysisContext): string {
    const parts: string[] = [];

    if (context.product) {
      parts.push(`Product: ${context.product}`);
    }
    if (context.channel) {
      parts.push(`Channel: ${context.channel}`);
    }
    if (context.timeWindow) {
      parts.push(
        `Time window: ${context.timeWindow.start} to ${context.timeWindow.end}`,
      );
    }
    if (context.event) {
      parts.push(
        `Related event: ${context.event.label} (${context.event.type}) on ${context.event.date}`,
      );
    }
    if (context.journeyStage) {
      parts.push(
        `Journey stage: ${context.journeyStage.label} (sentiment: ${context.journeyStage.sentiment})`,
      );
    }
    if (context.quadrant) {
      parts.push(`Quadrant: ${context.quadrant}`);
    }
    if (context.selectedBubble) {
      parts.push(
        `Selected bubble: ${context.selectedBubble.date} (themes: ${context.selectedBubble.themes?.join(', ')})`,
      );
    }

    return parts.length > 0 ? `Dashboard context:\n${parts.join('\n')}` : '';
  }
}
