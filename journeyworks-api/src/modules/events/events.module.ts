/**
 * Events Module
 */

import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsRepository } from './events.repository';
import { ElasticsearchModule } from '../../infrastructure/elasticsearch';

@Module({
  imports: [ElasticsearchModule],
  providers: [EventsService, EventsRepository],
  exports: [EventsService, EventsRepository],
})
export class EventsModule {}
