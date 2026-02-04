/**
 * JourneyWorks API - Root Module
 *
 * This is the main application module that imports all feature and infrastructure modules.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// Infrastructure Modules
import { ElasticsearchModule } from './infrastructure/elasticsearch/elasticsearch.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { LlmModule } from './infrastructure/llm/llm.module';
import { ModelServiceModule } from './infrastructure/model-service/model-service.module';
import { AnalysisServiceModule } from './infrastructure/analysis-service/analysis-service.module';

// Feature Modules
import { CommunicationsModule } from './modules/communications/communications.module';
import { SyntheticDataModule } from './modules/synthetic/synthetic-data.module';
import { RagModule } from './modules/rag/rag.module';
import { RrgModule } from './modules/rrg/rrg.module';
import { AnalysisModule } from './modules/analysis/analysis.module';
import { ResearchModule } from './modules/research/research.module';
import { CustomersModule } from './modules/customers/customers.module';
// import { CasesModule } from './modules/cases/cases.module';
// import { EventsModule } from './modules/events/events.module';
// import { SocialModule } from './modules/social/social.module';

// Configuration
import configuration from './config/configuration';

@Module({
  imports: [
    // Global configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // Scheduler for background tasks
    ScheduleModule.forRoot(),

    // Infrastructure modules
    ElasticsearchModule,
    RedisModule,
    LlmModule,
    ModelServiceModule,
    AnalysisServiceModule,

    // Feature modules
    CommunicationsModule,
    SyntheticDataModule,
    RagModule,
    RrgModule,
    AnalysisModule,
    ResearchModule,
    CustomersModule,
    // CasesModule,
    // EventsModule,
    // SocialModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
