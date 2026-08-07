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
  AddProjectMemberInput,
  AuthenticatedUser,
  CreateProjectInput,
  ListProjectsQuery,
  Paginated,
  ProjectAccess,
  ProjectMemberSummary,
  ProjectSummary,
  UpdateProjectInput,
  UpdateProjectMemberInput,
  addProjectMemberSchema,
  createProjectSchema,
  listProjectsQuerySchema,
  updateProjectMemberSchema,
  updateProjectSchema,
} from '@visiora/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProjectId } from '../../common/decorators/project-id.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ProjectAccessService } from '../access/project-access.service';
import { ProjectsService } from './projects.service';

/**
 * `:projectId` accepte l'UUID ou la clé courte (« VIS ») : le guard résout
 * l'identifiant réel une fois pour toutes et le fournit via `@ProjectId()`.
 */
@ApiTags('projects')
@ApiParam({ name: 'projectId', description: 'UUID du projet ou clé courte (ex. VIS)' })
@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly access: ProjectAccessService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Projets visibles par l’utilisateur courant' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query(new ZodValidationPipe(listProjectsQuerySchema)) query: ListProjectsQuery,
  ): Promise<Paginated<ProjectSummary>> {
    return this.projects.list(user, query);
  }

  @Post()
  @RequirePermission('project:create')
  @ApiOperation({ summary: 'Création de projet' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createProjectSchema)) dto: CreateProjectInput,
  ): Promise<ProjectSummary> {
    return this.projects.create(dto, user.id);
  }

  @Get(':projectId')
  @ApiOperation({ summary: "Détail d'un projet" })
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @ProjectId() projectId: string,
  ): Promise<ProjectSummary> {
    return this.projects.getById(user, projectId);
  }

  @Get(':projectId/access')
  @ApiOperation({ summary: 'Rôle et permissions effectives de l’utilisateur sur ce projet' })
  getAccess(
    @CurrentUser() user: AuthenticatedUser,
    @ProjectId() projectId: string,
  ): Promise<ProjectAccess> {
    return this.access.getProjectAccess(user, projectId);
  }

  @Patch(':projectId')
  @RequirePermission('project:update')
  @ApiOperation({ summary: "Modification d'un projet" })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @ProjectId() projectId: string,
    @Body(new ZodValidationPipe(updateProjectSchema)) dto: UpdateProjectInput,
  ): Promise<ProjectSummary> {
    return this.projects.update(user, projectId, dto);
  }

  @Delete(':projectId')
  @RequirePermission('project:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Archivage du projet' })
  async archive(@ProjectId() projectId: string): Promise<void> {
    await this.projects.archive(projectId);
  }

  // --- Membres ------------------------------------------------------------

  @Get(':projectId/members')
  @ApiOperation({ summary: 'Membres du projet et leurs rôles' })
  listMembers(@ProjectId() projectId: string): Promise<ProjectMemberSummary[]> {
    return this.projects.listMembers(projectId);
  }

  @Post(':projectId/members')
  @RequirePermission('project:member:manage')
  @ApiOperation({ summary: 'Affectation d’un utilisateur au projet' })
  addMember(
    @ProjectId() projectId: string,
    @Body(new ZodValidationPipe(addProjectMemberSchema)) dto: AddProjectMemberInput,
  ): Promise<ProjectMemberSummary> {
    return this.projects.addMember(projectId, dto);
  }

  @Patch(':projectId/members/:userId')
  @RequirePermission('project:member:manage')
  @ApiOperation({ summary: 'Changement de rôle ou de capacité d’un membre' })
  updateMember(
    @ProjectId() projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body(new ZodValidationPipe(updateProjectMemberSchema)) dto: UpdateProjectMemberInput,
  ): Promise<ProjectMemberSummary> {
    return this.projects.updateMember(projectId, userId, dto);
  }

  @Delete(':projectId/members/:userId')
  @RequirePermission('project:member:manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Retrait d’un membre du projet' })
  async removeMember(
    @ProjectId() projectId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<void> {
    await this.projects.removeMember(projectId, userId);
  }
}
