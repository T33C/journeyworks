/**
 * Analysis Prompt: Comprehensive Analysis
 *
 * @description
 * Performs a full multi-dimensional analysis of a customer communication.
 * Combines sentiment, intent, entity extraction, risk assessment, and recommendations.
 *
 * @rationale
 * Some use cases require complete analysis in a single call:
 *
 * **When to Use Comprehensive Analysis**
 * - High-value customer communications
 * - Escalations or complaints
 * - Initial triage of new communications
 * - When all dimensions are needed
 *
 * **Trade-offs**
 * - More expensive (more tokens) than single-dimension analysis
 * - More comprehensive output
 * - Single API call vs multiple calls
 *
 * **Analysis Dimensions**
 *
 * 1. **Sentiment Analysis**
 *    - Overall sentiment and score
 *    - Emotional undertones
 *    - Key sentiment indicators
 *
 * 2. **Intent Analysis**
 *    - Primary and secondary intents
 *    - Urgency level
 *    - Required actions
 *
 * 3. **Entity Extraction**
 *    - Products/services
 *    - Dates and amounts
 *    - Issues and requests
 *
 * 4. **Risk Assessment**
 *    - Compliance concerns
 *    - Churn risk indicators
 *    - Escalation potential
 *    - Regulatory flags
 *
 * 5. **Recommendations**
 *    - Immediate actions
 *    - Long-term improvements
 *    - Cross-sell opportunities
 *
 * @variables
 * - content: The communication text to analyze
 * - channel: Communication channel
 * - customerId: Customer identifier
 * - customerName: Name of the customer
 * - date: When the communication occurred
 * - previousContext: Previous communication history
 *
 * @output JSON with all five analysis dimensions
 *
 * @version 1.0.0
 * @since 2026-02-03
 */
export const COMPREHENSIVE_ANALYSIS_PROMPT = `Perform a comprehensive analysis of the following customer communication.

Communication:
{{content}}

Channel: {{channel}}
Customer ID: {{customerId}}
Customer Name: {{customerName}}
Date: {{date}}
Previous Context: {{previousContext}}

Provide a complete analysis including:

1. SENTIMENT ANALYSIS
- Overall sentiment and score
- Emotional undertones
- Key sentiment indicators

2. INTENT ANALYSIS
- Primary intent and category
- Secondary intents
- Urgency level
- Required actions

3. ENTITY EXTRACTION
- Products/services mentioned
- Key dates and amounts
- Issues identified
- Requests made

4. RISK ASSESSMENT
- Compliance concerns
- Churn risk indicators
- Escalation potential
- Regulatory flags

5. RECOMMENDATIONS
- Immediate actions
- Long-term relationship improvements
- Cross-sell/up-sell opportunities

6. CLASSIFICATION
- Map to one of these Areas of Issue if applicable:
  * Account Opening Process
  * Call Handling / Customer Interaction
  * CDD Remediation
  * Fees, Charges and Interest
  * Payment processing
- Suggest the most likely Reason for Complaint from the customer's perspective
- Confidence level for the classification (low, medium, high)

Provide your analysis in JSON format with the above structure.`;
