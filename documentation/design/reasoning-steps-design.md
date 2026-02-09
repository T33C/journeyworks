Real-Time Reasoning Steps Display
Problem Statement
The research page has a "Show Reasoning" toggle that displays agent reasoning steps. Currently this only shows data after the research completes because:

The agent executor runs synchronously, returning all reasoning at once
No real-time communication channel exists between backend and frontend
The lastReasoningSteps signal is only populated when the HTTP response completes
Goal: Display reasoning steps progressively as the agent thinks, using WebSockets or similar real-time technology.

Current State
Component Status
UI Toggle ✅ Exists (showReasoning in
research.component.ts
)
Reasoning Panel ✅ Exists (expansion panels showing steps)
Backend Agent ✅ Returns reasoning[] in response
WebSocket deps ✅ Installed (@nestjs/websockets, socket.io)
WebSocket Gateway ❌ Not implemented
SSE Frontend ⚠️ Skeleton exists (
streamQuery()
) but unused
SSE Backend ❌ Not implemented
Design Options
Option A: WebSocket Gateway (Recommended)
Architecture:

LLM Service
Agent Executor
WebSocket Gateway
Angular UI
LLM Service
Agent Executor
WebSocket Gateway
Angular UI
loop
[Each Iteration]
connect(sessionId)
startResearch(query)
executeStreaming(request, callback)
prompt()
response
emit('reasoning-step', step)
reasoning-step event
emit('tool-call', { tool, input })
tool-call event
emit('tool-result', { output })
tool-result event
emit('complete', response)
complete event
Pros:

Bi-directional communication (can cancel, pause, etc.)
Already have dependencies installed
Native NestJS support via @WebSocketGateway
Clean separation of concerns
Cons:

Slightly more complex setup
Need to handle reconnection
Option B: Server-Sent Events (SSE)
Architecture:

Agent Executor
REST Controller
Angular UI
Agent Executor
REST Controller
Angular UI
loop
[Each Iteration]
GET /research/stream?query=...
executeStreaming(request, callback)
yield step
data: {"type":"step",...}
yield complete
data: {"type":"complete",...}
Pros:

Simpler implementation
Built on HTTP (easier debugging, proxying)
Frontend skeleton already exists
Cons:

Unidirectional only (no cancel/pause)
Some proxy/load balancer issues
Need to handle reconnection manually
Option C: Hybrid Approach
Use HTTP POST to initiate, WebSocket for streaming updates:

POST /research/conversation/:id returns immediately with requestId
WebSocket streams progress events
Final response also delivered via WebSocket
Pros:

Best of both worlds
Graceful fallback possible
Cons:

Most complex implementation
Requires correlation between HTTP and WS
Recommended Approach: Option A (WebSocket)
Given that:

Dependencies are already installed
Future features may need bi-directional communication (cancel, feedback)
NestJS has excellent WebSocket support
Proposed Changes
Backend
[NEW]
research.gateway.ts
WebSocket gateway for real-time research streaming:

typescript
@WebSocketGateway({
namespace: '/research',
cors: { origin: '\*' }
})
export class ResearchGateway {
@SubscribeMessage('startResearch')
async handleResearch(
@MessageBody() data: { query: string; sessionId: string },
@ConnectedSocket() client: Socket,
) {
// Call agent executor with streaming callback
await this.agentExecutor.executeStreaming(request, (event) => {
client.emit(event.type, event.data);
});
}
}
[MODIFY]
agent-executor.service.ts
Add streaming execution method:

typescript
async executeStreaming(
request: ResearchRequest,
onEvent: (event: StreamEvent) => void,
): Promise<ResearchResponse> {
// Emit events at key points:
// - 'thinking': when starting LLM call
// - 'reasoning-step': after parsing response
// - 'tool-call': before executing tool
// - 'tool-result': after tool execution
// - 'complete': when done
}
[MODIFY]
research.module.ts
Register the gateway.

Frontend
[MODIFY]
research.service.ts
Add WebSocket connection management:

typescript
private socket: Socket | null = null;
connectWebSocket(): void {
this.socket = io(`${environment.wsUrl}/research`);

this.socket.on('reasoning-step', (step) => {
this.\_liveReasoningSteps.update(steps => [...steps, step]);
});

this.socket.on('tool-call', (data) => {
this.\_currentToolCall.set(data);
});
}
sendMessageStreaming(query: string): void {
this.socket?.emit('startResearch', {
query,
sessionId: this.\_sessionId()
});
}
[MODIFY]
research.component.ts
Auto-connect WebSocket when showReasoning is toggled on
Display live steps as they arrive
Show current tool execution with loading indicator
[MODIFY]
research.component.html
Update reasoning panel to show:

Live streaming steps
Current tool being executed (with spinner)
Step completion indicators
Event Types
typescript
interface StreamEvent {
type:
| 'connected' // WebSocket connected
| 'thinking' // LLM is generating
| 'reasoning-step' // Parsed thought/action
| 'tool-call' // About to execute tool
| 'tool-result' // Tool completed
| 'complete' // Final response
| 'error'; // Error occurred
data: any;
timestamp: string;
}
User Review Required
IMPORTANT

Design Decision Needed: Which approach do you prefer?

Option A (WebSocket): Full bi-directional, can add cancel/pause later
Option B (SSE): Simpler, HTTP-based, skeleton exists
Option C (Hybrid): Most flexible but most complex
NOTE

This is primarily a UX enhancement for the demo. The agent will work the same way - we're just exposing its internal progress to the user in real-time.

Verification Plan
Manual Verification
Since this is a real-time streaming feature, automated testing is limited. Manual verification:

Start the backend: npm run start:dev in journeyworks-api
Start the frontend: npm run start in journeyworks-ui
Navigate to Research page: http://localhost:4200/research
Toggle "Show Reasoning" on (the sparkle icon button)
Submit a query like "What are the main CDD case statuses?"
Observe:
Reasoning panel should update in real-time as each step completes
Tool calls should show with a loading indicator
Tool results should appear when tools complete
Final answer should appear when done
Automated Tests
Backend Unit Test (after implementation)
bash
cd journeyworks-api
npm run test -- --grep "ResearchGateway"
Test file: research.gateway.spec.ts (to be created)

Test WebSocket connection handling
Test event emission during streaming
Frontend Unit Test (after implementation)
bash
cd journeyworks-ui
npm run test -- --include="\*\*/research.service.spec.ts"
Test WebSocket service connection and event handling.

Questions for You
Which design option do you prefer? A (WebSocket), B (SSE), or C (Hybrid)?
Should we also support cancellation? (e.g., stop button while reasoning)
Any preference on the visual design? (e.g., timeline vs expansion panels)

Comment
⌥⌘M
