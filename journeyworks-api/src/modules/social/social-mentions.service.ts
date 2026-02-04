/**
 * Social Mentions Service
 *
 * Business logic for social media mention operations.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  SocialMentionsRepository,
  SocialMentionDocument,
  SocialMentionSearchFilters,
} from './social-mentions.repository';

@Injectable()
export class SocialMentionsService {
  private readonly logger = new Logger(SocialMentionsService.name);

  constructor(private readonly repository: SocialMentionsRepository) {}

  /**
   * Create a new social mention
   */
  async create(
    data: Partial<SocialMentionDocument>,
  ): Promise<SocialMentionDocument> {
    const now = new Date().toISOString();
    const mention: SocialMentionDocument = {
      id: data.id || uuidv4(),
      platform: data.platform!,
      author: data.author!,
      authorHandle: data.authorHandle!,
      content: data.content!,
      timestamp: data.timestamp!,
      sentiment: data.sentiment!,
      engagement: data.engagement || { likes: 0, shares: 0, comments: 0 },
      url: data.url!,
      mentionedProducts: data.mentionedProducts,
      tags: data.tags,
      requiresResponse: data.requiresResponse ?? false,
      responded: data.responded ?? false,
      linkedCustomerId: data.linkedCustomerId,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    };

    await this.repository.create(mention.id, mention);
    this.logger.log(`Created social mention: ${mention.id}`);
    return mention;
  }

  /**
   * Create multiple social mentions in bulk
   */
  async createBulk(
    mentions: Partial<SocialMentionDocument>[],
  ): Promise<{ created: number; failed: number }> {
    const now = new Date().toISOString();
    const documents: SocialMentionDocument[] = mentions.map((data) => ({
      id: data.id || uuidv4(),
      platform: data.platform!,
      author: data.author!,
      authorHandle: data.authorHandle!,
      content: data.content!,
      timestamp: data.timestamp!,
      sentiment: data.sentiment!,
      engagement: data.engagement || { likes: 0, shares: 0, comments: 0 },
      url: data.url!,
      mentionedProducts: data.mentionedProducts,
      tags: data.tags,
      requiresResponse: data.requiresResponse ?? false,
      responded: data.responded ?? false,
      linkedCustomerId: data.linkedCustomerId,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    }));

    return this.repository.bulkCreate(documents);
  }

  /**
   * Get social mention by ID
   */
  async findById(id: string): Promise<SocialMentionDocument> {
    const doc = await this.repository.findById(id);
    if (!doc) {
      throw new NotFoundException(`Social mention not found: ${id}`);
    }
    return doc;
  }

  /**
   * Search social mentions
   */
  async search(query?: string, filters?: SocialMentionSearchFilters) {
    return this.repository.searchMentions(query, filters);
  }

  /**
   * Get mentions requiring response
   */
  async findRequiringResponse(): Promise<SocialMentionDocument[]> {
    return this.repository.findRequiringResponse();
  }

  /**
   * Get mentions by platform
   */
  async findByPlatform(platform: string): Promise<SocialMentionDocument[]> {
    return this.repository.findByPlatform(platform);
  }

  /**
   * Delete all social mentions
   */
  async deleteAll(): Promise<{ deleted: number }> {
    const deleted = await this.repository.deleteAll();
    this.logger.log(`Deleted ${deleted} social mentions`);
    return { deleted };
  }
}
