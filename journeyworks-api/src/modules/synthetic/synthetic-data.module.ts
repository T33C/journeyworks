/**
 * Synthetic Data Module
 *
 * Generates realistic synthetic data for the PoC.
 */

import { Module } from '@nestjs/common';
import { SyntheticDataService } from './synthetic-data.service';
import { SyntheticDataController } from './synthetic-data.controller';
import { CustomerGenerator } from './generators/customer.generator';
import { CommunicationGenerator } from './generators/communication.generator';
import { CaseGenerator } from './generators/case.generator';
import { SocialMentionGenerator } from './generators/social-mention.generator';
import { EventGenerator } from './generators/event.generator';
import { EventCommunicationGenerator } from './generators/event-communication.generator';
import { ChunkGenerator } from './generators/chunk.generator';
import { SurveyGenerator } from './generators/survey.generator';
import { CommunicationsModule } from '../communications';
import { CustomersModule } from '../customers';
import { CasesModule } from '../cases';
import { SocialModule } from '../social';
import { EventsModule } from '../events';
import { ChunksModule } from '../chunks';
import { SurveysModule } from '../surveys';

@Module({
  imports: [
    CommunicationsModule,
    CustomersModule,
    CasesModule,
    SocialModule,
    EventsModule,
    ChunksModule,
    SurveysModule,
  ],
  controllers: [SyntheticDataController],
  providers: [
    SyntheticDataService,
    CustomerGenerator,
    CommunicationGenerator,
    CaseGenerator,
    SocialMentionGenerator,
    EventGenerator,
    EventCommunicationGenerator,
    ChunkGenerator,
    SurveyGenerator,
  ],
  exports: [SyntheticDataService],
})
export class SyntheticDataModule {}
