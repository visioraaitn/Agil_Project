import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
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
@ApiParam({ name: 'projectId', description: 'UUID du projet ou cle courte (ex. VIS)' })
@Controller('projects/:projectId/repositories')
export class RepositoriesController {
  constructor(private readonly repositories: RepositoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Depots Git references du projet' })
  list(@ProjectId() projectId: string): Promise<RepositorySummary[]> {
    return this.repositories.list(projectId);
  }

  @Post()
  @RequirePermission('repo:manage')
  @ApiOperation({ summary: "Reference un depot Git externe" })
  create(
    @ProjectId() projectId: string,
    @Body(new ZodValidationPipe(createRepositorySchema)) dto: CreateRepositoryInput,
  ): Promise<RepositorySummary> {
    return this.repositories.create(projectId, dto);
  }

  @Patch(':repositoryId')
  @RequirePermission('repo:manage')
  @ApiOperation({ summary: "Modifie un depot reference" })
  update(
    @ProjectId() projectId: string,
    @Param('repositoryId', ParseUUIDPipe) repositoryId: string,
    @Body(new ZodValidationPipe(updateRepositorySchema)) dto: UpdateRepositoryInput,
  ): Promise<RepositorySummary> {
    return this.repositories.update(projectId, repositoryId, dto);
  }

  @Get(':repositoryId/branches')
  @ApiOperation({ summary: 'Branches connues pour un depot' })
  listBranches(
    @ProjectId() projectId: string,
    @Param('repositoryId', ParseUUIDPipe) repositoryId: string,
  ): Promise<BranchSummary[]> {
    return this.repositories.listBranches(projectId, repositoryId);
  }

  @Post(':repositoryId/branches')
  @RequirePermission('repo:manage')
  @ApiOperation({ summary: 'Cree une reference locale de branche' })
  createBranch(
    @ProjectId() projectId: string,
    @Param('repositoryId', ParseUUIDPipe) repositoryId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createBranchSchema)) dto: CreateBranchInput,
  ): Promise<BranchSummary> {
    return this.repositories.createBranch(projectId, repositoryId, dto, user.id);
  }
}
