/**
 * Events Service
 *
 * Business logic for timeline event operations.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  EventsRepository,
  EventDocument,
  EventSearchFilters,
} from './events.repository';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly repository: EventsRepository) {}

  /**
   * Create a new event
   */
  async create(data: Partial<EventDocument>): Promise<EventDocument> {
    const now = new Date().toISOString();
    const eventDoc: EventDocument = {
      id: data.id || uuidv4(),
      type: data.type!,
      label: data.label!,
      description: data.description!,
      startDate: data.startDate!,
      endDate: data.endDate,
      product: data.product,
      channels: data.channels,
      affectedRegions: data.affectedRegions,
      severity: data.severity || 'medium',
      estimatedImpact: data.estimatedImpact,
      status: data.status || 'active',
      correlatedCommunications: data.correlatedCommunications,
      sentimentDuringEvent: data.sentimentDuringEvent,
      source: data.source || 'manual',
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    };

    await this.repository.create(eventDoc.id, eventDoc);
    this.logger.log(`Created event: ${eventDoc.id}`);
    return eventDoc;
  }

  /**
   * Create multiple events in bulk
   */
  async createBulk(
    events: Partial<EventDocument>[],
  ): Promise<{ created: number; failed: number }> {
    const now = new Date().toISOString();
    const documents: EventDocument[] = events.map((data) => ({
      id: data.id || uuidv4(),
      type: data.type!,
      label: data.label!,
      description: data.description!,
      startDate: data.startDate!,
      endDate: data.endDate,
      product: data.product,
      channels: data.channels,
      affectedRegions: data.affectedRegions,
      severity: data.severity || 'medium',
      estimatedImpact: data.estimatedImpact,
      status: data.status || 'active',
      correlatedCommunications: data.correlatedCommunications,
      sentimentDuringEvent: data.sentimentDuringEvent,
      source: data.source || 'manual',
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
    }));

    return this.repository.bulkCreate(documents);
  }

  /**
   * Get event by ID
   */
  async findById(id: string): Promise<EventDocument> {
    const doc = await this.repository.findById(id);
    if (!doc) {
      throw new NotFoundException(`Event not found: ${id}`);
    }
    return doc;
  }

  /**
   * Search events
   */
  async search(query?: string, filters?: EventSearchFilters) {
    return this.repository.searchEvents(query, filters);
  }

  /**
   * Get active events
   */
  async findActiveEvents(): Promise<EventDocument[]> {
    return this.repository.findActiveEvents();
  }

  /**
   * Get events by date range
   */
  async findByDateRange(
    startDate: string,
    endDate: string,
  ): Promise<EventDocument[]> {
    return this.repository.findByDateRange(startDate, endDate);
  }

  /**
   * Delete all events
   */
  async deleteAll(): Promise<{ deleted: number }> {
    const deleted = await this.repository.deleteAll();
    return { deleted };
  }
}
