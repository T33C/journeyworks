/**
 * Social Module
 *
 * Provides social media mention management capabilities backed by Elasticsearch.
 */

import { Module } from '@nestjs/common';
import { SocialMentionsRepository } from './social-mentions.repository';
import { SocialMentionsService } from './social-mentions.service';
import { ElasticsearchModule } from '../../infrastructure/elasticsearch';

@Module({
  imports: [ElasticsearchModule],
  providers: [SocialMentionsRepository, SocialMentionsService],
  exports: [SocialMentionsService, SocialMentionsRepository],
})
export class SocialModule {}
