/**
 * Analysis Prompt: Sentiment Analysis
 *
 * @description
 * Analyzes the sentiment of a single customer communication.
 * Returns a structured assessment including sentiment label, score,
 * confidence, emotional tones, and key indicators.
 *
 * @rationale
 * Sentiment analysis in customer intelligence goes beyond simple
 * positive/negative classification:
 *
 * **Multi-dimensional Output**
 * - Label: The primary sentiment category
 * - Score: Continuous -1 to 1 scale for nuanced comparison
 * - Confidence: How certain the model is about the assessment
 * - Emotional Tones: Specific emotions detected (frustration, appreciation, etc.)
 * - Key Indicators: Specific phrases that drove the assessment
 *
 * **Why These Fields?**
 * - Score enables trend analysis and aggregation
 * - Confidence helps filter low-certainty results
 * - Emotional tones provide richer context for relationship managers
 * - Key indicators enable verification and highlight important phrases
 *
 * @variables
 * - content: The communication text to analyze
 * - channel: Communication channel (email, phone, chat, etc.)
 * - customerName: Name of the customer
 * - date: When the communication occurred
 *
 * @output JSON with sentiment, score, confidence, emotionalTone, keyIndicators, explanation
 *
 * @version 1.0.0
 * @since 2026-02-03
 */
export const SENTIMENT_ANALYSIS_PROMPT = `Analyze the sentiment of the following customer communication.

Communication:
{{content}}

Channel: {{channel}}
Customer: {{customerName}}
Date: {{date}}

Provide your analysis in the following JSON format:
{
  "sentiment": "positive" | "negative" | "neutral" | "mixed",
  "score": <number between -1 and 1>,
  "confidence": <number between 0 and 1>,
  "emotionalTone": ["<list of emotional tones detected>"],
  "keyIndicators": ["<specific phrases or indicators that led to this assessment>"],
  "explanation": "<brief explanation of the sentiment assessment>"
}`;
