/**
 * Analysis Prompt: Entity Extraction
 *
 * @description
 * Extracts named entities and key information from customer communications.
 * Identifies products, accounts, amounts, dates, people, locations, issues, and requests.
 *
 * @rationale
 * Entity extraction enables structured data capture from unstructured text:
 *
 * **Entity Categories**
 *
 * 1. **Products/Services**: What the customer is discussing
 *    - Enables product-level sentiment analysis
 *    - Helps route to appropriate teams
 *
 * 2. **Accounts**: Account identifiers mentioned
 *    - Links communications to specific accounts
 *    - Supports compliance and audit trails
 *
 * 3. **Amounts**: Monetary values
 *    - Helps prioritize high-value issues
 *    - Enables financial impact analysis
 *
 * 4. **Dates**: Timeframes mentioned
 *    - Tracks promised delivery dates
 *    - Identifies deadline-related issues
 *
 * 5. **People**: Names and roles
 *    - Tracks who customer has interacted with
 *    - Identifies escalation paths
 *
 * 6. **Locations**: Geographic references
 *    - Regional issue identification
 *    - Branch-level analysis
 *
 * 7. **Issues**: Problems identified
 *    - Root cause analysis
 *    - Issue categorization
 *
 * 8. **Requests**: What customer is asking for
 *    - Action item generation
 *    - SLA tracking
 *
 * @variables
 * - content: The communication text to analyze
 *
 * @output JSON with products, accounts, amounts, dates, people, locations, issues, requests
 *
 * @version 1.0.0
 * @since 2026-02-03
 */
export const ENTITY_EXTRACTION_PROMPT = `Extract key entities from the following customer communication.

Communication:
{{content}}

Extract entities in the following categories:
- Products/Services mentioned
- Account numbers or identifiers
- Monetary amounts
- Dates and timeframes
- People mentioned (names, roles)
- Locations
- Issues or problems
- Requests or requirements

Provide your extraction in JSON format:
{
  "products": [{"name": "", "context": ""}],
  "accounts": [{"identifier": "", "type": ""}],
  "amounts": [{"value": "", "currency": "", "context": ""}],
  "dates": [{"date": "", "context": ""}],
  "people": [{"name": "", "role": "", "relationship": ""}],
  "locations": [{"name": "", "type": ""}],
  "issues": [{"description": "", "severity": ""}],
  "requests": [{"description": "", "priority": ""}]
}`;
