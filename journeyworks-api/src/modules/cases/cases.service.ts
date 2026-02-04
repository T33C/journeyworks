/**
 * Cases Service
 *
 * Business logic for case operations.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import {
  CasesRepository,
  CaseDocument,
  CaseSearchFilters,
} from './cases.repository';

@Injectable()
export class CasesService {
  private readonly logger = new Logger(CasesService.name);

  constructor(private readonly repository: CasesRepository) {}

  /**
   * Create a new case
   */
  async create(data: Partial<CaseDocument>): Promise<CaseDocument> {
    const now = new Date().toISOString();
    const caseDoc: CaseDocument = {
      id: data.id || uuidv4(),
      customerId: data.customerId!,
      customerName: data.customerName!,
      title: data.title!,
      description: data.description!,
      category: data.category!,
      subcategory: data.subcategory,
      product: data.product || 'current-account',
      status: data.status || 'open',
      priority: data.priority || 'medium',
      assignedTo: data.assignedTo,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      resolvedAt: data.resolvedAt,
      slaDeadline: data.slaDeadline,
      slaBreached: data.slaBreached,
      communicationIds: data.communicationIds,
      tags: data.tags,
      resolution: data.resolution,
      metadata: data.metadata,
    };

    await this.repository.create(caseDoc.id, caseDoc);
    this.logger.log(`Created case: ${caseDoc.id}`);
    return caseDoc;
  }

  /**
   * Create multiple cases in bulk
   */
  async createBulk(
    cases: Partial<CaseDocument>[],
  ): Promise<{ created: number; failed: number }> {
    const now = new Date().toISOString();
    const documents: CaseDocument[] = cases.map((data) => ({
      id: data.id || uuidv4(),
      customerId: data.customerId!,
      customerName: data.customerName!,
      title: data.title!,
      description: data.description!,
      category: data.category!,
      subcategory: data.subcategory,
      product: data.product || 'current-account',
      status: data.status || 'open',
      priority: data.priority || 'medium',
      assignedTo: data.assignedTo,
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      resolvedAt: data.resolvedAt,
      slaDeadline: data.slaDeadline,
      slaBreached: data.slaBreached,
      communicationIds: data.communicationIds,
      tags: data.tags,
      resolution: data.resolution,
      metadata: data.metadata,
    }));

    return this.repository.bulkCreate(documents);
  }

  /**
   * Get case by ID
   */
  async findById(id: string): Promise<CaseDocument> {
    const doc = await this.repository.findById(id);
    if (!doc) {
      throw new NotFoundException(`Case not found: ${id}`);
    }
    return doc;
  }

  /**
   * Search cases
   */
  async search(query?: string, filters?: CaseSearchFilters) {
    return this.repository.searchCases(query, filters);
  }

  /**
   * Get cases for a customer
   */
  async findByCustomer(customerId: string): Promise<CaseDocument[]> {
    return this.repository.findByCustomerId(customerId);
  }

  /**
   * Get all open cases
   */
  async findOpenCases(): Promise<CaseDocument[]> {
    return this.repository.findOpenCases();
  }

  /**
   * Delete all cases
   */
  async deleteAll(): Promise<{ deleted: number }> {
    const deleted = await this.repository.deleteAll();
    this.logger.log(`Deleted ${deleted} cases`);
    return { deleted };
  }
}
