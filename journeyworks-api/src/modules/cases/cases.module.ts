/**
 * Cases Module
 */

import { Module } from '@nestjs/common';
import { CasesService } from './cases.service';
import { CasesRepository } from './cases.repository';
import { ElasticsearchModule } from '../../infrastructure/elasticsearch';

@Module({
  imports: [ElasticsearchModule],
  providers: [CasesService, CasesRepository],
  exports: [CasesService, CasesRepository],
})
export class CasesModule {}
