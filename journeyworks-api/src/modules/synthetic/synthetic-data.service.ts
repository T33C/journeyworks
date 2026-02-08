/**
 * Synthetic Data Service
 *
 * Orchestrates generation of synthetic data for the PoC.
 * All entities are persisted to Elasticsearch for durability.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CustomerGenerator } from './generators/customer.generator';
import { CommunicationGenerator } from './generators/communication.generator';
import { CaseGenerator } from './generators/case.generator';
import { SocialMentionGenerator } from './generators/social-mention.generator';
import { EventGenerator } from './generators/event.generator';
import { ChunkGenerator } from './generators/chunk.generator';
import { SurveyGenerator } from './generators/survey.generator';
import {
  CommunicationsService,
  CreateCommunicationDto,
} from '../communications';
import { CustomersService } from '../customers';
import { CasesService } from '../cases';
import { SocialMentionsService } from '../social';
import { EventsService } from '../events';
import { ChunksService } from '../chunks';
import { SurveysService } from '../surveys';
import {
  SyntheticCustomer,
  SyntheticCommunication,
  SyntheticCase,
  SyntheticSocialMention,
  SyntheticEvent,
  SyntheticChunk,
  GenerationConfig,
  GenerationResult,
} from './synthetic-data.types';

@Injectable()
export class SyntheticDataService {
  private readonly logger = new Logger(SyntheticDataService.name);
  private readonly defaultConfig: GenerationConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly customerGenerator: CustomerGenerator,
    private readonly communicationGenerator: CommunicationGenerator,
    private readonly caseGenerator: CaseGenerator,
    private readonly socialMentionGenerator: SocialMentionGenerator,
    private readonly eventGenerator: EventGenerator,
    private readonly chunkGenerator: ChunkGenerator,
    private readonly surveyGenerator: SurveyGenerator,
    private readonly communicationsService: CommunicationsService,
    private readonly customersService: CustomersService,
    private readonly casesService: CasesService,
    private readonly socialMentionsService: SocialMentionsService,
    private readonly eventsService: EventsService,
    private readonly chunksService: ChunksService,
    private readonly surveysService: SurveysService,
  ) {
    this.defaultConfig = {
      customerCount:
        this.configService.get<number>('syntheticData.customerCount') || 100,
      communicationsPerCustomer: {
        min:
          this.configService.get<number>(
            'syntheticData.communicationsPerCustomer.min',
          ) || 5,
        max:
          this.configService.get<number>(
            'syntheticData.communicationsPerCustomer.max',
          ) || 30,
      },
      casesPercentage:
        this.configService.get<number>('syntheticData.casesPercentage') || 30,
      casesPerCustomer: {
        min:
          this.configService.get<number>(
            'syntheticData.casesPerCustomer.min',
          ) || 1,
        max:
          this.configService.get<number>(
            'syntheticData.casesPerCustomer.max',
          ) || 5,
      },
      socialMentionsCount:
        this.configService.get<number>('syntheticData.socialMentionsCount') ||
        500,
      eventsCount:
        this.configService.get<number>('syntheticData.eventsCount') || 50,
      dateRange: {
        start: '2024-01-01T00:00:00Z',
        end: new Date().toISOString(),
      },
      sentimentDistribution: {
        positive: 0.35,
        neutral: 0.35,
        negative: 0.2,
        mixed: 0.1,
      },
      channelDistribution: {
        email: 0.4,
        phone: 0.25,
        chat: 0.2,
        letter: 0.05,
        social: 0.1,
      },
    };
  }

  /**
   * Generate all synthetic data
   */
  async generateAll(
    config?: Partial<GenerationConfig>,
  ): Promise<GenerationResult> {
    const startTime = Date.now();
    const mergedConfig: GenerationConfig = { ...this.defaultConfig, ...config };

    this.logger.log('Starting synthetic data generation...');
    this.logger.log(`Config: ${JSON.stringify(mergedConfig, null, 2)}`);

    const dateRange = {
      start: new Date(mergedConfig.dateRange.start),
      end: new Date(mergedConfig.dateRange.end),
    };

    // 1. Generate and store customers
    this.logger.log(`Generating ${mergedConfig.customerCount} customers...`);
    const generatedCustomers = this.customerGenerator.generateMany(
      mergedConfig.customerCount,
    );
    this.logger.log(`Generated ${generatedCustomers.length} customers`);

    // Store customers in Elasticsearch
    this.logger.log('Storing customers in Elasticsearch...');
    // Customer generator now emits canonical tier names (platinum/gold/silver/bronze)
    const customerDtos = generatedCustomers.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      company: c.company,
      tier: c.tier,
      relationshipManager: c.relationshipManager,
      accountType: c.accountType,
      portfolioValue: c.portfolioValue,
      riskProfile: c.riskProfile,
      region: c.region,
      joinedDate: c.joinedDate,
      lastContactDate: c.lastContactDate,
      communicationPreference: c.communicationPreference,
    }));
    const customerResult = await this.customersService.bulkCreate(
      customerDtos as any,
    );
    this.logger.log(`Stored ${customerResult.created} customers`);

    // 2. Generate communications for each customer
    this.logger.log('Generating communications...');
    const allCommunications: SyntheticCommunication[] = [];
    const customerCommunications: Map<string, SyntheticCommunication[]> =
      new Map();

    for (const customer of generatedCustomers) {
      const commCount = Math.floor(
        mergedConfig.communicationsPerCustomer.min +
          Math.random() *
            (mergedConfig.communicationsPerCustomer.max -
              mergedConfig.communicationsPerCustomer.min +
              1),
      );

      const comms = this.communicationGenerator.generateForCustomer(
        customer,
        commCount,
        mergedConfig.channelDistribution,
        mergedConfig.sentimentDistribution,
        dateRange,
      );

      customerCommunications.set(customer.id, comms);
      allCommunications.push(...comms);
    }
    this.logger.log(`Generated ${allCommunications.length} communications`);

    // 3. Store communications in Elasticsearch
    this.logger.log('Storing communications in Elasticsearch...');
    const communicationDtos: CreateCommunicationDto[] = allCommunications.map(
      (comm) => ({
        channel: comm.channel as any,
        direction: comm.direction as any,
        customerId: comm.customerId,
        customerName: comm.customerName,
        caseId: comm.caseId,
        subject: comm.subject,
        content: comm.content,
        summary: comm.summary,
        timestamp: comm.timestamp,
        priority: comm.priority as any,
        sentiment: comm.sentiment as any,
        intent: comm.intent as any,
        entities: comm.entities as any,
        tags: comm.tags,
        metadata: comm.metadata,
        aiClassification: comm.aiClassification as any,
        messages: comm.messages as any,
        threadId: comm.threadId,
      }),
    );

    // Batch insert in chunks
    const batchSize = 100;
    let storedCount = 0;
    for (let i = 0; i < communicationDtos.length; i += batchSize) {
      const batch = communicationDtos.slice(i, i + batchSize);
      const result = await this.communicationsService.createBulk(batch);
      storedCount += result.created;
      this.logger.log(
        `Stored ${storedCount}/${communicationDtos.length} communications`,
      );
    }

    // 4. Generate and store cases
    this.logger.log('Generating cases...');
    const customersWithComms = generatedCustomers.map((customer) => ({
      customer,
      communications: customerCommunications.get(customer.id) || [],
    }));

    const generatedCases = this.caseGenerator.generateForCustomers(
      customersWithComms,
      mergedConfig.casesPercentage,
      mergedConfig.casesPerCustomer,
      dateRange,
    );
    this.logger.log(`Generated ${generatedCases.length} cases`);

    // Store cases in Elasticsearch
    this.logger.log('Storing cases in Elasticsearch...');
    const caseDocs = generatedCases.map((c) => ({
      id: c.id,
      customerId: c.customerId,
      customerName: c.customerName,
      title: c.title,
      description: c.description,
      category: c.category,
      subcategory: c.subcategory,
      product: c.product,
      status: c.status,
      priority: c.priority,
      assignedTo: c.assignedTo,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      resolvedAt: c.resolvedAt,
      slaDeadline: c.slaDeadline,
      slaBreached: c.slaBreached,
      communicationIds: c.communicationIds,
      tags: c.tags,
      resolution: c.resolution,
    }));
    const casesResult = await this.casesService.createBulk(caseDocs);
    this.logger.log(`Stored ${casesResult.created} cases`);

    // 5. Generate and store NPS surveys for cases
    this.logger.log('Generating NPS surveys for cases...');

    // First, generate events so we can correlate surveys with events
    this.logger.log('Generating events first for survey correlation...');
    const generatedEvents = this.eventGenerator.generateMany(
      mergedConfig.eventsCount,
      dateRange,
    );
    this.logger.log(`Generated ${generatedEvents.length} events`);

    // Initialize survey index
    await this.surveysService.initializeIndex();

    // Generate surveys for each case (one per journey stage)
    const generatedSurveys = this.surveyGenerator.generateForCases(
      generatedCases,
      generatedEvents,
    );
    this.logger.log(
      `Generated ${generatedSurveys.length} case-linked NPS surveys`,
    );

    // Generate standalone surveys spread across the full date range
    // These ensure survey coverage across the entire timeline (especially recent dates)
    const standaloneSurveyCount = Math.max(
      200,
      mergedConfig.customerCount * 10,
    );
    const standaloneSurveys = this.surveyGenerator.generateStandalone(
      standaloneSurveyCount,
      dateRange,
    );
    this.logger.log(
      `Generated ${standaloneSurveys.length} standalone NPS surveys`,
    );

    const allSurveys = [...generatedSurveys, ...standaloneSurveys];

    // Store surveys in Elasticsearch
    this.logger.log('Storing surveys in Elasticsearch...');
    await this.surveysService.bulkIndexSurveys(allSurveys);
    this.logger.log(`Stored ${allSurveys.length} surveys`);

    // 6. Generate and store social mentions
    this.logger.log('Generating social mentions...');
    const generatedMentions = this.socialMentionGenerator.generateMany(
      mergedConfig.socialMentionsCount,
      mergedConfig.sentimentDistribution,
      dateRange,
    );
    this.logger.log(`Generated ${generatedMentions.length} social mentions`);

    // Store social mentions in Elasticsearch
    this.logger.log('Storing social mentions in Elasticsearch...');
    const socialDocs = generatedMentions.map((m) => ({
      id: m.id,
      platform: m.platform,
      author: m.author,
      authorHandle: m.authorHandle,
      content: m.content,
      timestamp: m.timestamp,
      sentiment: m.sentiment,
      engagement: m.engagement,
      url: m.url,
      mentionedProducts: m.mentionedProducts,
      tags: m.tags,
      requiresResponse: m.requiresResponse,
      responded: m.responded,
      linkedCustomerId: m.linkedCustomerId,
    }));
    const socialResult =
      await this.socialMentionsService.createBulk(socialDocs);
    this.logger.log(`Stored ${socialResult.created} social mentions`);

    // 7. Store events in Elasticsearch (already generated for survey correlation)
    this.logger.log('Storing events in Elasticsearch...');
    const eventDocs = generatedEvents.map((e) => ({
      id: e.id,
      type: e.type,
      label: e.label,
      description: e.description,
      startDate: e.startDate,
      endDate: e.endDate,
      product: e.product,
      channels: e.channels,
      affectedRegions: e.affectedRegions,
      severity: e.severity,
      estimatedImpact: e.estimatedImpact,
      status: e.status,
      correlatedCommunications: e.correlatedCommunications,
      sentimentDuringEvent: e.sentimentDuringEvent,
      source: e.source,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));
    const eventsResult = await this.eventsService.createBulk(eventDocs);
    this.logger.log(`Stored ${eventsResult.created} events`);

    // 8. Generate and store chunks from communications
    this.logger.log('Generating chunks from communications...');
    const generatedChunks =
      this.chunkGenerator.generateFromCommunications(allCommunications);
    this.logger.log(`Generated ${generatedChunks.length} chunks`);

    // Store chunks in Elasticsearch (in batches)
    this.logger.log('Storing chunks in Elasticsearch...');
    let chunksStoredCount = 0;
    for (let i = 0; i < generatedChunks.length; i += batchSize) {
      const batch = generatedChunks.slice(i, i + batchSize);
      const chunkDocs = batch.map((c) => ({
        chunkId: c.chunkId,
        communicationId: c.communicationId,
        content: c.content,
        context: c.context,
        position: c.position,
        chunkType: c.chunkType,
        tokenCount: c.tokenCount,
        overlap: c.overlap,
        metadata: c.metadata,
        createdAt: c.createdAt,
      }));
      const result = await this.chunksService.createBulk(chunkDocs);
      chunksStoredCount += result.created;
      this.logger.log(
        `Stored ${chunksStoredCount}/${generatedChunks.length} chunks`,
      );
    }

    const duration = Date.now() - startTime;
    this.logger.log(`Synthetic data generation completed in ${duration}ms`);

    return {
      customers: customerResult.created,
      communications: storedCount,
      cases: casesResult.created,
      socialMentions: socialResult.created,
      events: eventsResult.created,
      surveys: generatedSurveys.length,
      chunks: chunksStoredCount,
      duration,
    };
  }

  /**
   * Get generation status
   * Note: Returns approximate counts from Elasticsearch
   */
  async getStatus(): Promise<{
    customers: number;
    communications: number;
    cases: number;
    socialMentions: number;
  }> {
    // Query counts from each service
    const [customers, communications, cases, socialMentions] =
      await Promise.all([
        this.customersService
          .getAll()
          .then((r) => r.length)
          .catch(() => 0),
        this.communicationsService
          .search({ size: 0 } as any)
          .then((r) => r.total)
          .catch(() => 0),
        this.casesService
          .search()
          .then((r) => r.total)
          .catch(() => 0),
        this.socialMentionsService
          .search()
          .then((r) => r.total)
          .catch(() => 0),
      ]);

    return {
      customers,
      communications,
      cases,
      socialMentions,
    };
  }

  /**
   * Get all customers from Elasticsearch
   */
  async getAllCustomers(): Promise<any[]> {
    return this.customersService.getAll();
  }

  /**
   * Get customer by ID from Elasticsearch
   */
  async getCustomer(id: string): Promise<any | undefined> {
    try {
      return await this.customersService.findById(id);
    } catch {
      return undefined;
    }
  }

  /**
   * Get all cases from Elasticsearch
   */
  async getAllCases(): Promise<any[]> {
    const result = await this.casesService.search();
    return result.hits.map((h: any) => h.source);
  }

  /**
   * Get case by ID from Elasticsearch
   */
  async getCase(id: string): Promise<any | undefined> {
    try {
      return await this.casesService.findById(id);
    } catch {
      return undefined;
    }
  }

  /**
   * Get cases by customer from Elasticsearch
   */
  async getCasesByCustomer(customerId: string): Promise<any[]> {
    return this.casesService.findByCustomer(customerId);
  }

  /**
   * Get all social mentions from Elasticsearch
   */
  async getAllSocialMentions(): Promise<any[]> {
    const result = await this.socialMentionsService.search();
    return result.hits.map((h: any) => h.source);
  }

  /**
   * Get social mention by ID from Elasticsearch
   */
  async getSocialMention(id: string): Promise<any | undefined> {
    try {
      return await this.socialMentionsService.findById(id);
    } catch {
      return undefined;
    }
  }

  /**
   * Clear all data from Elasticsearch
   */
  async clearAll(): Promise<{
    customers: number;
    communications: number;
    cases: number;
    socialMentions: number;
    events: number;
    surveys: number;
    chunks: number;
  }> {
    this.logger.log('Clearing all synthetic data from Elasticsearch...');

    const results = {
      customers: 0,
      communications: 0,
      cases: 0,
      socialMentions: 0,
      events: 0,
      surveys: 0,
      chunks: 0,
    };

    try {
      const customerResult = await this.customersService.deleteAll();
      results.customers = customerResult.deleted;
      this.logger.log(`Deleted ${results.customers} customers`);
    } catch (error) {
      this.logger.warn(`Failed to clear customers: ${error.message}`);
    }

    try {
      const commResult = await this.communicationsService.deleteAll();
      results.communications = commResult.deleted;
      this.logger.log(`Deleted ${results.communications} communications`);
    } catch (error) {
      this.logger.warn(`Failed to clear communications: ${error.message}`);
    }

    try {
      const caseResult = await this.casesService.deleteAll();
      results.cases = caseResult.deleted;
      this.logger.log(`Deleted ${results.cases} cases`);
    } catch (error) {
      this.logger.warn(`Failed to clear cases: ${error.message}`);
    }

    try {
      const socialResult = await this.socialMentionsService.deleteAll();
      results.socialMentions = socialResult.deleted;
      this.logger.log(`Deleted ${results.socialMentions} social mentions`);
    } catch (error) {
      this.logger.warn(`Failed to clear social mentions: ${error.message}`);
    }

    try {
      const eventResult = await this.eventsService.deleteAll();
      results.events = eventResult.deleted;
      this.logger.log(`Deleted ${results.events} events`);
    } catch (error) {
      this.logger.warn(`Failed to clear events: ${error.message}`);
    }

    try {
      await this.surveysService.deleteAll();
      this.logger.log('Deleted all surveys');
    } catch (error) {
      this.logger.warn(`Failed to clear surveys: ${error.message}`);
    }

    try {
      const chunkResult = await this.chunksService.deleteAll();
      results.chunks = chunkResult.deleted;
      this.logger.log(`Deleted ${results.chunks} chunks`);
    } catch (error) {
      this.logger.warn(`Failed to clear chunks: ${error.message}`);
    }

    this.logger.log('Cleared all synthetic data');
    return results;
  }

  /**
   * Generate sample data for testing (smaller dataset)
   */
  async generateSample(): Promise<GenerationResult> {
    return this.generateAll({
      customerCount: 10,
      communicationsPerCustomer: { min: 3, max: 10 },
      casesPercentage: 30,
      casesPerCustomer: { min: 1, max: 2 },
      socialMentionsCount: 60,
    });
  }

  /**
   * Generate full demo dataset
   */
  async generateDemo(): Promise<GenerationResult> {
    return this.generateAll({
      customerCount: 100,
      communicationsPerCustomer: { min: 10, max: 40 },
      casesPercentage: 30,
      casesPerCustomer: { min: 1, max: 4 },
      socialMentionsCount: 600,
    });
  }
}
