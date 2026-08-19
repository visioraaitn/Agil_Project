import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatedUser,
  BranchSummary,
  CreateBranchInput,
  CreateRepositoryInput,
  RepositorySummary,
  UpdateRepositoryInput,
  createBranchSchema,
  createRepositorySchema,
  updateRepositorySchema,
} from '@visiora/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProjectId } from '../../common/decorators/project-id.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RepositoriesService } from './repositories.service';

@ApiTags('repositories')
@ApiParam({ name: 'projectId', description: 'UUID du projet ou clé courte (ex. VIS)' })
@Controller('projects/:projectId/repositories')
export class RepositoriesController {
  constructor(private readonly repositories: RepositoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Dépôts Git référencés du projet' })
  list(@ProjectId() projectId: string): Promise<RepositorySummary[]> {
    return this.repositories.list(projectId);
  }

  @Post()
  @RequirePermission('repo:manage')
  @ApiOperation({ summary: 'Référence un dépôt Git externe' })
  create(
    @ProjectId() projectId: string,
    @Body(new ZodValidationPipe(createRepositorySchema)) dto: CreateRepositoryInput,
  ): Promise<RepositorySummary> {
    return this.repositories.create(projectId, dto);
  }

  @Patch(':repositoryId')
  @RequirePermission('repo:manage')
  @ApiOperation({ summary: 'Modifie un dépôt référencé (métadonnées ou archivage)' })
  update(
    @ProjectId() projectId: string,
    @Param('repositoryId', ParseUUIDPipe) repositoryId: string,
    @Body(new ZodValidationPipe(updateRepositorySchema)) dto: UpdateRepositoryInput,
  ): Promise<RepositorySummary> {
    return this.repositories.update(projectId, repositoryId, dto);
  }

  @Delete(':repositoryId')
  @RequirePermission('repo:manage')
  @ApiOperation({ summary: 'Supprime un dépôt référencé' })
  delete(
    @ProjectId() projectId: string,
    @Param('repositoryId', ParseUUIDPipe) repositoryId: string,
  ): Promise<{ ok: boolean }> {
    return this.repositories.delete(projectId, repositoryId).then(() => ({ ok: true }));
  }

  @Get(':repositoryId/branches')
  @ApiOperation({ summary: 'Branches connues pour un dépôt' })
  listBranches(
    @ProjectId() projectId: string,
    @Param('repositoryId', ParseUUIDPipe) repositoryId: string,
  ): Promise<BranchSummary[]> {
    return this.repositories.listBranches(projectId, repositoryId);
  }

  @Post(':repositoryId/branches')
  @RequirePermission('branch:create')
  @ApiOperation({ summary: 'Crée une référence locale ou distante de branche' })
  createBranch(
    @ProjectId() projectId: string,
    @Param('repositoryId', ParseUUIDPipe) repositoryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createBranchSchema)) dto: CreateBranchInput,
  ): Promise<BranchSummary> {
    return this.repositories.createBranch(projectId, repositoryId, dto, user.id);
  }

  @Delete(':repositoryId/branches/:branchId')
  @RequirePermission('branch:delete')
  @ApiOperation({ summary: 'Supprime une branche avec validation de protection et de PR active' })
  deleteBranch(
    @ProjectId() projectId: string,
    @Param('repositoryId', ParseUUIDPipe) repositoryId: string,
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ ok: boolean }> {
    return this.repositories
      .deleteBranch(projectId, repositoryId, branchId, user.id, user.globalRole)
      .then(() => ({ ok: true }));
  }
}
