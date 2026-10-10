import { Module } from '@nestjs/common';
import { BoardColumnsController } from './board-columns.controller';
import { BoardColumnsService } from './board-columns.service';
import { WorkItemsController } from './work-items.controller';
import { WorkItemsService } from './work-items.service';
import { WorkItemImportService } from './work-item-import.service';
import { RankingService } from './ranking.service';

@Module({
  controllers: [WorkItemsController, BoardColumnsController],
  providers: [WorkItemsService, RankingService, WorkItemImportService, BoardColumnsService],
  exports: [WorkItemsService, BoardColumnsService],
})
export class WorkItemsModule {}
