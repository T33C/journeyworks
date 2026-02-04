/**
 * Communications Module
 *
 * Handles CRUD and search operations for customer communications.
 */

import { Module } from '@nestjs/common';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { CommunicationsRepository } from './communications.repository';

@Module({
  controllers: [CommunicationsController],
  providers: [CommunicationsService, CommunicationsRepository],
  exports: [CommunicationsService, CommunicationsRepository],
})
export class CommunicationsModule {}
