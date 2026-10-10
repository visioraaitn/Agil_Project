import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  BoardColumnConfig,
  SaveBoardColumnsInput,
  saveBoardColumnsSchema,
} from '@visiora/shared';
import { ProjectId } from '../../common/decorators/project-id.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { BoardColumnsService } from './board-columns.service';

@ApiTags('board')
@ApiParam({ name: 'projectId', description: 'UUID du projet ou clé courte (ex. VIS)' })
@Controller('projects/:projectId/board/columns')
export class BoardColumnsController {
  constructor(private readonly boardColumns: BoardColumnsService) {}

  @Get()
  @ApiOperation({ summary: 'Colonnes du board dans leur ordre d’affichage' })
  list(@ProjectId() projectId: string): Promise<BoardColumnConfig[]> {
    return this.boardColumns.list(projectId);
  }

  @Put()
  @RequirePermission('board:configure')
  @ApiOperation({
    summary: 'Remplace la configuration des colonnes (ordre, noms, WIP, visibilité, ajouts)',
  })
  save(
    @ProjectId() projectId: string,
    @Body(new ZodValidationPipe(saveBoardColumnsSchema)) dto: SaveBoardColumnsInput,
  ): Promise<BoardColumnConfig[]> {
    return this.boardColumns.save(projectId, dto);
  }
}
