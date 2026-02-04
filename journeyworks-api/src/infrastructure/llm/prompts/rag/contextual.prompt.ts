/**
 * RAG Prompt: Contextual Embedding
 *
 * @description
 * Generates contextual descriptions for documents before embedding.
 * Adds document context to improve retrieval accuracy.
 *
 * @rationale
 * This implements Anthropic's "Contextual Retrieval" technique from their
 * research paper. The key insight is that documents embedded in isolation
 * lose important context that affects their meaning.
 *
 * **The Contextual Retrieval Problem**
 *
 * Consider a chunk: "The Q3 results exceeded expectations by 15%"
 *
 * Without context:
 * - Which company?
 * - Which year?
 * - What were the expectations?
 *
 * With context:
 * - "This chunk is from Acme Corp's 2024 earnings call transcript.
 *    It discusses Q3 financial performance."
 *
 * **How Contextual Embedding Works**
 *
 * 1. Take the full document
 * 2. Take the specific chunk
 * 3. Generate a brief context statement
 * 4. Prepend context to chunk before embedding
 *
 * **Benefits**
 *
 * - 35% improvement in retrieval accuracy (per Anthropic)
 * - Better handling of ambiguous references
 * - Improved cross-document connections
 * - More relevant results for complex queries
 *
 * **When to Use**
 *
 * - Document ingestion pipeline
 * - Re-indexing for improved retrieval
 * - High-value document collections
 *
 * @variables
 * - document: The full document text
 * - chunk: The specific chunk to contextualize
 * - documentMetadata: Available metadata about the document
 *
 * @output Brief contextual description to prepend to chunk
 *
 * @version 1.0.0
 * @since 2026-02-03
 */
export const CONTEXTUAL_EMBEDDING_PROMPT = `<document>
{{document}}
</document>

Here is the chunk we want to situate within the whole document:
<chunk>
{{chunk}}
</chunk>

Document Metadata:
{{documentMetadata}}

Please give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. Answer only with the succinct context and nothing else.`;
