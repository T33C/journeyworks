/**
 * Agent Prompt: ReAct Pattern
 *
 * @description
 * Implements the ReAct (Reasoning + Acting) pattern for agentic workflows.
 * Enables the LLM to think step-by-step and take actions using tools.
 *
 * @rationale
 * The ReAct pattern is the foundation of agentic AI systems. It combines
 * chain-of-thought reasoning with action execution for complex tasks.
 *
 * **Why ReAct**
 *
 * 1. **Explicit Reasoning**
 *    - Model explains its thinking
 *    - Easier to debug and validate
 *    - Users can follow the logic
 *
 * 2. **Tool Use**
 *    - Access to external capabilities
 *    - Real-time data retrieval
 *    - Actions with side effects
 *
 * 3. **Iterative Refinement**
 *    - Observe results of actions
 *    - Adjust strategy based on outcomes
 *    - Handle errors gracefully
 *
 * **The ReAct Loop**
 *
 * ```
 * Thought: What do I need to do?
 * Action: Which tool to use and with what input
 * Observation: What was the result?
 * ... (repeat as needed)
 * Final Answer: The complete response
 * ```
 *
 * **Tool Selection**
 *
 * The prompt lists available tools with:
 * - Name and description
 * - Required and optional parameters
 * - Example usage
 * - Expected output format
 *
 * **Error Handling**
 *
 * - Tool failures trigger retry with different approach
 * - Missing information prompts clarification
 * - Graceful degradation when tools unavailable
 *
 * @variables
 * - query: The user's request
 * - tools: Available tools with descriptions
 * - conversationHistory: Previous turns
 * - maxIterations: Safety limit on loops
 *
 * @output ReAct trace with final answer
 *
 * @version 1.0.0
 * @since 2026-02-03
 */
export const REACT_AGENT_PROMPT = `You are an intelligent agent that can use tools to help answer questions and complete tasks.

Available Tools:
{{tools}}

{{#if context}}
Context:
{{context}}
{{/if}}

{{#if conversationHistory}}
Conversation History:
{{conversationHistory}}
{{/if}}

{{#if customerId}}
Customer ID: {{customerId}}
{{/if}}

User Request: {{question}}

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
- Always provide a Final Answer when you have enough information
- If you cannot find the information, explain what you tried and what couldn't be found

Format your response as:
Thought: [your reasoning]
Action: {"tool": "tool_name", "input": {"param": "value"}}

{{#if scratchpad}}
Previous Steps:
{{scratchpad}}

Continue from where you left off:
{{/if}}
`;
