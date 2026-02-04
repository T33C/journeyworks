/**
 * RAG Prompt: Answer Generation
 *
 * @description
 * Generates grounded answers from retrieved context documents.
 * Ensures factual accuracy by citing sources and acknowledging gaps.
 *
 * @rationale
 * RAG answer generation must balance several concerns:
 *
 * **Grounding is Critical**
 *
 * 1. **Hallucination Prevention**
 *    - Only use information from provided context
 *    - Explicitly state when information is not available
 *    - Never invent data, dates, or statistics
 *
 * 2. **Source Attribution**
 *    - Cite which documents support each claim
 *    - Enable users to verify information
 *    - Build trust through transparency
 *
 * 3. **Confidence Communication**
 *    - Distinguish between certain and uncertain information
 *    - Use hedging language when appropriate
 *    - Clearly mark inferences vs direct quotes
 *
 * **Answer Structure**
 *
 * - Direct answer to the question
 * - Supporting evidence with citations
 * - Related insights from context
 * - Gaps in available information
 * - Suggestions for follow-up
 *
 * @variables
 * - query: The user's question
 * - context: Retrieved documents with metadata
 * - conversationHistory: Previous conversation turns
 *
 * @output Structured answer with citations and confidence levels
 *
 * @version 1.0.0
 * @since 2026-02-03
 */
export const RAG_ANSWER_PROMPT = `You are a customer intelligence analyst. Answer the question based ONLY on the provided context.

Question: {{query}}

Retrieved Context:
{{context}}

Conversation History:
{{conversationHistory}}

Instructions:
1. Answer the question using ONLY information from the context
2. Cite specific documents when making claims
3. If the context doesn't contain enough information, say so explicitly
4. Highlight any patterns or trends you notice across documents
5. Suggest follow-up questions if relevant

Format your response as:
{
  "answer": "Your comprehensive answer here",
  "citations": [
    {
      "documentId": "doc_123",
      "quote": "relevant quote from document",
      "relevance": "how this supports the answer"
    }
  ],
  "confidence": "high|medium|low",
  "gaps": ["information that would be helpful but wasn't found"],
  "relatedInsights": ["additional observations from the context"],
  "followUpQuestions": ["suggested next questions"]
}`;
