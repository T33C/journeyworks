/**
 * Social Mention Generator
 *
 * Generates synthetic social media mentions for the bank.
 */

import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SyntheticSocialMention } from '../synthetic-data.types';

const TWITTER_TEMPLATES = {
  positive: [
    'Great experience with @JourneyWorksBank today! Their wealth management team really knows their stuff. #investing #privatebanking',
    'Just had an amazing call with my RM at @JourneyWorksBank. Finally a bank that actually listens! 👏',
    "Switched to @JourneyWorksBank 6 months ago. Best financial decision I've made. Their digital platform is 🔥",
    '@JourneyWorksBank customer service is top notch. Issue resolved in minutes, not days. #CustomerService',
    'The new @JourneyWorksBank app update is fantastic! Portfolio tracking has never been easier. #fintech',
  ],
  negative: [
    '@JourneyWorksBank why is my wire transfer STILL pending after 5 days?? This is unacceptable! #frustrated',
    'Terrible experience with @JourneyWorksBank today. 45 min wait time just to speak to someone. Do better.',
    '@JourneyWorksBank your app has been down for hours. How am I supposed to manage my investments? #fail',
    'Hidden fees everywhere with @JourneyWorksBank. They never told me about the custody charges. #disappointed',
    'Been a @JourneyWorksBank customer for 10 years. Service has declined so much. Considering switching. 😞',
  ],
  neutral: [
    'Does anyone have experience with @JourneyWorksBank wealth management services? Looking for opinions.',
    '@JourneyWorksBank what are your current rates for structured products?',
    'Thinking about opening an account with @JourneyWorksBank. Any feedback from current customers?',
    '@JourneyWorksBank are your branches open on Saturday?',
    'Just received my @JourneyWorksBank statement. Need to review it properly this weekend.',
  ],
  mixed: [
    '@JourneyWorksBank great investment returns this quarter but your mobile app needs serious work.',
    "Love my RM at @JourneyWorksBank but the online platform is so outdated. When's the upgrade?",
  ],
};

const LINKEDIN_TEMPLATES = {
  positive: [
    'Impressed by the thought leadership from JourneyWorks Bank on sustainable investing. Their recent whitepaper on ESG integration is a must-read for any institutional investor. #ESG #SustainableFinance',
    'Just completed a successful M&A transaction with JourneyWorks Bank as our advisor. Professional, thorough, and genuinely committed to our success. Would recommend to any business owner considering strategic options.',
    'Great panel discussion at the JourneyWorks Bank Investment Forum today. Insightful perspectives on market trends and portfolio strategies. #InvestmentBanking #WealthManagement',
  ],
  negative: [
    "Disappointing experience with JourneyWorks Bank's corporate banking division. After 3 months, still waiting for basic documentation. Expected better from a tier-1 institution.",
    'JourneyWorks Bank promised dedicated relationship management for their premium clients. Reality: constant turnover and having to re-explain our business every quarter. Time for a change.',
  ],
  neutral: [
    "Looking for insights on JourneyWorks Bank's private equity offerings. Has anyone worked with their PE team? DM me if you have experience to share.",
    'JourneyWorks Bank is hosting a webinar on interest rate outlook next week. Anyone attending?',
  ],
  mixed: [
    'Mixed feelings about JourneyWorks Bank after our recent engagement. Technical expertise is strong but communication could be better. The results were good but the process was frustrating.',
  ],
};

const TRUSTPILOT_TEMPLATES = {
  positive: [
    '★★★★★ Excellent private banking service! My relationship manager Sarah has been incredibly helpful in restructuring my portfolio. The digital tools are intuitive and the investment advice has been spot on. Highly recommend for anyone looking for personalized wealth management.',
    "★★★★★ Been with JourneyWorks Bank for 5 years now. They've helped me grow my investments by 40%. Customer service is always responsive. The quarterly reviews are thorough and helpful.",
    "★★★★☆ Great bank overall. The wealth management team knows their stuff. Only reason for 4 stars is occasionally slow email responses. But when you do get through, they're very helpful.",
  ],
  negative: [
    '★★☆☆☆ Disappointed with the service. Was promised dedicated support as a gold tier client but keep getting passed around to different agents. Wire transfers take forever. Looking at alternatives.',
    '★☆☆☆☆ AVOID! Hidden fees, poor communication, and impossible to reach anyone. They charged me $500 in fees that were never disclosed. When I complained, they said it was in the fine print. Disgraceful.',
    '★★☆☆☆ Used to be great but has gone downhill. New mobile app is buggy. Support wait times have tripled. My RM left and no one bothered to introduce my new one.',
  ],
  neutral: [
    '★★★☆☆ Average service. Nothing exceptional but nothing terrible either. Fees are on par with competitors. Online platform is functional but dated.',
    '★★★☆☆ Standard banking experience. They do what they need to do. Not particularly proactive with advice or suggestions.',
  ],
  mixed: [
    '★★★☆☆ Good investment returns this year but the customer service experience has room for improvement. Love my portfolio manager but the support team is overwhelmed. Would be 5 stars if they fixed the service issues.',
  ],
};

const REDDIT_TEMPLATES = {
  positive: [
    "Been with JourneyWorks for 3 years now. Best private banking experience I've had. Their wealth management fee is reasonable (0.75%) and the advisory service has been solid. My portfolio is up 35% overall.",
    "PSA: JourneyWorks Bank's new high-yield account is actually competitive now. 4.5% APY with no strings attached if you're an existing client.",
    'Just want to give a shoutout to JourneyWorks. Had a fraud issue and they resolved it in 24 hours with zero hassle. Compare that to my experience with [other bank] which took 3 weeks.',
  ],
  negative: [
    "Anyone else having issues with JourneyWorks' wire transfer system? I've had 3 international transfers fail this month. Each time they blame \"compliance\" but can't give specifics. Frustrating.",
    'Warning: JourneyWorks hit me with a $350 "account maintenance" fee that was never disclosed. When I asked about it, they pointed to page 47 of a document I apparently signed. Shady practices.',
    "Rant: JourneyWorks customer service is useless. 40 minute wait, only to be told my issue needs to be escalated. No timeline given. I'm a platinum client ffs.",
  ],
  neutral: [
    'Thinking of moving to JourneyWorks from Competitor Bank. Anyone have experience with their investment advisory? Specifically interested in their ESG offerings.',
    "Question: What's the typical account minimum for JourneyWorks private banking? Their website is vague about it.",
    'Has anyone compared JourneyWorks vs OtherBank for family office services? Would appreciate any insights.',
  ],
  mixed: [
    "JourneyWorks is fine I guess? Their investment products are good but the UX on their platform is stuck in 2010. Why can't banks make decent apps?",
  ],
};

const AUTHORS = {
  twitter: [
    '@InvestorJohn',
    '@WealthWise',
    '@FinanceFred',
    '@MoneyMatters',
    '@RetireEarly_',
    '@TechInvestor',
    '@GrowthHunter',
    '@ValueSeeker',
    '@MarketWatch_',
    '@PortfolioProf',
    '@SmartMoney101',
    '@FutureWealth',
  ],
  linkedin: [
    'John Smith, CFO',
    'Sarah Johnson, VP Finance',
    'Michael Chen, Managing Director',
    'Emily Watson, Portfolio Manager',
    'Robert Brown, Family Office Director',
    'Jennifer Davis, Institutional Investor',
    'William Thompson, PE Partner',
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
    'u/InvestingDad',
    'u/WealthBuilder2024',
    'u/FinanceNerd',
    'u/RetirementPlanner',
    'u/PortfolioManager',
    'u/HighNetWorth',
    'u/PassiveIncome_',
    'u/DividendGrowth',
  ],
};

const PRODUCTS = [
  'wealth management',
  'private banking',
  'investment advisory',
  'structured products',
  'ESG funds',
  'portfolio management',
  'mobile app',
  'online platform',
  'customer service',
];

@Injectable()
export class SocialMentionGenerator {
  /**
   * Generate a single social mention
   */
  generate(
    platform: 'twitter' | 'linkedin' | 'facebook' | 'reddit' | 'trustpilot',
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed',
    timestamp: Date,
  ): SyntheticSocialMention {
    const templates = this.getTemplates(platform);
    const templateList = templates[sentiment] || templates.neutral;
    const content = this.randomChoice(templateList);

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
        score: this.getSentimentScore(sentiment),
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

    for (let i = 0; i < count; i++) {
      const platform = this.randomChoice(platforms);
      const sentiment = this.weightedChoice(
        Object.entries(sentimentDistribution).map(([k, v]) => [k, v]),
      ) as 'positive' | 'negative' | 'neutral' | 'mixed';
      const timestamp = this.randomDate(dateRange.start, dateRange.end);

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
    return this.randomChoice(authors);
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
        return `https://reddit.com/r/investing/comments/${id}`;
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

  /**
   * Get sentiment score
   */
  private getSentimentScore(sentiment: string): number {
    switch (sentiment) {
      case 'positive':
        return 0.5 + Math.random() * 0.5;
      case 'negative':
        return -0.5 - Math.random() * 0.5;
      case 'mixed':
        return -0.2 + Math.random() * 0.4;
      default:
        return -0.1 + Math.random() * 0.2;
    }
  }

  /**
   * Random choice
   */
  private randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Weighted choice
   */
  private weightedChoice(options: Array<[string, number]>): string {
    const total = options.reduce((sum, [, weight]) => sum + weight, 0);
    const random = Math.random() * total;
    let cumulative = 0;

    for (const [value, weight] of options) {
      cumulative += weight;
      if (random < cumulative) {
        return value;
      }
    }

    return options[options.length - 1][0];
  }

  /**
   * Random date - biased towards recent dates
   */
  private randomDate(start: Date, end: Date): Date {
    const diff = end.getTime() - start.getTime();
    // Use square root to bias towards more recent dates
    const biasedRandom = Math.pow(Math.random(), 0.5);
    return new Date(start.getTime() + biasedRandom * diff);
  }
}
