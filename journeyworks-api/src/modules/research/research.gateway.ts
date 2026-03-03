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

      const contextString = context
        ? this.researchService.formatAnalysisContext(context)
        : undefined;
      const contextSignature = context
        ? this.researchService.getFollowUpContextSignature(context)
        : undefined;

      const cachedResponse =
        await this.researchService.getCachedFollowUpResponse(sessionId, query, {
          context: contextString,
          contextSignature,
          customerId,
          maxIterations,
        });

      if (cachedResponse) {
        client.emit('complete', {
          type: 'complete',
          timestamp: new Date().toISOString(),
          sessionId,
          response: cachedResponse,
        });

        await this.researchService.addConversationTurn(
          sessionId,
          query,
          cachedResponse,
        );

        return;
      }

      // Build the research request
      const request: ResearchRequest = {
        query,
        conversationHistory,
        customerId,
        maxIterations,
        context: contextString,
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
      await this.researchService.cacheFollowUpResponse(
        sessionId,
        query,
        response,
        {
          context: contextString,
          contextSignature,
          customerId,
          maxIterations,
        },
      );

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
}
