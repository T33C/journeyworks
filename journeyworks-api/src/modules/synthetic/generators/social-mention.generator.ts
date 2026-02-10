/**
 * Social Mention Generator
 *
 * Generates synthetic social media mentions for the bank.
 */

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { SyntheticSocialMention } from '../synthetic-data.types';
import {
  randomChoice,
  weightedChoice,
  randomDate,
  getSentimentScore,
} from '../utils/random.util';
import { PRODUCT_NAMES, KNOWN_PRODUCTS } from '../data/products';

const TWITTER_TEMPLATES = {
  positive: [
    'Great experience with @JourneyWorksBank today! Their customer service team really sorted my issue fast. #banking #customerservice',
    'Just had an amazing call with my account manager at @JourneyWorksBank. Finally a bank that actually listens! 👏',
    "Switched to @JourneyWorksBank 6 months ago. Best decision I've made. Their mobile app is 🔥",
    '@JourneyWorksBank customer service is top notch. Issue resolved in minutes, not days. #CustomerService',
    'The new @JourneyWorksBank app update is fantastic! Managing my accounts has never been easier. #fintech',
  ],
  negative: [
    '@JourneyWorksBank why is my bank transfer STILL pending after 5 days?? This is unacceptable! #frustrated',
    'Terrible experience with @JourneyWorksBank today. 45 min wait time just to speak to someone. Do better.',
    '@JourneyWorksBank your app has been down for hours. How am I supposed to manage my money? #fail',
    'Hidden fees everywhere with @JourneyWorksBank. They never told me about the monthly charges. #disappointed',
    'Been a @JourneyWorksBank customer for 10 years. Service has declined so much. Considering switching. 😞',
  ],
  neutral: [
    'Does anyone have experience with @JourneyWorksBank current accounts? Looking for opinions.',
    '@JourneyWorksBank what are your current savings rates?',
    'Thinking about opening an account with @JourneyWorksBank. Any feedback from current customers?',
    '@JourneyWorksBank are your branches open on Saturday?',
    'Just received my @JourneyWorksBank statement. Need to review it properly this weekend.',
  ],
  mixed: [
    '@JourneyWorksBank great savings rates but your mobile app needs serious work.',
    "Love the staff at @JourneyWorksBank but the online platform is so outdated. When's the upgrade?",
  ],
};

const LINKEDIN_TEMPLATES = {
  positive: [
    'Impressed by the community initiatives from JourneyWorks Bank. Their financial literacy programme is making a real difference in underserved communities. #FinancialInclusion #RetailBanking',
    'Just refinanced my mortgage with JourneyWorks Bank. The process was smooth, transparent, and the rate was competitive. Would recommend to any homeowner looking at their options.',
    "Great customer experience event at JourneyWorks Bank today. Insightful session on digital banking trends and how they're improving the high-street experience. #RetailBanking #DigitalTransformation",
  ],
  negative: [
    "Disappointing experience with JourneyWorks Bank's mortgage application process. After 3 months, still waiting for basic documentation. Expected better from a well-known high-street bank.",
    'JourneyWorks Bank promised dedicated account management for their premium customers. Reality: constant turnover and having to re-explain everything every quarter. Time for a change.',
  ],
  neutral: [
    "Looking for insights on JourneyWorks Bank's ISA offerings. Has anyone compared their rates recently? DM me if you have experience to share.",
    'JourneyWorks Bank is hosting a webinar on managing household finances next week. Anyone attending?',
  ],
  mixed: [
    'Mixed feelings about JourneyWorks Bank after our recent mortgage experience. Staff knowledge is strong but communication could be better. The outcome was good but the process was frustrating.',
  ],
};

const TRUSTPILOT_TEMPLATES = {
  positive: [
    '★★★★★ Excellent high-street banking service! My account manager Sarah has been incredibly helpful in sorting out my mortgage. The mobile app is intuitive and everything just works. Highly recommend for anyone looking for a reliable bank.',
    "★★★★★ Been with JourneyWorks Bank for 5 years now. They've been brilliant with my current account and savings. Customer service is always responsive. Really pleased with the experience.",
    "★★★★☆ Great bank overall. The staff know their stuff. Only reason for 4 stars is occasionally slow email responses. But when you do get through, they're very helpful.",
  ],
  negative: [
    '★★☆☆☆ Disappointed with the service. Was promised dedicated support as a premium customer but keep getting passed around to different agents. Bank transfers take forever. Looking at alternatives.',
    '★☆☆☆☆ AVOID! Hidden fees, poor communication, and impossible to reach anyone. They charged me £500 in fees that were never disclosed. When I complained, they said it was in the fine print. Disgraceful.',
    '★★☆☆☆ Used to be great but has gone downhill. New mobile app is buggy. Support wait times have tripled. My account manager left and no one bothered to introduce my new one.',
  ],
  neutral: [
    '★★★☆☆ Average service. Nothing exceptional but nothing terrible either. Fees are on par with competitors. Online banking is functional but dated.',
    '★★★☆☆ Standard banking experience. They do what they need to do. Not particularly proactive with advice or suggestions.',
  ],
  mixed: [
    '★★★☆☆ Good savings rates this year but the customer service experience has room for improvement. Love my account manager but the support team is overwhelmed. Would be 5 stars if they fixed the service issues.',
  ],
};

const REDDIT_TEMPLATES = {
  positive: [
    "Been with JourneyWorks for 3 years now. Best high-street banking experience I've had. Their savings rates are competitive and the customer service has been solid. Mobile app is one of the better ones out there.",
    "PSA: JourneyWorks Bank's new easy-access saver is actually competitive now. 4.5% AER with no strings attached if you're an existing current account holder.",
    'Just want to give a shoutout to JourneyWorks. Had a fraud issue on my debit card and they resolved it in 24 hours with zero hassle. Compare that to my experience with [other bank] which took 3 weeks.',
  ],
  negative: [
    "Anyone else having issues with JourneyWorks' bank transfer system? I've had 3 payments fail this month. Each time they blame \"technical issues\" but can't give specifics. Frustrating.",
    'Warning: JourneyWorks hit me with a £350 overdraft fee that was never disclosed. When I asked about it, they pointed to page 47 of the T&Cs. Shady practices.',
    "Rant: JourneyWorks customer service is useless. 40 minute wait, only to be told my issue needs to be escalated. No timeline given. I'm a platinum customer ffs.",
  ],
  neutral: [
    'Thinking of moving to JourneyWorks from Competitor Bank. Anyone have experience with their current accounts? Specifically interested in their overdraft terms.',
    "Question: What's the minimum balance for JourneyWorks premium account? Their website is vague about it.",
    'Has anyone compared JourneyWorks vs OtherBank for joint accounts? Would appreciate any insights.',
  ],
  mixed: [
    "JourneyWorks is fine I guess? Their savings rates are decent but the UX on their app is stuck in 2010. Why can't banks make decent apps?",
  ],
};

const AUTHORS = {
  twitter: [
    '@BankCustomerJohn',
    '@MoneySavvySarah',
    '@FinanceFred',
    '@MoneyMatters',
    '@MortgageMum_',
    '@TechSavvyBanker',
    '@SavingsGoals',
    '@BudgetKing',
    '@MarketWatch_',
    '@SmartSaver101',
    '@SmartMoney101',
    '@FirstTimeBuyer',
  ],
  linkedin: [
    'John Smith, Branch Manager',
    'Sarah Johnson, Financial Adviser',
    'Michael Chen, Customer Services Director',
    'Emily Watson, Mortgage Specialist',
    'Robert Brown, Regional Manager',
    'Jennifer Davis, Digital Banking Lead',
    'William Thompson, Compliance Officer',
  ],
  trustpilot: [
    'John M.',
    'Sarah L.',
    'Mike T.',
    'Emma R.',
    'David W.',
    'Jennifer K.',
    'Robert S.',
    'Amanda B.',
    'Chris P.',
    'Laura H.',
  ],
  reddit: [
    'u/SavingsAdvice',
    'u/MortgageHelper2024',
    'u/FinanceNerd',
    'u/BudgetPlanner',
    'u/CurrentAccountFan',
    'u/HighStreetBanking',
    'u/ISAExpert_',
    'u/CreditCardTips',
  ],
};

// Products from shared catalogue
const PRODUCTS = PRODUCT_NAMES;

@Injectable()
export class SocialMentionGenerator {
  private readonly bankName: string;
  private readonly bankHandle: string;

  constructor(private readonly configService: ConfigService) {
    this.bankName = this.configService.get<string>(
      'branding.bankName',
      'JourneyWorks Bank',
    );
    this.bankHandle = this.configService.get<string>(
      'branding.bankHandle',
      '@JourneyWorksBank',
    );
  }

  /**
   * Replace default bank references with configured branding
   */
  private brandContent(content: string): string {
    return content
      .replace(/@JourneyWorksBank/g, this.bankHandle)
      .replace(/JourneyWorks Bank/g, this.bankName)
      .replace(/JourneyWorks/g, this.bankName);
  }

  /**
   * Generate a single social mention
   */
  generate(
    platform: 'twitter' | 'linkedin' | 'reddit' | 'trustpilot',
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed',
    timestamp: Date,
  ): SyntheticSocialMention {
    const templates = this.getTemplates(platform);
    const templateList = templates[sentiment] || templates.neutral;
    const content = this.brandContent(randomChoice(templateList));

    const author = this.getAuthor(platform);
    const authorHandle = this.getHandle(author, platform);

    return {
      id: uuidv4(),
      platform,
      author,
      authorHandle,
      content,
      timestamp: timestamp.toISOString(),
      sentiment: {
        label: sentiment,
        score: getSentimentScore(sentiment),
        confidence: 0.8 + Math.random() * 0.19,
      },
      engagement: this.generateEngagement(platform, sentiment),
      url: this.generateUrl(platform),
      mentionedProducts: this.extractProducts(content),
      tags: this.generateTags(platform, sentiment),
      requiresResponse: sentiment === 'negative' && Math.random() > 0.3,
      responded: sentiment === 'negative' && Math.random() > 0.5,
      linkedCustomerId: undefined, // Would be set during actual processing
    };
  }

  /**
   * Generate multiple social mentions
   */
  generateMany(
    count: number,
    sentimentDistribution: Record<string, number>,
    dateRange: { start: Date; end: Date },
  ): SyntheticSocialMention[] {
    const mentions: SyntheticSocialMention[] = [];

    const platforms: Array<'twitter' | 'linkedin' | 'reddit' | 'trustpilot'> = [
      'twitter',
      'linkedin',
      'reddit',
      'trustpilot',
    ];

    // Ensure edge coverage: generate mentions on the first and last day
    // so the time series chart spans the full date range
    const edgeSentiment = () =>
      weightedChoice(
        Object.entries(sentimentDistribution).map(([k, v]) => [k, v]),
      ) as 'positive' | 'negative' | 'neutral' | 'mixed';

    // First day mention
    const firstDayEnd = new Date(dateRange.start);
    firstDayEnd.setHours(23, 59, 59, 999);
    mentions.push(
      this.generate(
        randomChoice(platforms),
        edgeSentiment(),
        randomDate(dateRange.start, firstDayEnd),
      ),
    );

    // Last day mention
    const lastDayStart = new Date(dateRange.end);
    lastDayStart.setHours(0, 0, 0, 0);
    mentions.push(
      this.generate(
        randomChoice(platforms),
        edgeSentiment(),
        randomDate(lastDayStart, dateRange.end),
      ),
    );

    // Generate the remaining mentions randomly
    const remaining = Math.max(0, count - 2);
    for (let i = 0; i < remaining; i++) {
      const platform = randomChoice(platforms);
      const sentiment = weightedChoice(
        Object.entries(sentimentDistribution).map(([k, v]) => [k, v]),
      ) as 'positive' | 'negative' | 'neutral' | 'mixed';
      const timestamp = randomDate(dateRange.start, dateRange.end);

      mentions.push(this.generate(platform, sentiment, timestamp));
    }

    // Sort by timestamp
    mentions.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    return mentions;
  }

  /**
   * Get templates for platform
   */
  private getTemplates(platform: string): Record<string, string[]> {
    switch (platform) {
      case 'twitter':
        return TWITTER_TEMPLATES;
      case 'linkedin':
        return LINKEDIN_TEMPLATES;
      case 'trustpilot':
        return TRUSTPILOT_TEMPLATES;
      case 'reddit':
        return REDDIT_TEMPLATES;
      default:
        return TWITTER_TEMPLATES;
    }
  }

  /**
   * Get author for platform
   */
  private getAuthor(platform: string): string {
    const authors =
      AUTHORS[platform as keyof typeof AUTHORS] || AUTHORS.twitter;
    return randomChoice(authors);
  }

  /**
   * Get handle from author
   */
  private getHandle(author: string, platform: string): string {
    if (platform === 'twitter') {
      return author;
    }
    if (platform === 'reddit') {
      return author;
    }
    if (platform === 'linkedin') {
      return author.split(',')[0].toLowerCase().replace(/\s+/g, '-');
    }
    return author.toLowerCase().replace(/\s+/g, '');
  }

  /**
   * Generate engagement metrics
   */
  private generateEngagement(
    platform: string,
    sentiment: string,
  ): { likes: number; shares: number; comments: number } {
    // Negative sentiment often gets more engagement
    const baseMultiplier = sentiment === 'negative' ? 1.5 : 1;

    const platformMultipliers = {
      twitter: { likes: 50, shares: 10, comments: 5 },
      linkedin: { likes: 100, shares: 20, comments: 15 },
      reddit: { likes: 200, shares: 5, comments: 30 },
      trustpilot: { likes: 20, shares: 2, comments: 3 },
      facebook: { likes: 75, shares: 15, comments: 10 },
    };

    const multipliers =
      platformMultipliers[platform as keyof typeof platformMultipliers] ||
      platformMultipliers.twitter;

    return {
      likes: Math.floor(Math.random() * multipliers.likes * baseMultiplier),
      shares: Math.floor(Math.random() * multipliers.shares * baseMultiplier),
      comments: Math.floor(
        Math.random() * multipliers.comments * baseMultiplier,
      ),
    };
  }

  /**
   * Generate URL
   */
  private generateUrl(platform: string): string {
    const id = Math.floor(100000000 + Math.random() * 899999999);

    switch (platform) {
      case 'twitter':
        return `https://twitter.com/user/status/${id}`;
      case 'linkedin':
        return `https://linkedin.com/feed/update/${id}`;
      case 'reddit':
        return `https://reddit.com/r/UKPersonalFinance/comments/${id}`;
      case 'trustpilot':
        return `https://trustpilot.com/reviews/${id}`;
      default:
        return `https://social.com/post/${id}`;
    }
  }

  /**
   * Extract mentioned products
   */
  private extractProducts(content: string): string[] {
    const mentioned: string[] = [];
    const contentLower = content.toLowerCase();

    for (const product of PRODUCTS) {
      if (contentLower.includes(product)) {
        mentioned.push(product);
      }
    }

    return mentioned;
  }

  /**
   * Generate tags
   */
  private generateTags(platform: string, sentiment: string): string[] {
    const tags: string[] = [platform];

    if (sentiment === 'negative') {
      tags.push('requires-attention');
    }

    if (sentiment === 'positive') {
      tags.push('testimonial-candidate');
    }

    return tags;
  }
}
