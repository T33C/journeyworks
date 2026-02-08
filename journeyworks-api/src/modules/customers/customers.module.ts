/**
 * Customers Module
 *
 * Handles CRUD and search operations for customers backed by Elasticsearch.
 */

import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomersRepository } from './customers.repository';
import { ElasticsearchModule } from '../../infrastructure/elasticsearch';
import { CommunicationsModule } from '../communications/communications.module';
import { CasesModule } from '../cases/cases.module';

@Module({
  imports: [ElasticsearchModule, CommunicationsModule, CasesModule],
  controllers: [CustomersController],
  providers: [CustomersService, CustomersRepository],
  exports: [CustomersService, CustomersRepository],
})
export class CustomersModule {}
