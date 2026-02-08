/**
 * Communication Generator
 *
 * Generates synthetic customer communications for retail banking.
 */

import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  SyntheticCommunication,
  SyntheticCustomer,
  SyntheticAIClassification,
  SyntheticCommunicationMessage,
} from '../synthetic-data.types';
import {
  randomChoice,
  weightedChoice,
  randomSubset,
  randomDate,
  getSentimentScore,
} from '../utils/random.util';
import { PRODUCT_NAMES, PRODUCT_SLUGS, KNOWN_PRODUCTS } from '../data/products';

// Communication templates by channel and sentiment - Retail Banking UK
const EMAIL_TEMPLATES = {
  positive: [
    {
      subject: 'Thank you for your excellent service',
      template: `Dear {manager},

I wanted to express my sincere thanks for the help I received with my {product}. The way you handled my {action} was really impressive.

It is refreshing to get such good customer service. I have been with {bank} for {years} years now and experiences like this remind me why I stay.

I will certainly be recommending you to friends and family.

Kind regards,
{name}`,
    },
    {
      subject: 'Re: Account Update',
      template: `Hi {manager},

Thank you for sorting out my {issue} so quickly. I really appreciate you getting back to me the same day.

The new {product} is working perfectly now. Much easier than before!

Thanks again,
{name}`,
    },
    {
      subject: 'Great experience with mobile app',
      template: `Hello,

I just wanted to say how impressed I am with the new mobile banking app. Setting up {action} was so simple and straightforward.

The fingerprint login is really convenient too. Great job on the update!

Best wishes,
{name}`,
    },
  ],
  negative: [
    {
      subject: 'Urgent: Problem with my direct debit',
      template: `Dear Sir/Madam,

I am extremely frustrated. My {action} has failed for the {count} time this month, causing me to be charged late fees by {third_party}.

I have called your customer service line {count} times already and each time I am told it has been resolved. Clearly it has not.

I need this sorted immediately or I will have no choice but to move my account elsewhere.

{name}
Account: ****{account_suffix}`,
    },
    {
      subject: 'Complaint: Unauthorised charges',
      template: `To Customer Services,

I have noticed £{fee_amount} in charges on my latest statement that I never agreed to. This includes monthly fees and overdraft charges.

This is the {count} time I have had to chase up incorrect charges. It is not good enough.

I expect a full refund and a proper explanation within 5 working days.

{name}`,
    },
    {
      subject: 'Still waiting for new card',
      template: `Hello,

I reported my card lost {days} days ago and I STILL do not have a replacement. I was told 3-5 working days but it has now been {days} days.

I cannot pay for anything, cannot use contactless, cannot do online shopping. This is really affecting my daily life.

What is going on? I need answers.

{name}`,
    },
  ],
  neutral: [
    {
      subject: 'Request for bank statement',
      template: `Dear Sir/Madam,

Could you please send me a bank statement covering the last {months} months? I need this for {reason}.

Please post it to my registered address.

Thank you,
{name}`,
    },
    {
      subject: 'Question about savings accounts',
      template: `Hello,

I am looking at your savings account options and wondered if you could help with some questions:

1. What is the current interest rate on your {product}?
2. Is there a minimum deposit?
3. Can I set up a regular standing order into it?

Thanks in advance,
{name}`,
    },
    {
      subject: 'Change of address',
      template: `Hi,

Please update my address on your records to:

{address}

My old address was {old_address}.

Could you confirm once this has been updated?

Thanks,
{name}`,
    },
  ],
  mixed: [
    {
      subject: 'Re: Recent experience - feedback',
      template: `Dear {manager},

I wanted to share some thoughts on my recent visit to your branch.

The staff member who helped me was lovely and really patient with my questions about {product}. She explained everything clearly and I left feeling confident about my decision.

However, I had to wait {duration} minutes to be seen despite having an appointment, which was frustrating as I had taken time off work.

Perhaps the booking system could be improved? Otherwise, the service itself was excellent.

Best regards,
{name}`,
    },
  ],
};

const PHONE_TEMPLATES = {
  positive: [
    'Customer called to thank us for quick resolution of {issue}. Very pleased with service from branch staff. Mentioned likely to recommend {bank} to family. Duration: {duration} mins.',
    'Inbound call - customer happy with new {product}. Said app notifications are helpful. Interested in setting up regular savings. Call duration: {duration} mins.',
    'Customer rang to praise mobile banking experience. Found {action} process really straightforward. Compared favourably to previous bank. Duration: {duration} mins.',
  ],
  negative: [
    'Escalation call - customer unable to access funds for {days} days due to security block. Very distressed. Urgent review needed.',
    'Complaint call - customer charged £{fee_amount} in overdraft fees but claims no notification. Demanding refund. {count} previous complaints on file. Duration: {duration} mins.',
    'Customer called about failed {action}. This is {count}rd call on same issue. Getting increasingly frustrated. Threatened to involve Financial Ombudsman.',
  ],
  neutral: [
    'Balance inquiry call. Confirmed current balance and recent transactions. Customer asked about {product} rates. Literature to be sent.',
    'Customer called to check status of {action} request submitted {days} days ago. Confirmed processing, completion expected within 3 working days.',
    'Routine call to update registered mobile number. Identity verified, change processed. SMS confirmation sent.',
  ],
  mixed: [
    'Customer called about unexpected {product} changes. Initially frustrated but calmed after explanation. Agreed to new terms but requested written confirmation. Duration: {duration} mins.',
  ],
};

const CHAT_TEMPLATES = {
  positive: [
    'Thanks so much for your help with my {action}! All sorted now. Great service!',
    'Just wanted to say the new app is brilliant. So easy to use!',
    'Your advisor was really patient explaining the {product} options. Really appreciated!',
  ],
  negative: [
    'Been waiting {duration} minutes for someone to respond. This is ridiculous.',
    'Your chatbot is useless. Just keeps going in circles. I need to speak to a real person NOW',
    'Why does it take {days} days to process a simple {action}? My old bank did it instantly',
  ],
  neutral: [
    'Hi, can I check my account balance please?',
    'What time does the Manchester branch close today?',
    'How do I set up a standing order?',
  ],
  mixed: [
    'Finally got through after {duration} mins waiting. Issue resolved but the wait was too long.',
  ],
};

const LETTER_TEMPLATES = {
  positive: [
    {
      subject: 'Letter of appreciation',
      template: `Dear Sir/Madam,

I am writing to express my thanks for the outstanding service I received from your {region} branch regarding my {product}.

The member of staff who assisted me was professional, patient and went above and beyond to resolve my {issue}. This level of service is exactly what I expect from my bank.

Yours faithfully,
{name}`,
    },
  ],
  negative: [
    {
      subject: 'Formal complaint',
      template: `Dear Customer Services Manager,

I wish to make a formal complaint regarding the handling of my {product} at your {region} branch.

Despite raising this issue on {count} separate occasions over the past {days} days, I have received no satisfactory resolution. I was assured the matter would be dealt with promptly, yet £{fee_amount} in charges remain on my account.

I expect a written response within 8 weeks as required under FCA guidelines, failing which I shall refer this matter to the Financial Ombudsman Service.

Yours faithfully,
{name}`,
    },
  ],
  neutral: [
    {
      subject: 'Account correspondence',
      template: `Dear Sir/Madam,

Please find enclosed the documentation you requested for my {product} application. I have included proof of address and identification as specified.

Could you kindly confirm receipt and advise on the expected processing time?

Yours faithfully,
{name}`,
    },
  ],
  mixed: [
    {
      subject: 'Feedback on recent service',
      template: `Dear {manager},

I am writing regarding my recent experience with your {product} service. Whilst I appreciate the eventual resolution of my {issue}, the {days}-day wait was unacceptable for a customer of {years} years standing.

I trust this feedback will be taken on board.

Yours sincerely,
{name}`,
    },
  ],
};

const SOCIAL_TEMPLATES = {
  positive: [
    'Just had a great experience sorting out my {action} with @JourneyWorksBank. Proper helpful! 👍',
    'Shout out to @JourneyWorksBank for resolving my {issue} so quickly. This is how banking should be! ⭐',
    '@JourneyWorksBank the new app update is brilliant. {action} is so much easier now!',
  ],
  negative: [
    '@JourneyWorksBank why is my {action} STILL not sorted after {days} days?? Absolutely shocking service 😡',
    'Anyone else had issues with @JourneyWorksBank {product}? Been trying to resolve my {issue} for weeks #frustrated',
    '@JourneyWorksBank charged me £{fee_amount} with no warning. How is that acceptable? #bankfail',
  ],
  neutral: [
    'Does anyone bank with @JourneyWorksBank? Thinking of switching. How is their {product}?',
    '@JourneyWorksBank what are your branch opening hours in {region}?',
    'Need to do a {action} with @JourneyWorksBank tomorrow. Anyone know if I can do it online?',
  ],
  mixed: [
    '@JourneyWorksBank love the mobile app but the {action} process needs work. Took {duration} mins to complete.',
  ],
};

// Retail banking products — imported from shared catalogue
const PRODUCTS = PRODUCT_NAMES;

const ACTIONS = [
  'direct debit',
  'standing order',
  'card payment',
  'bank transfer',
  'contactless payment',
  'Apple Pay setup',
  'password reset',
  'card replacement',
  'account upgrade',
  'overdraft application',
  'loan repayment',
  'address change',
  'PIN change',
  'account closure',
  'fraud dispute',
];

const ISSUES = [
  'failed payment',
  'card decline',
  'login problem',
  'app error',
  'missing transaction',
  'delayed transfer',
  'incorrect balance',
  'unrecognised charge',
  'duplicate payment',
  'direct debit failure',
  'statement error',
  'security alert',
  'blocked account',
];

const THIRD_PARTIES = [
  'my landlord',
  'my electricity supplier',
  'my council tax',
  'my mobile provider',
  'Netflix',
  'my gym',
  'Amazon',
  'my insurance company',
];

const REASONS = [
  'a mortgage application',
  'visa application',
  'proof of address',
  'council housing application',
  'my accountant',
  'a loan application',
];

const UK_ADDRESSES = [
  '42 Oak Lane, Croydon, CR0 5AB',
  '18 Victoria Road, Leeds, LS1 6QT',
  '7 Church Street, Bristol, BS1 5PJ',
  '156 High Street, Manchester, M1 2ER',
  '23 Station Road, Birmingham, B1 3RT',
];

const INTENTS = {
  positive: [
    { primary: 'feedback', secondary: ['appreciation', 'recommendation'] },
    { primary: 'inquiry', secondary: ['product_interest', 'upgrade'] },
    { primary: 'appreciation', secondary: ['feedback'] },
  ],
  negative: [
    { primary: 'complaint', secondary: ['refund_request', 'escalation'] },
    { primary: 'escalation', secondary: ['complaint', 'ombudsman_threat'] },
    { primary: 'dispute', secondary: ['chargeback', 'fraud_claim'] },
  ],
  neutral: [
    { primary: 'inquiry', secondary: ['balance_check', 'product_info'] },
    { primary: 'request', secondary: ['statement', 'card_order'] },
    { primary: 'update', secondary: ['address_change', 'contact_update'] },
  ],
  mixed: [
    { primary: 'feedback', secondary: ['complaint', 'appreciation'] },
    { primary: 'inquiry', secondary: ['concern', 'suggestion'] },
  ],
};

const EMOTIONAL_TONES = {
  positive: ['appreciative', 'satisfied', 'grateful', 'relieved', 'happy'],
  negative: ['frustrated', 'angry', 'disappointed', 'anxious', 'stressed'],
  neutral: ['matter-of-fact', 'professional', 'curious', 'calm'],
  mixed: ['concerned', 'cautiously optimistic', 'unsure', 'hopeful'],
};

const TAGS = [
  'priority-customer',
  'complaint',
  'urgent',
  'follow-up-required',
  'fee-waiver-requested',
  'escalated',
  'resolved',
  'vulnerable-customer',
  'fraud-alert',
  'documentation-needed',
  'branch-referral',
  'retention-risk',
];

// AI Classification data for synthetic generation
// These categories align with the case categories from case-categories.ts
const AI_CATEGORIES = {
  positive: ['call-handling', 'account-opening'],
  negative: [
    'fees-charges',
    'payment-processing',
    'cdd-remediation',
    'account-opening',
  ],
  neutral: ['call-handling', 'account-opening', 'payment-processing'],
  mixed: ['call-handling', 'fees-charges', 'cdd-remediation'],
};

// AI classification product slugs — imported from shared catalogue
const AI_PRODUCTS = PRODUCT_SLUGS;

const ISSUE_TYPES = {
  'account-opening': [
    'Application not processed',
    'Card not received',
    'ID verification issue',
    'Credit limit query',
    'Application declined',
    'Incorrect account details',
  ],
  'call-handling': [
    'Call disconnected',
    'Incorrect information provided',
    'No follow-up on callback',
    'Poor communication',
    'Long wait time',
    'Transferred to wrong department',
    'Unable to resolve issue',
  ],
  'cdd-remediation': [
    'Account closed unexpectedly',
    'Cannot provide documents',
    'Communication tone concern',
    'Account restrictions',
    'CDD review delays',
    'Disagree with decision',
  ],
  'fees-charges': [
    'Unexpected fee charged',
    'Fee not refunded',
    'Cannot afford charges',
    'Fee from wrong account',
    'Exchange rate issue',
    'Fee too high',
  ],
  'payment-processing': [
    'Payment not processed',
    'Payment declined',
    'Fraud block on legitimate payment',
    'Payment not received by payee',
    'Payment delayed',
    'Incorrect payment information',
  ],
};

const ROOT_CAUSES = {
  'account-opening': [
    'Processing backlog',
    'Documentation issue',
    'System error',
    'Criteria not met',
    'Manual review required',
  ],
  'call-handling': [
    'Staff training gap',
    'High call volume',
    'System issues',
    'Process complexity',
    'Resource constraints',
  ],
  'cdd-remediation': [
    'Regulatory requirement',
    'Risk assessment trigger',
    'Documentation gap',
    'Policy compliance',
    'Third-party verification',
  ],
  'fees-charges': [
    'Terms misunderstanding',
    'System calculation',
    'Policy change',
    'Account status change',
    'Product change',
  ],
  'payment-processing': [
    'Technical error',
    'Insufficient funds',
    'Fraud prevention trigger',
    'Payee bank issue',
    'Processing delay',
  ],
};

const SUGGESTED_ACTIONS = {
  positive: [
    'Send thank you acknowledgement',
    'Note for relationship manager',
    'Cross-sell opportunity flag',
    'Loyalty programme offer',
  ],
  negative: [
    'Escalate to complaints team',
    'Arrange callback within 24h',
    'Issue compensation',
    'Refer to specialist team',
  ],
  neutral: [
    'Process standard request',
    'Send information pack',
    'Update customer records',
    'Schedule follow-up',
  ],
  mixed: [
    'Review with team lead',
    'Partial resolution + follow-up',
    'Customer education call',
    'Service recovery offer',
  ],
};

const REGULATORY_FLAGS = [
  'FCA-Consumer-Duty',
  'Vulnerable-Customer-Protocol',
  'Complaint-Escalation-Required',
  'Data-Protection-Review',
  'Financial-Ombudsman-Risk',
  'Anti-Money-Laundering',
  'KYC-Update-Required',
];

@Injectable()
export class CommunicationGenerator {
  generate(
    customer: SyntheticCustomer,
    channel: 'email' | 'phone' | 'chat' | 'letter' | 'social',
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed',
    timestamp: Date,
    caseId?: string,
  ): SyntheticCommunication {
    const templates = this.getTemplates(channel);
    const templateList = templates[sentiment] || templates.neutral;
    const template = randomChoice(templateList);

    const content = this.fillTemplate(
      typeof template === 'string' ? template : template.template,
      customer,
    );

    const subject =
      typeof template === 'object' && template.subject
        ? this.fillTemplate(template.subject, customer)
        : undefined;

    const intentConfig = randomChoice(INTENTS[sentiment]);
    const tones = EMOTIONAL_TONES[sentiment];

    const entities = this.extractEntities(content, customer);

    // Generate status and priority based on sentiment
    const status = this.generateStatus(sentiment);
    const priority = this.generatePriority(sentiment, customer.tier);

    // Generate AI classification
    const aiClassification = this.generateAIClassification(sentiment, content);

    // Generate message thread (for chat/email channels, ~40% chance of having thread)
    const hasThread =
      (channel === 'chat' || channel === 'email') && Math.random() > 0.6;
    const threadId = hasThread ? uuidv4() : undefined;
    const messages = hasThread
      ? this.generateMessageThread(
          customer,
          channel,
          sentiment,
          timestamp,
          content,
        )
      : undefined;

    // Determine chatMode for chat channel
    let chatMode: 'chatbot' | 'human-agent' | undefined;
    let escalatedFrom: 'chatbot' | 'email' | 'chat' | undefined;

    if (channel === 'chat') {
      // For chat, determine if it's chatbot or human agent
      // Negative sentiment and escalated status more likely to be human agent
      if (status === 'escalated' || sentiment === 'negative') {
        chatMode = weightedChoice([
          ['human-agent', 0.7],
          ['chatbot', 0.3],
        ]) as 'chatbot' | 'human-agent';
        // If human agent, it might be escalated from chatbot
        if (chatMode === 'human-agent' && Math.random() > 0.5) {
          escalatedFrom = 'chatbot';
        }
      } else {
        chatMode = weightedChoice([
          ['chatbot', 0.6],
          ['human-agent', 0.4],
        ]) as 'chatbot' | 'human-agent';
      }
    } else if (channel === 'phone' && status === 'escalated') {
      // Phone escalations might come from chat or email
      escalatedFrom = weightedChoice([
        ['chatbot', 0.4],
        ['chat', 0.3],
        ['email', 0.3],
      ]) as 'chatbot' | 'email' | 'chat';
    }

    return {
      id: uuidv4(),
      channel,
      chatMode,
      escalatedFrom,
      direction: weightedChoice([
        ['inbound', 0.7],
        ['outbound', 0.3],
      ]) as 'inbound' | 'outbound',
      customerId: customer.id,
      customerName: customer.name,
      caseId,
      subject,
      content,
      summary: this.generateSummary(content, sentiment, channel),
      timestamp: timestamp.toISOString(),
      status,
      priority,
      sentiment: {
        label: sentiment,
        score: getSentimentScore(sentiment),
        confidence: 0.8 + Math.random() * 0.19,
        emotionalTones: randomSubset(tones, 1, 3),
      },
      intent: {
        primary: intentConfig.primary,
        secondary: intentConfig.secondary,
        confidence: 0.75 + Math.random() * 0.24,
      },
      entities,
      tags: this.generateTags(sentiment, customer.tier),
      metadata: {
        duration:
          channel === 'phone' ? Math.floor(5 + Math.random() * 25) : undefined,
        agentId: `AGT-${Math.floor(1000 + Math.random() * 9000)}`,
        resolved: Math.random() > 0.3,
      },
      aiClassification,
      messages,
      threadId,
    };
  }

  /**
   * Generate status based on sentiment
   */
  private generateStatus(
    sentiment: string,
  ): 'open' | 'in_progress' | 'resolved' | 'escalated' {
    if (sentiment === 'negative') {
      return weightedChoice([
        ['open', 0.3],
        ['in_progress', 0.4],
        ['escalated', 0.2],
        ['resolved', 0.1],
      ]) as 'open' | 'in_progress' | 'resolved' | 'escalated';
    }
    return weightedChoice([
      ['open', 0.2],
      ['in_progress', 0.2],
      ['resolved', 0.6],
    ]) as 'open' | 'in_progress' | 'resolved' | 'escalated';
  }

  /**
   * Generate priority based on sentiment and customer tier
   */
  private generatePriority(
    sentiment: string,
    tier: string,
  ): 'low' | 'medium' | 'high' | 'urgent' {
    const isHighValue = tier === 'platinum' || tier === 'gold';

    if (sentiment === 'negative') {
      if (isHighValue) {
        return weightedChoice([
          ['urgent', 0.4],
          ['high', 0.4],
          ['medium', 0.2],
        ]) as 'low' | 'medium' | 'high' | 'urgent';
      }
      return weightedChoice([
        ['urgent', 0.1],
        ['high', 0.3],
        ['medium', 0.4],
        ['low', 0.2],
      ]) as 'low' | 'medium' | 'high' | 'urgent';
    }

    if (isHighValue) {
      return weightedChoice([
        ['high', 0.2],
        ['medium', 0.5],
        ['low', 0.3],
      ]) as 'low' | 'medium' | 'high' | 'urgent';
    }

    return weightedChoice([
      ['medium', 0.3],
      ['low', 0.7],
    ]) as 'low' | 'medium' | 'high' | 'urgent';
  }

  /**
   * Generate AI classification for the communication
   */
  private generateAIClassification(
    sentiment: string,
    content: string,
  ): SyntheticAIClassification {
    const categoryOptions = AI_CATEGORIES[sentiment] || AI_CATEGORIES.neutral;
    const category = randomChoice(categoryOptions) as keyof typeof ISSUE_TYPES;
    const product = randomChoice(AI_PRODUCTS);

    const issueTypes = ISSUE_TYPES[category] || ['General enquiry'];
    const rootCauses = ROOT_CAUSES[category] || ['Standard process'];
    const suggestedActions =
      SUGGESTED_ACTIONS[sentiment] || SUGGESTED_ACTIONS.neutral;

    // Determine urgency based on sentiment and content
    let urgency: 'low' | 'medium' | 'high' | 'critical';
    if (
      sentiment === 'negative' &&
      (content.toLowerCase().includes('urgent') ||
        content.toLowerCase().includes('immediately'))
    ) {
      urgency = 'critical';
    } else if (sentiment === 'negative') {
      urgency = weightedChoice([
        ['high', 0.6],
        ['critical', 0.2],
        ['medium', 0.2],
      ]) as 'low' | 'medium' | 'high' | 'critical';
    } else {
      urgency = weightedChoice([
        ['low', 0.5],
        ['medium', 0.4],
        ['high', 0.1],
      ]) as 'low' | 'medium' | 'high' | 'critical';
    }

    // Generate regulatory flags (more likely for negative sentiment or CDD category)
    const regulatoryFlags: string[] = [];
    if (category === 'cdd-remediation') {
      regulatoryFlags.push('Anti-Money-Laundering');
      if (Math.random() > 0.5) regulatoryFlags.push('FCA-Consumer-Duty');
      if (Math.random() > 0.6) regulatoryFlags.push('KYC-Update-Required');
    }
    if (sentiment === 'negative') {
      if (Math.random() > 0.7)
        regulatoryFlags.push('Complaint-Escalation-Required');
      if (Math.random() > 0.8)
        regulatoryFlags.push('Vulnerable-Customer-Protocol');
      if (Math.random() > 0.9) regulatoryFlags.push('Financial-Ombudsman-Risk');
    }

    return {
      category: category as SyntheticAIClassification['category'],
      confidence: 0.75 + Math.random() * 0.24,
      product: product as SyntheticAIClassification['product'],
      issueType: randomChoice(issueTypes),
      urgency,
      rootCause: randomChoice(rootCauses),
      suggestedAction: randomChoice(suggestedActions),
      regulatoryFlags,
    };
  }

  /**
   * Generate a message thread for the communication
   */
  private generateMessageThread(
    customer: SyntheticCustomer,
    channel: 'email' | 'phone' | 'chat' | 'letter' | 'social',
    sentiment: string,
    baseTimestamp: Date,
    originalContent: string,
  ): SyntheticCommunicationMessage[] {
    const messages: SyntheticCommunicationMessage[] = [];
    const threadLength = Math.floor(2 + Math.random() * 4); // 2-5 messages

    // First message is from customer (the original content)
    let currentTime = new Date(baseTimestamp);
    messages.push({
      id: uuidv4(),
      timestamp: currentTime.toISOString(),
      sender: 'customer',
      channel,
      content: originalContent,
      sentiment: getSentimentScore(sentiment),
    });

    // Generate back-and-forth
    for (let i = 1; i < threadLength; i++) {
      // Add time gap (1-24 hours for email, 1-5 minutes for chat)
      const timeGap =
        channel === 'chat'
          ? Math.floor(1 + Math.random() * 5) * 60 * 1000 // minutes
          : Math.floor(1 + Math.random() * 24) * 60 * 60 * 1000; // hours
      currentTime = new Date(currentTime.getTime() + timeGap);

      const isAgent = i % 2 === 1; // Alternate between agent and customer
      const messageContent = isAgent
        ? this.generateAgentResponse(sentiment, i === threadLength - 1)
        : this.generateCustomerFollowup(sentiment);

      messages.push({
        id: uuidv4(),
        timestamp: currentTime.toISOString(),
        sender: isAgent ? 'agent' : 'customer',
        channel,
        content: messageContent,
        sentiment: isAgent ? 0.5 : getSentimentScore(sentiment) * (1 - i * 0.1), // Agent neutral, customer sentiment improves
      });
    }

    return messages;
  }

  /**
   * Generate agent response content
   */
  private generateAgentResponse(sentiment: string, isFinal: boolean): string {
    const greetings = [
      'Thank you for contacting us.',
      'I appreciate you reaching out.',
      'Thank you for your message.',
    ];

    const acknowledgements = {
      negative: [
        'I understand your frustration and I apologise for the inconvenience.',
        "I'm sorry to hear about this issue. Let me look into it right away.",
        "I can see why this would be concerning. I'm here to help.",
      ],
      positive: [
        "It's great to hear from you!",
        'Thank you for your kind words.',
        'We really appreciate your feedback.',
      ],
      neutral: [
        "I'd be happy to help with your request.",
        'Let me assist you with that.',
        'I can certainly help you with this.',
      ],
    };

    const closings = {
      final: [
        'Is there anything else I can help you with today?',
        "Please don't hesitate to reach out if you have any further questions.",
        'Thank you for your patience. Have a great day!',
      ],
      ongoing: [
        "I'll get back to you shortly with an update.",
        'Please allow me some time to investigate this further.',
        "I'm working on this now and will update you soon.",
      ],
    };

    const ack = randomChoice(
      acknowledgements[sentiment] || acknowledgements.neutral,
    );
    const closing = randomChoice(isFinal ? closings.final : closings.ongoing);

    return `${randomChoice(greetings)} ${ack} ${closing}`;
  }

  /**
   * Generate customer follow-up content
   */
  private generateCustomerFollowup(sentiment: string): string {
    const followups = {
      negative: [
        "Any update on this? It's been a while.",
        "I still haven't heard back. This is getting frustrating.",
        'Please can someone help me with this urgently?',
      ],
      positive: [
        'Thank you so much for your help!',
        "That's exactly what I needed. Thanks!",
        'Really appreciate the quick response.',
      ],
      neutral: [
        "Thanks for the update. I'll wait to hear back.",
        'OK, let me know when you have more information.',
        "Understood. I'll look out for your next message.",
      ],
      mixed: [
        'Thanks for looking into this. Hope we can get it sorted.',
        "Appreciate the response, though I'm still a bit confused.",
        'OK, I understand. Just want to make sure this gets resolved.',
      ],
    };

    return randomChoice(followups[sentiment] || followups.neutral);
  }

  generateForCustomer(
    customer: SyntheticCustomer,
    count: number,
    channelDistribution: Record<string, number>,
    sentimentDistribution: Record<string, number>,
    dateRange: { start: Date; end: Date },
    caseId?: string,
  ): SyntheticCommunication[] {
    const communications: SyntheticCommunication[] = [];

    for (let i = 0; i < count; i++) {
      const channel = weightedChoice(
        Object.entries(channelDistribution).map(([k, v]) => [k, v]),
      ) as 'email' | 'phone' | 'chat' | 'letter' | 'social';

      const sentiment = weightedChoice(
        Object.entries(sentimentDistribution).map(([k, v]) => [k, v]),
      ) as 'positive' | 'negative' | 'neutral' | 'mixed';

      const timestamp = randomDate(dateRange.start, dateRange.end);

      communications.push(
        this.generate(customer, channel, sentiment, timestamp, caseId),
      );
    }

    communications.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    return communications;
  }

  private getTemplates(channel: string): Record<string, any[]> {
    switch (channel) {
      case 'email':
        return EMAIL_TEMPLATES;
      case 'letter':
        return LETTER_TEMPLATES;
      case 'phone':
        return PHONE_TEMPLATES;
      case 'chat':
        return CHAT_TEMPLATES;
      case 'social':
        return SOCIAL_TEMPLATES;
      default:
        return EMAIL_TEMPLATES;
    }
  }

  private fillTemplate(template: string, customer: SyntheticCustomer): string {
    const replacements: Record<string, string> = {
      '{name}': customer.name,
      '{manager}': customer.relationshipManager,
      '{bank}': 'JourneyWorks Bank',
      '{product}': randomChoice(PRODUCTS),
      '{action}': randomChoice(ACTIONS),
      '{issue}': randomChoice(ISSUES),
      '{third_party}': randomChoice(THIRD_PARTIES),
      '{reason}': randomChoice(REASONS),
      '{days}': String(Math.floor(2 + Math.random() * 12)),
      '{months}': String(Math.floor(1 + Math.random() * 6)),
      '{years}': String(Math.floor(2 + Math.random() * 15)),
      '{count}': String(Math.floor(2 + Math.random() * 5)),
      '{fee_amount}': String(Math.floor(15 + Math.random() * 85)),
      '{amount}': this.formatCurrency(50 + Math.random() * 500),
      '{duration}': String(Math.floor(5 + Math.random() * 25)),
      '{distance}': String(Math.floor(5 + Math.random() * 20)),
      '{region}': customer.region,
      '{phone}': '+44 7' + this.randomDigits(9),
      '{address}': randomChoice(UK_ADDRESSES),
      '{old_address}': '99 Previous Street, Old Town, OT1 2AB',
      '{account_suffix}': this.randomDigits(4),
    };

    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(
        new RegExp(key.replace(/[{}]/g, '\$&'), 'g'),
        value,
      );
    }

    return result;
  }

  private randomDigits(count: number): string {
    let result = '';
    for (let i = 0; i < count; i++) {
      result += Math.floor(Math.random() * 10);
    }
    return result;
  }

  private extractEntities(
    content: string,
    customer: SyntheticCustomer,
  ): Array<{ type: string; value: string; confidence: number }> {
    const entities: Array<{ type: string; value: string; confidence: number }> =
      [];

    entities.push({
      type: 'person',
      value: customer.name,
      confidence: 0.95,
    });

    for (const product of KNOWN_PRODUCTS) {
      const terms = [product.name, ...product.aliases];
      if (terms.some((t) => content.toLowerCase().includes(t.toLowerCase()))) {
        entities.push({
          type: 'product',
          value: product.name,
          confidence: 0.85 + Math.random() * 0.14,
        });
        break;
      }
    }

    const amountMatch = content.match(/GBP[\d,]+/);
    if (amountMatch) {
      entities.push({
        type: 'monetary_amount',
        value: amountMatch[0],
        confidence: 0.92,
      });
    }

    return entities;
  }

  private generateSummary(
    content: string,
    sentiment: string,
    channel: string,
  ): string {
    const sentimentText = {
      positive: 'satisfied',
      negative: 'frustrated',
      neutral: 'neutral',
      mixed: 'mixed sentiment',
    };

    const channelText = {
      email: 'Email',
      phone: 'Phone call',
      chat: 'Chat session',
      letter: 'Letter',
      social: 'Social message',
    };

    const sentences = content
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 10);
    const keySentence =
      sentences.length > 0
        ? sentences[0].trim().substring(0, 100)
        : 'Communication received';

    return `${channelText[channel] || 'Communication'} - ${sentimentText[sentiment] || 'neutral'} customer. ${keySentence}...`;
  }

  private generateTags(sentiment: string, tier: string): string[] {
    const tags: string[] = [];

    if (tier === 'platinum' || tier === 'gold') {
      tags.push('priority-customer');
    }

    if (sentiment === 'negative') {
      tags.push('follow-up-required');
      if (Math.random() > 0.5) tags.push('escalated');
      if (tier === 'platinum') tags.push('retention-risk');
      tags.push('complaint');
    }

    if (Math.random() > 0.85) {
      tags.push(randomChoice(TAGS.filter((t) => !tags.includes(t))));
    }

    return tags;
  }

  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }
}
