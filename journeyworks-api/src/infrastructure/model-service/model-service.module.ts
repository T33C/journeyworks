/**
 * Model Service Module
 *
 * HTTP client for the Python model-service (embeddings, reranking).
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { ModelServiceClient } from './model-service.client';

@Global()
@Module({
  imports: [
    ConfigModule,
    HttpModule.register({
      timeout: 60000, // 60 seconds for embedding operations
      maxRedirects: 3,
    }),
  ],
  providers: [ModelServiceClient],
  exports: [ModelServiceClient],
})
export class ModelServiceModule {}
