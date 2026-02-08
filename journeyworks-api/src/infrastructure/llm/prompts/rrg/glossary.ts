/**
 * RRG Domain Glossary
 *
 * @description
 * Provides domain-specific terminology mappings for translating natural
 * language queries into Elasticsearch DSL. This glossary helps the LLM
 * understand retail banking customer intelligence vocabulary.
 *
 * @rationale
 * Users express themselves in natural language that doesn't map directly
 * to index field values. This glossary bridges the gap:
 *
 * - "angry customers" → sentiment.label: negative
 * - "calls about fees" → channel: phone AND content matches "fee"
 * - "high priority" → priority: critical OR priority: high
 *
 * By providing explicit mappings, we:
 * 1. Reduce LLM hallucination on field values
 * 2. Ensure consistent query generation
 * 3. Handle domain-specific jargon
 * 4. Expand synonyms for better recall
 *
 * @usage
 * ```typescript
 * import { formatGlossaryForPrompt } from './glossary';
 *
 * const prompt = `
 *   ${formatGlossaryForPrompt()}
 *   User Query: ${query}
 * `;
 * ```
 *
 * @version 1.0.0
 * @since 2026-02-03
 */

// =============================================================================
// SENTIMENT MAPPINGS
// =============================================================================

/**
 * Maps natural language sentiment expressions to index values
 */
export const SENTIMENT_MAPPINGS: Record<string, string[]> = {
  positive: [
    'happy',
    'pleased',
    'satisfied',
    'grateful',
    'thankful',
    'delighted',
    'impressed',
    'excellent',
    'great',
    'wonderful',
    'appreciate',
    'love',
    'fantastic',
    'amazing',
    'helpful',
  ],
  negative: [
    'angry',
    'upset',
    'frustrated',
    'annoyed',
    'disappointed',
    'unhappy',
    'dissatisfied',
    'furious',
    'outraged',
    'livid',
    'terrible',
    'awful',
    'horrible',
    'unacceptable',
    'disgusted',
    'fed up',
    'complaint',
    'complaining',
  ],
  neutral: [
    'neutral',
    'okay',
    'fine',
    'normal',
    'standard',
    'routine',
    'regular',
    'informational',
  ],
  mixed: [
    'mixed',
    'conflicted',
    'ambivalent',
    'both positive and negative',
    'some good some bad',
  ],
};

// =============================================================================
// CHANNEL MAPPINGS
// =============================================================================

/**
 * Maps natural language channel references to index values
 */
export const CHANNEL_MAPPINGS: Record<string, string[]> = {
  email: ['email', 'emails', 'e-mail', 'mail', 'electronic mail', 'inbox'],
  phone: [
    'phone',
    'call',
    'calls',
    'telephone',
    'voice',
    'rang',
    'called',
    'spoke',
    'conversation',
    'verbal',
  ],
  chat: [
    'chat',
    'live chat',
    'webchat',
    'online chat',
    'instant message',
    'im',
    'messenger',
  ],
  letter: [
    'letter',
    'letters',
    'mail',
    'post',
    'postal',
    'written',
    'correspondence',
    'paper',
  ],
  social: [
    'social',
    'social media',
    'twitter',
    'x',
    'facebook',
    'linkedin',
    'instagram',
    'tweet',
    'post',
    'mention',
  ],
};

// =============================================================================
// PRIORITY MAPPINGS
// =============================================================================

/**
 * Maps urgency/priority expressions to index values
 */
export const PRIORITY_MAPPINGS: Record<string, string[]> = {
  critical: [
    'critical',
    'urgent',
    'emergency',
    'asap',
    'immediately',
    'right now',
    'crisis',
    'escalated',
    'vip',
    'top priority',
    'p1',
    'sev1',
  ],
  high: [
    'high',
    'important',
    'priority',
    'soon',
    'pressing',
    'significant',
    'p2',
    'sev2',
  ],
  medium: ['medium', 'moderate', 'normal', 'standard', 'regular', 'p3', 'sev3'],
  low: ['low', 'minor', 'whenever', 'not urgent', 'backlog', 'p4', 'sev4'],
};

// =============================================================================
// INTENT/CATEGORY MAPPINGS
// =============================================================================

/**
 * Maps user intent expressions to categorized actions
 */
export const INTENT_MAPPINGS: Record<string, string[]> = {
  complaint: [
    'complaint',
    'complain',
    'complaining',
    'issue',
    'problem',
    'trouble',
    'wrong',
    'error',
    'mistake',
    'broken',
    'not working',
    'failed',
    'dispute',
  ],
  inquiry: [
    'inquiry',
    'question',
    'ask',
    'asking',
    'wondering',
    'curious',
    'information',
    'details',
    'explain',
    'how do',
    'what is',
    'why is',
  ],
  request: [
    'request',
    'need',
    'want',
    'require',
    'please',
    'would like',
    'can you',
    'could you',
    'help me',
    'assistance',
  ],
  feedback: [
    'feedback',
    'suggestion',
    'recommend',
    'improvement',
    'idea',
    'thought',
    'opinion',
    'review',
  ],
  escalation: [
    'escalate',
    'escalation',
    'manager',
    'supervisor',
    'higher',
    'executive',
    'complaint to',
    'speak to someone',
    'not resolved',
  ],
  appreciation: [
    'thank',
    'thanks',
    'appreciate',
    'grateful',
    'kudos',
    'well done',
    'excellent service',
    'great job',
    'compliment',
  ],
};

// =============================================================================
// DOMAIN SYNONYMS (Financial Services)
// =============================================================================

/**
 * Expands financial services terminology for better search recall
 */
export const DOMAIN_SYNONYMS: Record<string, string[]> = {
  // Fees & Charges
  fee: [
    'fee',
    'fees',
    'charge',
    'charges',
    'cost',
    'costs',
    'rate',
    'rates',
    'price',
    'pricing',
  ],
  overdraft: [
    'overdraft',
    'overdrawn',
    'negative balance',
    'insufficient funds',
    'arranged overdraft',
    'unarranged overdraft',
  ],
  interest: ['interest', 'apr', 'aer', 'rate', 'yield', 'return', 'base rate'],

  // Account Types
  account: ['account', 'accounts', 'bank account'],
  savings: [
    'savings',
    'saver',
    'deposit',
    'online bonus saver',
    'flexible saver',
    'fixed rate saver',
    'regular saver',
    'easy access',
  ],
  current_account: [
    'current account',
    'bank account',
    'advance account',
    'premier account',
    'graduate account',
    'student account',
    'joint account',
  ],
  isa: [
    'isa',
    'cash isa',
    'lifetime isa',
    'lisa',
    'individual savings account',
    'tax-free',
  ],

  // Products
  card: [
    'card',
    'credit card',
    'debit card',
    'bank card',
    'visa debit',
    'balance transfer card',
    'purchase card',
    'reward card',
    'cashback card',
    'contactless',
  ],
  mortgage: [
    'mortgage',
    'fixed rate mortgage',
    'tracker mortgage',
    'first time buyer',
    'buy to let',
    'remortgage',
    'green mortgage',
    'home loan',
  ],
  loan: [
    'loan',
    'personal loan',
    'car finance',
    'lending',
    'borrowing',
    'unsecured loan',
  ],
  insurance: [
    'insurance',
    'home insurance',
    'travel insurance',
    'life insurance',
    'buildings insurance',
    'contents insurance',
    'cover',
  ],
  transfer: [
    'transfer',
    'bank transfer',
    'send money',
    'payment',
    'direct debit',
    'standing order',
    'faster payment',
  ],
  digital: [
    'app',
    'mobile app',
    'mobile banking',
    'online banking',
    'internet banking',
    'connected money',
    'open banking',
  ],
  international: [
    'global money',
    'multi-currency',
    'international transfer',
    'foreign exchange',
    'travel money',
  ],

  // Issues
  fraud: [
    'fraud',
    'fraudulent',
    'unauthorized',
    'unauthorised',
    'stolen',
    'scam',
    'phishing',
    'suspicious',
  ],
  delay: [
    'delay',
    'delayed',
    'slow',
    'late',
    'pending',
    'processing',
    'waiting',
  ],
  error: [
    'error',
    'mistake',
    'wrong',
    'incorrect',
    'inaccurate',
    'discrepancy',
  ],

  // Customer Actions
  close: ['close', 'cancel', 'terminate', 'end', 'discontinue', 'stop'],
  open: ['open', 'start', 'begin', 'initiate', 'create', 'new'],
  change: ['change', 'update', 'modify', 'edit', 'revise', 'amend'],

  // Customer States
  churn: [
    'churn',
    'leaving',
    'left',
    'departed',
    'cancelled',
    'closed account',
    'attrition',
  ],
  retention: ['retain', 'retention', 'keep', 'stay', 'loyal', 'loyalty'],
  onboarding: [
    'onboarding',
    'new customer',
    'new account',
    'just opened',
    'recently joined',
  ],
};

// =============================================================================
// FIELD MAPPINGS
// =============================================================================

/**
 * Maps natural language field references to actual index fields
 */
export const FIELD_MAPPINGS: Record<string, string> = {
  // Content fields
  message: 'content',
  text: 'content',
  body: 'content',
  communication: 'content',

  // Customer fields
  customer: 'customerName',
  client: 'customerName',
  'customer name': 'customerName',
  'customer id': 'customerId',
  'account holder': 'customerName',

  // Metadata fields
  date: 'timestamp',
  time: 'timestamp',
  when: 'timestamp',
  sent: 'timestamp',
  received: 'timestamp',

  // Direction
  from: 'direction:inbound',
  'from customer': 'direction:inbound',
  to: 'direction:outbound',
  'to customer': 'direction:outbound',
  inbound: 'direction:inbound',
  outbound: 'direction:outbound',
  incoming: 'direction:inbound',
  outgoing: 'direction:outbound',

  // Status
  open: 'status:open',
  closed: 'status:closed',
  resolved: 'status:closed',
  pending: 'status:pending',
  unresolved: 'status:open',
};

// =============================================================================
// FORMATTERS
// =============================================================================

/**
 * Formats the glossary for inclusion in an LLM prompt.
 * Provides a compact but comprehensive reference for query translation.
 */
export function formatGlossaryForPrompt(): string {
  const sections: string[] = [];

  // Sentiment section
  sections.push(`## Sentiment Terms
When users mention these terms, map to sentiment.label field:
- POSITIVE: ${SENTIMENT_MAPPINGS.positive.slice(0, 8).join(', ')}...
- NEGATIVE: ${SENTIMENT_MAPPINGS.negative.slice(0, 8).join(', ')}...
- NEUTRAL: ${SENTIMENT_MAPPINGS.neutral.slice(0, 5).join(', ')}
- MIXED: ${SENTIMENT_MAPPINGS.mixed.slice(0, 3).join(', ')}`);

  // Channel section
  sections.push(`## Channel Terms
Map to channel field (keyword):
- email: ${CHANNEL_MAPPINGS.email.slice(0, 4).join(', ')}
- phone: ${CHANNEL_MAPPINGS.phone.slice(0, 5).join(', ')}
- chat: ${CHANNEL_MAPPINGS.chat.slice(0, 4).join(', ')}
- letter: ${CHANNEL_MAPPINGS.letter.slice(0, 4).join(', ')}
- social: ${CHANNEL_MAPPINGS.social.slice(0, 5).join(', ')}`);

  // Priority section
  sections.push(`## Priority/Urgency Terms
Map to priority field (keyword):
- critical: ${PRIORITY_MAPPINGS.critical.slice(0, 5).join(', ')}
- high: ${PRIORITY_MAPPINGS.high.slice(0, 4).join(', ')}
- medium: ${PRIORITY_MAPPINGS.medium.slice(0, 4).join(', ')}
- low: ${PRIORITY_MAPPINGS.low.slice(0, 4).join(', ')}`);

  // Domain synonyms section
  sections.push(`## Domain Synonyms (expand in searches)
- fee/charges: ${DOMAIN_SYNONYMS.fee.join(', ')}
- overdraft: ${DOMAIN_SYNONYMS.overdraft.join(', ')}
- fraud: ${DOMAIN_SYNONYMS.fraud.join(', ')}
- card: ${DOMAIN_SYNONYMS.card.slice(0, 8).join(', ')}...
- mortgage: ${DOMAIN_SYNONYMS.mortgage.slice(0, 6).join(', ')}...
- transfer: ${DOMAIN_SYNONYMS.transfer.join(', ')}
- churn: ${DOMAIN_SYNONYMS.churn.join(', ')}`);

  // Known products section
  sections.push(`## Known Products (HSBC-style retail banking)
When users mention these products, map to aiClassification.product field:
- Current Accounts: Advance Account, Premier Account, Bank Account, Graduate Account, Student Account, Joint Account
- Savings: Online Bonus Saver, Flexible Saver, Fixed Rate Saver, Regular Saver, Cash ISA, Lifetime ISA
- Mortgages: Fixed Rate Mortgage, Tracker Mortgage, First Time Buyer Mortgage, Buy to Let Mortgage, Green Mortgage, Remortgage
- Cards: Balance Transfer Credit Card, Purchase Credit Card, Reward Credit Card, Debit Card
- Loans: Personal Loan, Car Finance, Overdraft
- Insurance: Home Insurance, Travel Insurance, Life Insurance
- Digital: Mobile Banking App, Online Banking, Connected Money
- International: Global Money Account`);

  // Field mappings section
  sections.push(`## Field Mappings
User says → Use field:
- "message/text/body" → content (text field, use match)
- "customer/client" → customerName (text field)
- "date/when/sent" → timestamp (date field, use range)
- "from customer/incoming" → direction: "inbound"
- "to customer/outgoing" → direction: "outbound"`);

  return sections.join('\n\n');
}

/**
 * Formats a compact version of the glossary for constrained contexts
 */
export function formatCompactGlossary(): string {
  return `GLOSSARY:
Sentiment: positive(happy,pleased,satisfied) | negative(angry,upset,frustrated,complaint) | neutral | mixed
Channel: email | phone(call,voice) | chat | letter | social(twitter,linkedin)
Priority: critical(urgent,asap) | high(important) | medium | low
Synonyms: fee→charge,cost,rate | fraud→unauthorized,scam | card→credit,debit,contactless | mortgage→fixed rate,tracker,remortgage | churn→leaving,cancelled
Products: Advance Account, Premier Account, Online Bonus Saver, Cash ISA, Fixed Rate Mortgage, Balance Transfer Card, Personal Loan, Mobile Banking App`;
}

/**
 * Looks up synonyms for a given term
 */
export function getSynonyms(term: string): string[] {
  const lowerTerm = term.toLowerCase();

  // Check domain synonyms
  for (const [key, values] of Object.entries(DOMAIN_SYNONYMS)) {
    if (key === lowerTerm || values.includes(lowerTerm)) {
      return values;
    }
  }

  return [term];
}

/**
 * Maps a natural language sentiment term to the index value
 */
export function mapSentiment(term: string): string | null {
  const lowerTerm = term.toLowerCase();

  for (const [sentiment, terms] of Object.entries(SENTIMENT_MAPPINGS)) {
    if (terms.some((t) => lowerTerm.includes(t))) {
      return sentiment;
    }
  }

  return null;
}

/**
 * Maps a natural language channel term to the index value
 */
export function mapChannel(term: string): string | null {
  const lowerTerm = term.toLowerCase();

  for (const [channel, terms] of Object.entries(CHANNEL_MAPPINGS)) {
    if (terms.some((t) => lowerTerm.includes(t))) {
      return channel;
    }
  }

  return null;
}

/**
 * Maps a natural language priority term to the index value
 */
export function mapPriority(term: string): string | null {
  const lowerTerm = term.toLowerCase();

  for (const [priority, terms] of Object.entries(PRIORITY_MAPPINGS)) {
    if (terms.some((t) => lowerTerm.includes(t))) {
      return priority;
    }
  }

  return null;
}
