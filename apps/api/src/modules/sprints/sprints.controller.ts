import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatedUser,
  CloseSprintInput,
  CreateSprintInput,
  ListSprintsQuery,
  RoadmapEpic,
  SprintDetail,
  SprintSummary,
  UpdateRetrospectiveInput,
  UpdateSprintInput,
  closeSprintSchema,
  createSprintSchema,
  listSprintsQuerySchema,
  updateRetrospectiveSchema,
  updateSprintSchema,
} from '@visiora/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProjectId } from '../../common/decorators/project-id.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SprintsService } from './sprints.service';

@ApiTags('sprints')
@ApiParam({ name: 'projectId', description: 'UUID du projet ou cle courte (ex. VIS)' })
@Controller('projects/:projectId')
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  @Get('sprints')
  @ApiOperation({ summary: 'Liste des sprints du projet' })
  list(
    @ProjectId() projectId: string,
    @Query(new ZodValidationPipe(listSprintsQuerySchema)) query: ListSprintsQuery,
  ): Promise<SprintSummary[]> {
    return this.sprints.list(projectId, query);
  }

  @Get('sprints/:sprintId')
  @ApiOperation({ summary: "Detail d'un sprint" })
  getById(
    @ProjectId() projectId: string,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
  ): Promise<SprintDetail> {
    return this.sprints.getById(projectId, sprintId);
  }

  @Post('sprints')
  @RequirePermission('sprint:manage')
  @ApiOperation({ summary: "Creation d'un sprint" })
  create(
    @ProjectId() projectId: string,
    @Body(new ZodValidationPipe(createSprintSchema)) dto: CreateSprintInput,
  ): Promise<SprintDetail> {
    return this.sprints.create(projectId, dto);
  }

  @Patch('sprints/:sprintId')
  @RequirePermission('sprint:manage')
  @ApiOperation({ summary: "Modification d'un sprint" })
  update(
    @ProjectId() projectId: string,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Body(new ZodValidationPipe(updateSprintSchema)) dto: UpdateSprintInput,
  ): Promise<SprintDetail> {
    return this.sprints.update(projectId, sprintId, dto);
  }

  @Post('sprints/:sprintId/close')
  @RequirePermission('sprint:close')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cloture du sprint avec figeage des points' })
  close(
    @ProjectId() projectId: string,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Body(new ZodValidationPipe(closeSprintSchema)) dto: CloseSprintInput,
  ): Promise<SprintDetail> {
    return this.sprints.close(projectId, sprintId, dto);
  }

  @Patch('sprints/:sprintId/retrospective')
  @RequirePermission('retro:manage')
  @ApiOperation({ summary: 'Mise a jour de la retrospective du sprint' })
  updateRetrospective(
    @ProjectId() projectId: string,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updateRetrospectiveSchema)) dto: UpdateRetrospectiveInput,
  ): Promise<SprintDetail> {
    return this.sprints.updateRetrospective(projectId, sprintId, dto, user.id);
  }

  @Get('roadmap')
  @ApiOperation({ summary: 'Roadmap des epics dates du projet' })
  roadmap(@ProjectId() projectId: string): Promise<RoadmapEpic[]> {
    return this.sprints.roadmap(projectId);
  }
}
