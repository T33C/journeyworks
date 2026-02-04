/**
 * Analysis Service Module
 *
 * HTTP client for the Python analysis-service (data cards, statistical analysis).
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AnalysisServiceClient } from './analysis-service.client';

@Global()
@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 120000, // 2 minutes for complex analysis
      maxRedirects: 3,
    }),
  ],
  providers: [AnalysisServiceClient],
  exports: [AnalysisServiceClient],
})
export class AnalysisServiceModule {}
