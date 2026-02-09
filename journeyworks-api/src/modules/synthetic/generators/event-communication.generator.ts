/**
 * Event-Correlated Communication Generator
 *
 * Generates communications that are explicitly linked to timeline events.
 * These communications have:
 *  - Dates clustered around the event (±2 days)
 *  - Matching product references
 *  - Content that references the event type (outage, launch, etc.)
 *  - relatedEventId field for explicit linkage
 *
 * This ensures that when the AI Research panel retrieves evidence for an event,
 * it finds topically relevant communications instead of random ones.
 */

import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  SyntheticCommunication,
  SyntheticEvent,
  SyntheticCustomer,
  SyntheticAIClassification,
} from '../synthetic-data.types';
import {
  randomChoice,
  weightedChoice,
  randomSubset,
  getSentimentScore,
} from '../utils/random.util';
import { PRODUCT_SLUGS, findProductBySlug } from '../data/products';

// ─── Event-Specific Communication Templates ─────────────────────────────────
// Each event type has templates for different channels and sentiments.
// Templates use {event_label}, {event_description}, {product}, {name} placeholders.

interface EventCommTemplate {
  subject?: string;
  template: string;
  sentiment: 'negative' | 'positive' | 'neutral' | 'mixed';
  channel: 'email' | 'phone' | 'chat' | 'social';
}

const OUTAGE_TEMPLATES: EventCommTemplate[] = [
  {
    subject: 'Cannot access my account - {event_label}',
    template:
      'Dear Customer Services,\n\nI have been unable to access my {product} since yesterday. I keep getting error messages when trying to log in. This is completely unacceptable as I need to make urgent payments.\n\nI understand there has been an {event_label} but I need this resolved immediately. My bills are due and I cannot even check my balance.\n\nPlease advise when this will be fixed.\n\n{name}',
    sentiment: 'negative',
    channel: 'email',
  },
  {
    subject: 'Re: Service disruption - {event_label}',
    template:
      "I am writing to express my frustration with the ongoing {event_label}. I've been a loyal customer for over 10 years and this is the worst service disruption I've experienced.\n\nMy {product} has been inaccessible for hours. I missed a direct debit payment because of this and now face late payment charges from my utility company.\n\nI expect full compensation for any charges incurred.\n\n{name}",
    sentiment: 'negative',
    channel: 'email',
  },
  {
    subject: 'Payment failed due to {event_label}',
    template:
      'To whom it may concern,\n\nMy card payment was declined at the supermarket today. I was told this is related to the {event_label} your bank is experiencing.\n\nThis was extremely embarrassing. I had a full trolley of shopping and had to leave it behind. My {product} should be working - I have more than enough funds.\n\nThis is not good enough.\n\n{name}',
    sentiment: 'negative',
    channel: 'email',
  },
  {
    template:
      '@JourneyWorksBank your {event_label} is a joke. Been trying to use my {product} all day and nothing works. Sort it out! #bankfail #frustrated',
    sentiment: 'negative',
    channel: 'social',
  },
  {
    template:
      '@JourneyWorksBank still experiencing issues with {event_label}. When will services be back to normal? Need to access my {product} urgently 😤',
    sentiment: 'negative',
    channel: 'social',
  },
  {
    template:
      'Heads up everyone - @JourneyWorksBank is having a {event_label}. My {product} transactions are failing. Anyone else affected? #banking',
    sentiment: 'negative',
    channel: 'social',
  },
  {
    template:
      "Customer called extremely upset about the {event_label}. Unable to make payments via {product}. Customer has been trying since this morning. Requested a callback when services are restored. Offered goodwill gesture of £25 but customer says that's insufficient.",
    sentiment: 'negative',
    channel: 'phone',
  },
  {
    template:
      "Customer rang about the {event_label}. They couldn't complete a transfer via their {product}. Advised customer of the known issue and estimated resolution time. Customer was understanding but asked to be notified when it's fixed.",
    sentiment: 'mixed',
    channel: 'phone',
  },
  {
    template:
      "Hi, I can't seem to make any payments on my {product}. Is this related to the {event_label} I saw mentioned on Twitter?",
    sentiment: 'negative',
    channel: 'chat',
  },
  {
    template:
      "Just wanted to check - is the {event_label} affecting my {product}? I'm getting timeout errors when trying to log in.",
    sentiment: 'neutral',
    channel: 'chat',
  },
];

const LAUNCH_TEMPLATES: EventCommTemplate[] = [
  {
    subject: 'Excited about the {event_label}!',
    template:
      "Dear Team,\n\nI just wanted to say how pleased I am with the {event_label}. I've been waiting for something like this and it works brilliantly with my {product}.\n\nThe new features are exactly what I needed. Well done to your team!\n\nBest regards,\n{name}",
    sentiment: 'positive',
    channel: 'email',
  },
  {
    subject: 'Question about {event_label}',
    template:
      "Hello,\n\nI've heard about the {event_label} and I'm interested in how it works with my existing {product}. Can you provide more details about eligibility and any fees involved?\n\nAlso, will this affect my current rates or terms in any way?\n\nThanks,\n{name}",
    sentiment: 'neutral',
    channel: 'email',
  },
  {
    subject: 'Issue with {event_label}',
    template:
      'Dear Customer Services,\n\nI tried to sign up for the {event_label} yesterday but the application was rejected with no clear reason. I have an excellent credit history and my {product} has always been in good standing.\n\nCould you please explain why I was rejected and what I can do to resolve this?\n\nRegards,\n{name}',
    sentiment: 'negative',
    channel: 'email',
  },
  {
    template:
      "Just tried the {event_label} from @JourneyWorksBank and I'm impressed! Works great with my {product}. Finally a bank that innovates! 💳✨ #fintech",
    sentiment: 'positive',
    channel: 'social',
  },
  {
    template:
      'Has anyone tried the {event_label} from @JourneyWorksBank yet? Thinking of combining it with my {product}. Thoughts? 🤔',
    sentiment: 'neutral',
    channel: 'social',
  },
  {
    template:
      'Disappointed with the {event_label} from @JourneyWorksBank. Applied but got rejected despite having a good {product} track record. No explanation given. Not impressed 👎',
    sentiment: 'negative',
    channel: 'social',
  },
  {
    template:
      "Customer enquiring about the {event_label}. Wants to know how it integrates with their existing {product}. Provided full details and customer is keen to proceed. Very positive about the bank's direction.",
    sentiment: 'positive',
    channel: 'phone',
  },
  {
    template:
      "Hi, I saw the advert for {event_label}. Can you tell me if it's compatible with my {product}? I'd like to understand the benefits before I commit.",
    sentiment: 'neutral',
    channel: 'chat',
  },
];

const POLICY_CHANGE_TEMPLATES: EventCommTemplate[] = [
  {
    subject: 'Concerned about {event_label}',
    template:
      "Dear Sir/Madam,\n\nI received notification about the {event_label} and I'm very concerned about how this will affect my {product}.\n\nI've been a customer for many years and feel these changes are unfair to long-standing customers. The new terms seem considerably worse than what I currently have.\n\nI would like to discuss my options before the changes take effect.\n\n{name}",
    sentiment: 'negative',
    channel: 'email',
  },
  {
    subject: 'Re: {event_label} notification',
    template:
      "Hello,\n\nThank you for informing me about the {event_label}. I've reviewed the new terms and while some changes make sense, I'm worried about the impact on my {product} fees.\n\nCould you clarify exactly how much more I'll be paying per month?\n\nThanks,\n{name}",
    sentiment: 'mixed',
    channel: 'email',
  },
  {
    subject: 'Question about {event_label}',
    template:
      "Hi,\n\nI read about the {event_label} in your latest communication. Just wanted to confirm this doesn't affect my {product} in any negative way?\n\nIf there are actually improvements, that would be welcome!\n\nBest,\n{name}",
    sentiment: 'neutral',
    channel: 'email',
  },
  {
    template:
      'So @JourneyWorksBank is making a {event_label}. Just checked and my {product} fees are going up significantly. Loyal customers getting punished again. Time to switch? #banking #ripoff',
    sentiment: 'negative',
    channel: 'social',
  },
  {
    template:
      "Noticed @JourneyWorksBank announced a {event_label}. Hoping it doesn't mess with my {product} too much. Anyone know the details? #personalfinance",
    sentiment: 'neutral',
    channel: 'social',
  },
  {
    template:
      'Customer called upset about the {event_label}. They feel the new terms for their {product} are unfair compared to what was originally agreed. Customer is considering closing their account. Offered to review their situation with the retention team.',
    sentiment: 'negative',
    channel: 'phone',
  },
  {
    template:
      "I just got a letter about the {event_label}. Can you explain what this means for my {product}? I'm not sure I understand the new terms.",
    sentiment: 'neutral',
    channel: 'chat',
  },
];

const INCIDENT_TEMPLATES: EventCommTemplate[] = [
  {
    subject: 'Urgent: Concerned about {event_label}',
    template:
      "Dear Customer Services,\n\nI'm very worried about the {event_label} that was reported. Is my {product} affected? Are my funds and personal data safe?\n\nI need urgent reassurance that my money is secure. Please respond as soon as possible.\n\n{name}",
    sentiment: 'negative',
    channel: 'email',
  },
  {
    subject: 'Re: {event_label} - what should I do?',
    template:
      "Hello,\n\nFollowing the news about the {event_label}, I'm concerned about my {product}. Should I change my passwords? Have any of my details been compromised?\n\nI haven't noticed any suspicious activity but I want to be proactive about security.\n\nPlease advise.\n\n{name}",
    sentiment: 'mixed',
    channel: 'email',
  },
  {
    template:
      'Worried about the {event_label} at @JourneyWorksBank. Is my {product} safe? Has anyone been affected? Please be transparent about what happened! 😰 #cybersecurity #banking',
    sentiment: 'negative',
    channel: 'social',
  },
  {
    template:
      "@JourneyWorksBank please explain what's happening with the {event_label}. I have my {product} with you and I'm seriously considering moving everything elsewhere. Trust is everything in banking.",
    sentiment: 'negative',
    channel: 'social',
  },
  {
    template:
      'Customer called in a panic about the {event_label}. Very concerned about their {product} security. Reassured them about the steps being taken. Customer requested additional security measures on their account. Escalated to the security team.',
    sentiment: 'negative',
    channel: 'phone',
  },
  {
    template:
      'Hi, I just heard about the {event_label}. Is my {product} affected? Should I be worried about any unauthorised transactions?',
    sentiment: 'negative',
    channel: 'chat',
  },
];

const PROMOTION_TEMPLATES: EventCommTemplate[] = [
  {
    subject: 'Interested in {event_label}',
    template:
      "Hello,\n\nI saw the {event_label} advertised and I'm very interested. I already have a {product} with you - am I eligible?\n\nIt looks like a great offer and I'd like to take advantage of it if possible.\n\nMany thanks,\n{name}",
    sentiment: 'positive',
    channel: 'email',
  },
  {
    subject: 'Cannot access {event_label}',
    template:
      "Dear Team,\n\nI tried to apply for the {event_label} through my {product} account but I keep getting an error. The website says I'm not eligible but I believe I should be.\n\nCan you check why I'm being blocked from this offer?\n\nThanks,\n{name}",
    sentiment: 'negative',
    channel: 'email',
  },
  {
    template:
      'Great {event_label} from @JourneyWorksBank! Just applied through my {product} account. Easy process and the rewards look fantastic. 🎉 #savings #rewards',
    sentiment: 'positive',
    channel: 'social',
  },
  {
    template:
      "Tried to sign up for the {event_label} from @JourneyWorksBank but apparently my {product} doesn't qualify. Why not? Been a customer for years! Selective offers = annoyed customers 😒",
    sentiment: 'negative',
    channel: 'social',
  },
  {
    template:
      'Customer called about the {event_label}. Very enthusiastic about the offer and wants to know how it works with their {product}. Explained the terms and customer is proceeding with the application. Positive interaction.',
    sentiment: 'positive',
    channel: 'phone',
  },
  {
    template:
      "Hey, I saw the {event_label} promotion. Does this work with my {product}? What's the catch? 😄",
    sentiment: 'positive',
    channel: 'chat',
  },
];

const EVENT_COMM_TEMPLATES: Record<string, EventCommTemplate[]> = {
  outage: OUTAGE_TEMPLATES,
  launch: LAUNCH_TEMPLATES,
  policy_change: POLICY_CHANGE_TEMPLATES,
  incident: INCIDENT_TEMPLATES,
  promotion: PROMOTION_TEMPLATES,
};

// AI classification categories by event type
const EVENT_AI_CATEGORIES: Record<string, string[]> = {
  outage: ['payment-processing', 'account-opening', 'call-handling'],
  launch: ['account-opening', 'call-handling'],
  policy_change: ['fees-charges', 'cdd-remediation'],
  incident: ['call-handling', 'cdd-remediation'],
  promotion: ['account-opening', 'call-handling'],
};

@Injectable()
export class EventCommunicationGenerator {
  /**
   * Generate communications correlated with events.
   * For each event, generates 5–15 communications clustered around the event date
   * with matching products, relevant content, and explicit relatedEventId linkage.
   */
  generateForEvents(
    events: SyntheticEvent[],
    customers: SyntheticCustomer[],
  ): SyntheticCommunication[] {
    const allComms: SyntheticCommunication[] = [];

    for (const event of events) {
      const commCount = this.getCommCountForEvent(event);
      const comms = this.generateForEvent(event, customers, commCount);
      allComms.push(...comms);
    }

    return allComms;
  }

  /**
   * Determine how many communications to generate for an event.
   * Higher severity events generate more comms.
   */
  private getCommCountForEvent(event: SyntheticEvent): number {
    const baseCounts: Record<string, [number, number]> = {
      outage: [8, 15],
      incident: [6, 12],
      policy_change: [5, 10],
      launch: [5, 10],
      promotion: [4, 8],
    };

    const [min, max] = baseCounts[event.type] || [5, 10];

    // Boost count for high/critical severity
    const severityBoost =
      event.severity === 'critical' ? 5 : event.severity === 'high' ? 3 : 0;

    const count =
      Math.floor(Math.random() * (max - min + 1)) + min + severityBoost;
    return Math.min(count, 20); // Cap at 20
  }

  /**
   * Generate communications for a single event
   */
  private generateForEvent(
    event: SyntheticEvent,
    customers: SyntheticCustomer[],
    count: number,
  ): SyntheticCommunication[] {
    const templates = EVENT_COMM_TEMPLATES[event.type] || OUTAGE_TEMPLATES;
    const comms: SyntheticCommunication[] = [];

    // Get the product name for template substitution
    const productSlug = event.product || randomChoice(PRODUCT_SLUGS);
    const productInfo = findProductBySlug(productSlug);
    const productName = productInfo?.name || productSlug;

    for (let i = 0; i < count; i++) {
      const template = randomChoice(templates);
      const customer = randomChoice(customers);
      const timestamp = this.generateEventProximityDate(event);

      const comm = this.generateComm(
        event,
        template,
        customer,
        productSlug,
        productName,
        timestamp,
      );
      comms.push(comm);
    }

    // Sort chronologically
    comms.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    return comms;
  }

  /**
   * Generate a date near the event date.
   * - 20% chance of 1-2 days before (early reports / anticipation)
   * - 50% chance of same day to +1 day (peak impact)
   * - 30% chance of +2 to +5 days after (aftermath / follow-up)
   */
  private generateEventProximityDate(event: SyntheticEvent): Date {
    const eventDate = new Date(event.startDate);
    const rand = Math.random();
    let offsetMs: number;

    if (rand < 0.2) {
      // 1-2 days before
      offsetMs = -(Math.random() * 2 * 24 * 60 * 60 * 1000);
    } else if (rand < 0.7) {
      // Same day to +1 day (peak)
      offsetMs = Math.random() * 1 * 24 * 60 * 60 * 1000;
    } else {
      // +2 to +5 days after
      offsetMs = (2 + Math.random() * 3) * 24 * 60 * 60 * 1000;
    }

    // Add some hour/minute variation
    offsetMs += Math.random() * 12 * 60 * 60 * 1000;

    return new Date(eventDate.getTime() + offsetMs);
  }

  /**
   * Generate a single event-correlated communication
   */
  private generateComm(
    event: SyntheticEvent,
    template: EventCommTemplate,
    customer: SyntheticCustomer,
    productSlug: string,
    productName: string,
    timestamp: Date,
  ): SyntheticCommunication {
    // Fill template placeholders
    const content = this.fillEventTemplate(
      template.template,
      event,
      customer,
      productName,
    );
    const subject = template.subject
      ? this.fillEventTemplate(template.subject, event, customer, productName)
      : undefined;

    const sentimentLabel = template.sentiment;
    const sentimentScore = getSentimentScore(sentimentLabel);

    // Generate AI classification with event-appropriate category and matching product
    const aiClassification = this.generateEventAIClassification(
      event,
      sentimentLabel,
      productSlug,
    );

    // Determine status based on sentiment
    const status = this.generateStatus(sentimentLabel);
    const priority = this.generatePriority(sentimentLabel, event.severity);

    return {
      id: uuidv4(),
      channel: template.channel,
      direction: template.channel === 'phone' ? 'inbound' : 'inbound',
      customerId: customer.id,
      customerName: customer.name,
      subject,
      content,
      summary: this.generateSummary(content, sentimentLabel, template.channel),
      timestamp: timestamp.toISOString(),
      status,
      priority,
      sentiment: {
        label: sentimentLabel,
        score: sentimentScore,
        confidence: 0.85 + Math.random() * 0.14,
        emotionalTones: this.getEmotionalTones(sentimentLabel),
      },
      intent: {
        primary: this.getPrimaryIntent(sentimentLabel, event.type),
        secondary: this.getSecondaryIntents(event.type),
        confidence: 0.8 + Math.random() * 0.19,
      },
      entities: [
        {
          type: 'person',
          value: customer.name,
          confidence: 0.95,
        },
        {
          type: 'product',
          value: productName,
          confidence: 0.9,
        },
        {
          type: 'event',
          value: event.label,
          confidence: 0.88,
        },
      ],
      tags: this.generateTags(sentimentLabel, event),
      metadata: {
        duration:
          template.channel === 'phone'
            ? Math.floor(5 + Math.random() * 25)
            : undefined,
        agentId: `AGT-${Math.floor(1000 + Math.random() * 9000)}`,
        resolved: sentimentLabel !== 'negative' || Math.random() > 0.6,
      },
      aiClassification,
      relatedEventId: event.id,
    };
  }

  private fillEventTemplate(
    template: string,
    event: SyntheticEvent,
    customer: SyntheticCustomer,
    productName: string,
  ): string {
    return template
      .replace(/\{event_label\}/g, event.label)
      .replace(/\{event_description\}/g, event.description)
      .replace(/\{product\}/g, productName)
      .replace(/\{name\}/g, customer.name)
      .replace(/\{bank\}/g, 'JourneyWorks Bank');
  }

  private generateEventAIClassification(
    event: SyntheticEvent,
    sentiment: string,
    productSlug: string,
  ): SyntheticAIClassification {
    const categories = EVENT_AI_CATEGORIES[event.type] || ['call-handling'];
    const category = randomChoice(categories);

    let urgency: 'low' | 'medium' | 'high' | 'critical';
    if (event.severity === 'critical' || sentiment === 'negative') {
      urgency = weightedChoice([
        ['high', 0.5],
        ['critical', 0.3],
        ['medium', 0.2],
      ]) as 'low' | 'medium' | 'high' | 'critical';
    } else {
      urgency = weightedChoice([
        ['medium', 0.5],
        ['low', 0.3],
        ['high', 0.2],
      ]) as 'low' | 'medium' | 'high' | 'critical';
    }

    const regulatoryFlags: string[] = [];
    if (event.type === 'incident') {
      regulatoryFlags.push('Data-Protection-Review');
      if (Math.random() > 0.5) regulatoryFlags.push('FCA-Consumer-Duty');
    }
    if (sentiment === 'negative' && Math.random() > 0.6) {
      regulatoryFlags.push('Complaint-Escalation-Required');
    }

    return {
      category: category as SyntheticAIClassification['category'],
      confidence: 0.8 + Math.random() * 0.19,
      product: productSlug as SyntheticAIClassification['product'],
      issueType: this.getIssueType(event.type),
      urgency,
      rootCause: `Related to ${event.label}`,
      suggestedAction: this.getSuggestedAction(event.type, sentiment),
      regulatoryFlags,
    };
  }

  private generateStatus(
    sentiment: string,
  ): 'open' | 'in_progress' | 'resolved' | 'escalated' {
    if (sentiment === 'negative') {
      return weightedChoice([
        ['open', 0.3],
        ['in_progress', 0.3],
        ['escalated', 0.3],
        ['resolved', 0.1],
      ]) as 'open' | 'in_progress' | 'resolved' | 'escalated';
    }
    return weightedChoice([
      ['resolved', 0.4],
      ['in_progress', 0.3],
      ['open', 0.3],
    ]) as 'open' | 'in_progress' | 'resolved' | 'escalated';
  }

  private generatePriority(
    sentiment: string,
    severity: string,
  ): 'low' | 'medium' | 'high' | 'urgent' {
    if (severity === 'critical' || sentiment === 'negative') {
      return weightedChoice([
        ['high', 0.5],
        ['urgent', 0.3],
        ['medium', 0.2],
      ]) as 'low' | 'medium' | 'high' | 'urgent';
    }
    return weightedChoice([
      ['medium', 0.5],
      ['low', 0.3],
      ['high', 0.2],
    ]) as 'low' | 'medium' | 'high' | 'urgent';
  }

  private getEmotionalTones(sentiment: string): string[] {
    const toneMap: Record<string, string[]> = {
      negative: ['frustrated', 'anxious', 'angry', 'disappointed'],
      positive: ['grateful', 'satisfied', 'enthusiastic', 'pleased'],
      neutral: ['curious', 'matter-of-fact', 'measured'],
      mixed: ['ambivalent', 'cautious', 'hopeful-but-concerned'],
    };
    const tones = toneMap[sentiment] || toneMap.neutral;
    return randomSubset(tones, 1, 2);
  }

  private getPrimaryIntent(sentiment: string, eventType: string): string {
    if (sentiment === 'negative') {
      return randomChoice(['complaint', 'urgent-request', 'escalation']);
    }
    if (eventType === 'launch' || eventType === 'promotion') {
      return randomChoice(['enquiry', 'application', 'feedback']);
    }
    return randomChoice(['enquiry', 'information-request', 'feedback']);
  }

  private getSecondaryIntents(eventType: string): string[] {
    const intents: Record<string, string[]> = {
      outage: ['status-check', 'compensation-request'],
      launch: ['feature-enquiry', 'eligibility-check'],
      policy_change: ['clarification', 'terms-review'],
      incident: ['security-concern', 'account-review'],
      promotion: ['eligibility-check', 'terms-enquiry'],
    };
    return intents[eventType] || ['general-enquiry'];
  }

  private getIssueType(eventType: string): string {
    const issueTypes: Record<string, string[]> = {
      outage: [
        'Service disruption',
        'Payment failure',
        'Access denied',
        'System error',
      ],
      launch: [
        'Product enquiry',
        'Application issue',
        'Feature request',
        'Eligibility query',
      ],
      policy_change: [
        'Fee dispute',
        'Terms query',
        'Policy clarification',
        'Rate change concern',
      ],
      incident: [
        'Security concern',
        'Data breach worry',
        'Fraud alert',
        'Account security',
      ],
      promotion: [
        'Eligibility query',
        'Application error',
        'Reward enquiry',
        'Terms clarification',
      ],
    };
    return randomChoice(issueTypes[eventType] || ['General enquiry']);
  }

  private getSuggestedAction(eventType: string, sentiment: string): string {
    if (sentiment === 'negative') {
      return randomChoice([
        'Escalate to specialist team',
        'Issue goodwill gesture',
        'Schedule callback within 24 hours',
        'Transfer to complaints team',
      ]);
    }
    const actions: Record<string, string[]> = {
      outage: [
        'Monitor and update customer',
        'Provide estimated resolution time',
      ],
      launch: ['Provide product information', 'Assist with application'],
      policy_change: ['Explain new terms clearly', 'Review account for impact'],
      incident: ['Reassure and monitor', 'Enable additional security'],
      promotion: ['Confirm eligibility', 'Assist with enrolment'],
    };
    return randomChoice(actions[eventType] || ['Standard follow-up']);
  }

  private generateTags(sentiment: string, event: SyntheticEvent): string[] {
    const tags = [`event:${event.type}`, `event-related`];

    if (sentiment === 'negative') {
      tags.push('complaint', 'follow-up-required');
      if (event.severity === 'critical' || event.severity === 'high') {
        tags.push('escalated');
      }
    }

    if (event.type === 'outage' || event.type === 'incident') {
      tags.push('service-disruption');
    }

    return tags;
  }

  private generateSummary(
    content: string,
    sentiment: string,
    channel: string,
  ): string {
    const sentimentText: Record<string, string> = {
      positive: 'satisfied',
      negative: 'frustrated',
      neutral: 'neutral',
      mixed: 'mixed sentiment',
    };

    const channelText: Record<string, string> = {
      email: 'Email',
      phone: 'Phone call',
      chat: 'Chat session',
      social: 'Social message',
    };

    const sentences = content
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 10);
    const keySentence =
      sentences.length > 0
        ? sentences[0].trim().substring(0, 100)
        : 'Communication received';

    return `${channelText[channel] || 'Communication'} - ${sentimentText[sentiment] || 'neutral'} customer (event-related). ${keySentence}...`;
  }
}
