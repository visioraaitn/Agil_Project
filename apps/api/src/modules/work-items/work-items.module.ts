import { Module } from '@nestjs/common';
import { WorkItemsController } from './work-items.controller';
import { WorkItemsService } from './work-items.service';
import { RankingService } from './ranking.service';

@Module({
  controllers: [WorkItemsController],
  providers: [WorkItemsService, RankingService],
  exports: [WorkItemsService],
})
export class WorkItemsModule {}
