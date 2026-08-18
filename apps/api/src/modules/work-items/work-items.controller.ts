import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatedUser,
  BacklogNode,
  BoardColumn,
  CreateWorkItemInput,
  MoveWorkItemInput,
  UpdateWorkItemInput,
  WorkItemDetail,
  WorkItemFilters,
  WorkItemSummary,
  createWorkItemSchema,
  moveWorkItemSchema,
  updateWorkItemSchema,
  workItemFiltersSchema,
} from '@visiora/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProjectId } from '../../common/decorators/project-id.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { WorkItemsService } from './work-items.service';

@ApiTags('work-items')
@ApiParam({ name: 'projectId', description: 'UUID du projet ou clé courte (ex. VIS)' })
@Controller('projects/:projectId')
export class WorkItemsController {
  constructor(private readonly workItems: WorkItemsService) {}

  @Get('backlog')
  @ApiOperation({ summary: 'Backlog hiérarchique : Epic > Story > Sous-tâche' })
  getBacklog(
    @ProjectId() projectId: string,
    @Query(new ZodValidationPipe(workItemFiltersSchema)) filters: WorkItemFilters,
  ): Promise<BacklogNode[]> {
    return this.workItems.getBacklog(projectId, filters);
  }

  @Get('board')
  @ApiOperation({ summary: 'Task Board : tickets répartis dans les 5 colonnes' })
  getBoard(
    @ProjectId() projectId: string,
    @Query(new ZodValidationPipe(workItemFiltersSchema)) filters: WorkItemFilters,
  ): Promise<BoardColumn[]> {
    return this.workItems.getBoard(projectId, filters);
  }

  @Get('work-items/:itemId')
  @ApiOperation({ summary: "Détail d'un ticket" })
  getById(
    @ProjectId() projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<WorkItemDetail> {
    return this.workItems.getById(projectId, itemId);
  }

  @Post('work-items')
  @RequirePermission('workitem:create')
  @ApiOperation({ summary: 'Création d’un epic, d’une story, d’un bug ou d’une sous-tâche' })
  create(
    @ProjectId() projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createWorkItemSchema)) dto: CreateWorkItemInput,
  ): Promise<WorkItemDetail> {
    return this.workItems.create(projectId, dto, user.id);
  }

  @Patch('work-items/:itemId')
  @RequirePermission('workitem:update')
  @ApiOperation({ summary: 'Modification d’un ticket, de ses étiquettes et de ses critères' })
  update(
    @ProjectId() projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body(new ZodValidationPipe(updateWorkItemSchema)) dto: UpdateWorkItemInput,
  ): Promise<WorkItemDetail> {
    return this.workItems.update(projectId, itemId, dto);
  }

  /**
   * Déplacement par glisser-déposer. `workitem:move` couvre le board ; le
   * réordonnancement du backlog exige en plus `backlog:reorder`, contrôlé dans
   * la route dédiée ci-dessous.
   */
  @Post('work-items/:itemId/move')
  @RequirePermission('workitem:move')
  @ApiOperation({ summary: 'Déplacement sur le board (changement de colonne et de position)' })
  move(
    @ProjectId() projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body(new ZodValidationPipe(moveWorkItemSchema)) dto: MoveWorkItemInput,
  ): Promise<WorkItemSummary> {
    return this.workItems.move(projectId, itemId, dto);
  }

  @Post('work-items/:itemId/reorder')
  @RequirePermission('backlog:reorder')
  @ApiOperation({ summary: 'Repriorisation dans le backlog (position et rattachement)' })
  reorder(
    @ProjectId() projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body(new ZodValidationPipe(moveWorkItemSchema)) dto: MoveWorkItemInput,
  ): Promise<WorkItemSummary> {
    // Le statut ne se change pas depuis le backlog : c'est le rôle du board.
    return this.workItems.move(projectId, itemId, { ...dto, status: undefined });
  }

  @Delete('work-items/:itemId')
  @RequirePermission('workitem:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Suppression logique du ticket et de ses descendants' })
  async remove(
    @ProjectId() projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<void> {
    await this.workItems.softDelete(projectId, itemId);
  }
}
