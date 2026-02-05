# ReAct Agent Architecture

This document explains how the ReAct (Reasoning and Acting) agent enables autonomous research across customer intelligence data in JourneyWorks.

## Overview

The ReAct agent implements an agentic AI pattern that can autonomously:

1. **Reason** about what information is needed to answer a question
2. **Act** by calling tools to gather data
3. **Observe** the results and decide next steps
4. **Repeat** until a satisfactory answer is found

**Example Interaction:**

```
User: "Why are customers complaining about the mobile app?"

Agent:
  Thought: I need to find complaints related to the mobile app
  Action: search_knowledge_base
  Action Input: {"query": "mobile app complaints issues"}
  Observation: Found 23 communications mentioning app issues...

  Thought: I should analyze the sentiment and common topics
  Action: analyze_topics
  Action Input: {"timeRange": "last 30 days"}
  Observation: Top topics: login failures (34%), crashes (28%), slow performance (22%)...

  Thought: I now have enough information to answer
  Final Answer: Customers are primarily complaining about mobile app login
                failures (34%), crashes (28%), and slow performance (22%)...
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (Angular)                              │
│                                                                              │
│  ┌─────────────────────┐                                                     │
│  │ Research Panel      │───▶  POST /api/research                            │
│  │ "Why are customers  │      { query: "Why are customers complaining..." } │
│  │  complaining..."    │                                                     │
│  └─────────────────────┘                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND (NestJS)                                │
│                                                                              │
│  ┌─────────────────────┐    ┌──────────────────────────────────────────┐    │
│  │ research.controller │───▶│ research.service.ts                      │    │
│  │ .ts                 │    │                                          │    │
│  └─────────────────────┘    │  Determines if query needs agent:        │    │
│                             │  • Simple → Direct LLM call              │    │
│                             │  • Complex → AgentExecutor               │    │
│                             └──────────────────────────────────────────┘    │
│                                              │                               │
│                                              ▼                               │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      AgentExecutor.execute()                          │   │
│  │                                                                       │   │
│  │  ┌──────────────────────────────────────────────────────────────┐    │   │
│  │  │                    ReAct Loop (max 10 iterations)            │    │   │
│  │  │                                                              │    │   │
│  │  │   ┌─────────┐    ┌─────────┐    ┌───────────┐    ┌───────┐  │    │   │
│  │  │   │ Thought │───▶│ Action  │───▶│ Execute   │───▶│Observe│  │    │   │
│  │  │   │         │    │ Select  │    │ Tool      │    │Result │  │    │   │
│  │  │   └─────────┘    └─────────┘    └───────────┘    └───┬───┘  │    │   │
│  │  │        ▲                                             │      │    │   │
│  │  │        └─────────────────────────────────────────────┘      │    │   │
│  │  │                    (until Final Answer)                     │    │   │
│  │  └──────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                              │                               │
│                    ┌─────────────────────────┼─────────────────────────┐    │
│                    ▼                         ▼                         ▼    │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌──────────────────┐│
│  │ AgentTools          │    │ LlmClientService    │    │ Prompt Templates ││
│  │                     │    │                     │    │                  ││
│  │ • search_knowledge  │    │ • Reasoning calls   │    │ • agent:react    ││
│  │ • ask_question      │    │ • Synthesis calls   │    │ • agent:research ││
│  │ • query_data        │    │                     │    │ • system:researcher│
│  │ • analyze_sentiment │    │                     │    │                  ││
│  │ • analyze_topics    │    │                     │    │                  ││
│  │ • assess_risk       │    │                     │    │                  ││
│  │ • get_customer_info │    │                     │    │                  ││
│  │ • find_similar      │    │                     │    │                  ││
│  │ • analyze_trends    │    │                     │    │                  ││
│  │ • analyze_channel_  │    │                     │    │                  ││
│  │   escalation        │    │                     │    │                  ││
│  │ • analyze_cdd_cases │    │                     │    │                  ││
│  │ • get_daily_volumes │    │                     │    │                  ││
│  │ • analyze_resolution│    │                     │    │                  ││
│  │   _times            │    │                     │    │                  ││
│  │ • analyze_sla_      │    │                     │    │                  ││
│  │   compliance        │    │                     │    │                  ││
│  │ • get_category_     │    │                     │    │                  ││
│  │   breakdown         │    │                     │    │                  ││
│  └─────────────────────┘    └─────────────────────┘    └──────────────────┘│
│           │                                                                  │
│           ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                       Underlying Services                            │    │
│  │                                                                      │    │
│  │  RagService  │  RrgService  │  AnalysisService  │  CommunicationsService│ │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

## The ReAct Pattern

### What is ReAct?

ReAct (Reasoning + Acting) is an agent architecture from the paper ["ReAct: Synergizing Reasoning and Acting in Language Models"](https://arxiv.org/abs/2210.03629). It interleaves:

- **Reasoning traces** (thinking about what to do)
- **Actions** (calling tools to get information)
- **Observations** (processing tool results)

### Why ReAct for Customer Intelligence?

| Benefit                  | Description                                                |
| ------------------------ | ---------------------------------------------------------- |
| **Multi-step reasoning** | Complex questions require multiple data sources            |
| **Transparency**         | Users can see the agent's reasoning process                |
| **Error recovery**       | Failed tool calls can be retried with different approaches |
| **Source tracking**      | All evidence is traced back to original documents          |
| **Flexibility**          | New tools can be added without changing the core logic     |

### The Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                       ReAct Agent Loop                          │
│                                                                 │
│  ┌─────────┐                                                    │
│  │ START   │                                                    │
│  └────┬────┘                                                    │
│       ▼                                                         │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Build Prompt:                                           │    │
│  │ • System prompt (researcher persona)                    │    │
│  │ • Tool descriptions                                     │    │
│  │ • Question                                              │    │
│  │ • Scratchpad (previous Thought/Action/Observations)    │    │
│  └────────────────────────────────────────────────────────┘    │
│       │                                                         │
│       ▼                                                         │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ LLM Response:                                           │    │
│  │                                                         │    │
│  │ Thought: I need to find complaints about the mobile app │    │
│  │ Action: search_knowledge_base                           │    │
│  │ Action Input: {"query": "mobile app complaints"}        │    │
│  └────────────────────────────────────────────────────────┘    │
│       │                                                         │
│       ▼                                                         │
│  ┌────────────────────────────────────────────────────────┐    │
│  │ Parse Response:                                         │    │
│  │ • Extract Thought                                       │    │
│  │ • Extract Action name                                   │    │
│  │ • Extract Action Input (JSON)                           │    │
│  │ • Check for "Final Answer"                              │    │
│  └────────────────────────────────────────────────────────┘    │
│       │                                                         │
│       ├────────────────────────────────────────┐               │
│       ▼                                        ▼               │
│  ┌──────────────┐                    ┌──────────────────┐      │
│  │ Final Answer │                    │ Execute Tool      │      │
│  │ detected?    │                    │                   │      │
│  │              │                    │ AgentTools.exec() │      │
│  └──────┬───────┘                    └─────────┬────────┘      │
│         │ YES                                  │               │
│         ▼                                      ▼               │
│  ┌──────────────┐                    ┌──────────────────┐      │
│  │ DONE         │                    │ Add Observation   │      │
│  │              │                    │ to Scratchpad     │      │
│  │ Return       │                    └─────────┬────────┘      │
│  │ Response     │                              │               │
│  └──────────────┘                              │               │
│                                                │               │
│                         ┌──────────────────────┘               │
│                         ▼                                      │
│                  ┌─────────────┐                               │
│                  │ Iteration   │                               │
│                  │ < Max (10)? │                               │
│                  └──────┬──────┘                               │
│                         │ YES                                  │
│                         └───────────────▶ Loop Back ───────────┘
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent Tools

The agent has access to 16 specialized tools across three categories:

### Information Retrieval

| Tool                    | Description                           | Example Use                        |
| ----------------------- | ------------------------------------- | ---------------------------------- |
| `search_knowledge_base` | Semantic search across communications | Find documents about a topic       |
| `ask_question`          | RAG-based Q&A                         | Get answers with citations         |
| `query_data`            | NL to DSL queries (via RRG)           | Count, filter, aggregate data      |
| `get_customer_info`     | Customer profile lookup               | Get customer communication history |
| `find_similar`          | Vector similarity search              | Find related issues                |

### Analysis

| Tool                      | Description          | Example Use                     |
| ------------------------- | -------------------- | ------------------------------- |
| `analyze_sentiment`       | Sentiment analysis   | Track emotional trends          |
| `analyze_topics`          | Topic extraction     | Identify what customers discuss |
| `analyze_trends`          | Time-series analysis | Spot emerging patterns          |
| `assess_risk`             | Risk scoring         | Identify at-risk customers      |
| `analyze_customer_health` | Health score         | Relationship assessment         |

### Specialized Analytics (NEW)

| Tool                         | Description                                                    | Example Use                                |
| ---------------------------- | -------------------------------------------------------------- | ------------------------------------------ |
| `analyze_channel_escalation` | Track escalations between channels (chatbot→human, chat→phone) | "How many chats escalate to phone calls?"  |
| `analyze_cdd_cases`          | CDD remediation analysis with reasons and trends               | "Show CDD cases with account restrictions" |
| `get_daily_volumes`          | Daily aggregations for communications/cases                    | "Cases per day this month"                 |
| `analyze_resolution_times`   | Resolution time statistics (avg, min, max)                     | "Average time to resolve CDD cases?"       |
| `analyze_sla_compliance`     | SLA breach rate tracking by category                           | "How many cases breached SLA?"             |
| `get_category_breakdown`     | Category/subcategory statistics                                | "Top complaint reasons?"                   |

### Tool Definition Structure

```typescript
interface AgentTool {
  name: string;
  description: string; // LLM uses this to decide when to call
  parameters: {
    type: 'object';
    properties: Record<
      string,
      {
        type: string;
        description: string;
        default?: any;
      }
    >;
    required: string[];
  };
  execute: (input: any) => Promise<any>;
}
```

### Tool Descriptions for LLM

The agent prompt includes formatted tool descriptions:

```
search_knowledge_base: Search the knowledge base for information relevant
                       to a query. Use this to find specific communications,
                       documents, or information. Returns relevant documents
                       with context.
  Parameters:
    - query (string): The search query in natural language
    - topK (number): Number of results to return (default: 5)
    - customerId (string): Optional customer ID to filter results

ask_question: Ask a question and get an answer based on the knowledge base.
              Use this for direct questions that can be answered from stored
              communications.
  Parameters:
    - question (string): The question to answer
    - customerId (string): Optional customer ID to focus the answer on
```

---

## Prompt Templates

### System Prompt: Researcher

```
prompts/system/researcher.prompt.ts
```

Establishes the agent persona:

```
You are a research assistant specialized in analyzing customer data for
investment banking. Your role is to:

1. Answer questions about customers, cases, and communications
2. Synthesize information from multiple sources
3. Identify relevant patterns and correlations
4. Support relationship managers with data-driven insights

Use the available tools to search for relevant information and provide
comprehensive, accurate answers. Always cite the sources of your information.
```

### ReAct Prompt

```
prompts/agent/react.prompt.ts
```

The main agent prompt:

```
You are an intelligent agent that can use tools to help answer questions
and complete tasks.

Available Tools:
{{tools}}

Conversation History:
{{conversationHistory}}

User Request: {{query}}

Use the ReAct pattern to solve this task:

1. Thought: Think about what you need to do
2. Action: Choose a tool and provide the input
3. Observation: (This will be filled in with the tool's response)
4. ... (repeat Thought/Action/Observation as needed)
5. Final Answer: Provide your complete response

Rules:
- Use tools when you need information you don't have
- Think step by step
- If a tool fails, try a different approach
- Be concise in your thoughts
- Maximum {{maxIterations}} iterations allowed

Format your response as:
Thought: [your reasoning]
Action: {"tool": "tool_name", "input": {"param": "value"}}
```

### Research Agent Prompt

```
prompts/agent/research.prompt.ts
```

Specialized for deep research tasks with a structured methodology.

---

## Agent State

The agent maintains state throughout execution:

```typescript
interface AgentState {
  iteration: number; // Current loop iteration
  maxIterations: number; // Safety limit (default: 10)
  steps: ReasoningStep[]; // All thoughts/actions/observations
  actions: AgentAction[]; // Tool execution results
  sources: ResearchSource[]; // Documents found
  isDone: boolean; // Final answer reached
  finalAnswer?: string; // The synthesized answer
  error?: string; // Any error encountered
}

interface ReasoningStep {
  step: number;
  thought: string;
  action?: string;
  actionInput?: any;
  observation?: string;
}

interface AgentAction {
  tool: string;
  input: any;
  output: any;
  duration: number;
  success: boolean;
  error?: string;
}
```

---

## Response Structure

```typescript
interface ResearchResponse {
  answer: string; // The final synthesized answer
  confidence: number; // 0-1 confidence score
  sources: ResearchSource[]; // Evidence with citations
  reasoning: ReasoningStep[]; // Full reasoning trace
  actions: AgentAction[]; // All tool calls made
  followUpQuestions: string[]; // Suggested next questions
  stats: {
    totalTime: number; // Total execution time (ms)
    iterations: number; // Loops completed
    toolCalls: number; // Number of tool invocations
    model: string; // LLM model used
  };
}
```

### Example Response

```json
{
  "answer": "Customers are primarily complaining about mobile app login failures (34%), crashes (28%), and slow performance (22%). The issues spiked after the January 15th update...",
  "confidence": 0.85,
  "sources": [
    {
      "type": "communication",
      "id": "comm-12345",
      "title": "Mobile App Crash Report",
      "relevance": 0.92,
      "excerpt": "The app keeps crashing when I try to check my balance..."
    }
  ],
  "reasoning": [
    {
      "step": 1,
      "thought": "I need to find complaints related to the mobile app",
      "action": "search_knowledge_base",
      "actionInput": {"query": "mobile app complaints issues"},
      "observation": "Found 23 communications mentioning app issues..."
    },
    {
      "step": 2,
      "thought": "I should analyze the common topics",
      "action": "analyze_topics",
      "actionInput": {"timeRange": "last 30 days"},
      "observation": "Top topics: login failures (34%), crashes (28%)..."
    }
  ],
  "actions": [
    {
      "tool": "search_knowledge_base",
      "input": {"query": "mobile app complaints"},
      "output": {...},
      "duration": 234,
      "success": true
    }
  ],
  "followUpQuestions": [
    "When did the login failures start increasing?",
    "Which customer segments are most affected?",
    "What was changed in the January 15th update?"
  ],
  "stats": {
    "totalTime": 4521,
    "iterations": 3,
    "toolCalls": 2,
    "model": "claude-sonnet-4-20250514"
  }
}
```

---

## Confidence Scoring

The agent calculates a confidence score based on execution quality:

```typescript
calculateConfidence(state: AgentState): number {
  let confidence = 0.5;  // Base confidence

  // +0.1 per successful tool call
  confidence += successfulCalls * 0.1;

  // -0.1 per failed tool call
  confidence -= failedCalls * 0.1;

  // +0.1 if sources were found
  if (state.sources.length > 0) confidence += 0.1;

  // -0.2 if max iterations hit without answer
  if (hitMaxIterations && !finalAnswer) confidence -= 0.2;

  return clamp(confidence, 0, 1);
}
```

---

## Error Handling

### Tool Execution Failures

```typescript
try {
  const result = await tools.executeTool(action, input);
  observation = formatObservation(result);
} catch (error) {
  // Tool failure is captured but doesn't stop the agent
  action.success = false;
  action.error = error.message;
  observation = `Error: ${error.message}`;
  // Agent can try a different approach on next iteration
}
```

### Max Iterations Reached

If the agent reaches `maxIterations` without a final answer:

```typescript
if (!state.isDone && !state.finalAnswer) {
  // Synthesize best-effort answer from collected observations
  state.finalAnswer = await synthesizeFinalAnswer(request, state);
}
```

### Unknown Tool Requested

```typescript
executeTool(name: string, input: any) {
  const tool = this.tools.get(name);
  if (!tool) {
    throw new Error(`Unknown tool: ${name}`);
  }
  // ...
}
```

---

## Performance Considerations

| Aspect                     | Strategy                             |
| -------------------------- | ------------------------------------ |
| **LLM Calls**              | 1-10 per request (one per iteration) |
| **Max Iterations**         | Configurable, default 10             |
| **Tool Timeouts**          | Individual tool calls have timeouts  |
| **Observation Truncation** | Tool outputs truncated to 2000 chars |
| **Parallel Tools**         | Not currently supported (sequential) |

### Iteration Budget

Complex questions typically need 2-5 iterations:

| Query Complexity      | Typical Iterations |
| --------------------- | ------------------ |
| Simple lookup         | 1-2                |
| Multi-source analysis | 3-4                |
| Deep research         | 5-8                |
| Complex synthesis     | 8-10               |

---

## Integration with Other Services

### RAG Service

Tools `search_knowledge_base`, `ask_question`, and `find_similar` use RAG:

```typescript
// Semantic search
await ragService.semanticSearch(query, topK, filters);

// Question answering
await ragService.query({ query, filters, useReranking: true });

// Similarity search
await ragService.findSimilar(documentId, topK);
```

### RRG Service

Tool `query_data` uses RRG for structured queries:

```typescript
// Natural language to Elasticsearch DSL
await rrgService.query({
  query: 'count emails by sentiment this week',
  execute: true,
});
```

### Analysis Service

Multiple tools use the analysis service:

```typescript
// Sentiment analysis
await analysisService.analyze({ type: 'sentiment', ... });

// Topic extraction
await analysisService.analyze({ type: 'topics', ... });

// Risk assessment
await analysisService.analyze({ type: 'risk-assessment', ... });
```

---

## Follow-up Questions

After answering, the agent generates contextual follow-up questions:

```typescript
async generateFollowUpQuestions(request, state): Promise<string[]> {
  const prompt = `Based on this research question and findings,
                  suggest 3 follow-up questions...

Original Question: ${request.query}
Answer Summary: ${state.finalAnswer?.substring(0, 500)}`;

  const response = await llmClient.prompt(prompt);
  return response.split('\n')
    .map(q => q.replace(/^\d+\.\s*/, '').trim())
    .filter(q => q.length > 10)
    .slice(0, 3);
}
```

---

## Conversation Context

The agent supports multi-turn conversations:

```typescript
interface ResearchRequest {
  query: string;
  customerId?: string;
  context?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  maxIterations?: number;
}
```

Conversation history is included in the prompt so the agent can:

- Reference previous questions and answers
- Understand pronoun references ("it", "they", "that issue")
- Build on prior research

### Follow-up Question Routing

Follow-up questions from the UI (e.g., after clicking a sentiment bubble) are now routed through the ReAct agent instead of direct LLM calls:

```
Frontend: askFollowUpQuestion(context, question)
    │
    ▼
POST /api/research/conversation/:id
    {
      query: "How many CDD cases per day?",
      context: {
        selectedBubble: { date: "2026-01-15", sentiment: "negative" },
        timeWindow: { start: "...", end: "..." }
      }
    }
    │
    ▼
ReAct Agent (uses specialized tools like get_daily_volumes)
    │
    ▼
Multi-day aggregated response with full reasoning
```

This ensures follow-up questions have access to the full tool suite and can perform comprehensive analysis beyond the initially selected data scope.

---

## Data Model Support

The agent tools leverage enhanced data fields:

### Communication Fields

| Field           | Type                             | Description                                         |
| --------------- | -------------------------------- | --------------------------------------------------- |
| `channel`       | email/phone/chat/letter/social   | Communication channel                               |
| `chatMode`      | chatbot/human-agent              | For chat: distinguishes bot vs human (NEW)          |
| `escalatedFrom` | chatbot/email/chat               | Tracks escalation source (NEW)                      |
| `status`        | open/in_progress/resolved/escalated | Communication status                           |

These fields enable the `analyze_channel_escalation` tool to answer questions like:
- "How many chatbot conversations escalate to human agents?"
- "What percentage of phone calls are escalations from chat?"

---

## Adding New Tools

To add a new tool:

1. **Define the tool in `agent-tools.service.ts`:**

```typescript
this.tools.set('my_new_tool', {
  name: 'my_new_tool',
  description: 'Clear description for the LLM to understand when to use this',
  parameters: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'What this parameter is for' },
    },
    required: ['param1'],
  },
  execute: async (input) => {
    // Call underlying service
    const result = await this.myService.doSomething(input.param1);
    return { summary: result.summary };
  },
});
```

2. **The tool is automatically available** - the agent prompt includes all registered tools.

---

## Future Enhancements

1. **Parallel Tool Execution**: Run independent tools simultaneously
2. **Tool Selection Learning**: Learn which tools work best for query types
3. **Streaming Responses**: Stream reasoning steps as they happen
4. **Human-in-the-Loop**: Allow user approval for certain actions
5. **Memory**: Long-term memory across sessions
6. **Planning**: Multi-step planning before execution
7. **Chart Generation**: Automatic visualization from tool results

---

## Related Documentation

- [LLM Insights Architecture](./llm-insights-architecture.md) - Overall LLM integration
- [RRG Architecture](./rrg-architecture.md) - Natural language to DSL translation
- [Prompts Documentation](../../journeyworks-api/src/infrastructure/llm/prompts/README.md) - Prompt templates
