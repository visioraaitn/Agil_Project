import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatedUser,
  CreatePullRequestInput,
  PullRequestDetail,
  PullRequestSummary,
  PullRequestStatus,
  UpdatePullRequestStatusInput,
  createPullRequestSchema,
  updatePullRequestStatusSchema,
} from '@visiora/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProjectId } from '../../common/decorators/project-id.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PullRequestsService } from './pull-requests.service';

@ApiTags('pull-requests')
@ApiParam({ name: 'projectId', description: 'UUID du projet ou cle courte (ex. VIS)' })
@Controller('projects/:projectId/pull-requests')
export class PullRequestsController {
  constructor(private readonly pullRequests: PullRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Pull requests declarees dans le projet' })
  list(@ProjectId() projectId: string): Promise<PullRequestSummary[]> {
    return this.pullRequests.list(projectId);
  }

  @Get(':pullRequestId')
  @ApiOperation({ summary: "Detail et historique d'une pull request" })
  getById(
    @ProjectId() projectId: string,
    @Param('pullRequestId', ParseUUIDPipe) pullRequestId: string,
  ): Promise<PullRequestDetail> {
    return this.pullRequests.getById(projectId, pullRequestId);
  }

  @Post()
  @RequirePermission('pr:declare')
  @ApiOperation({ summary: 'Declaration manuelle de PR' })
  create(
    @ProjectId() projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createPullRequestSchema)) dto: CreatePullRequestInput,
  ): Promise<PullRequestDetail> {
    return this.pullRequests.create(projectId, dto, user.id);
  }

  @Patch(':pullRequestId/status')
  @RequirePermission('pr:approve')
  @ApiOperation({ summary: 'Changement de statut de PR' })
  updateStatus(
    @ProjectId() projectId: string,
    @Param('pullRequestId', ParseUUIDPipe) pullRequestId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updatePullRequestStatusSchema)) dto: UpdatePullRequestStatusInput,
  ): Promise<PullRequestDetail> {
    return this.pullRequests.updateStatus(projectId, pullRequestId, dto, user.id);
  }

  @Patch(':pullRequestId/ready')
  @RequirePermission('pr:declare')
  @ApiOperation({ summary: 'Marque une PR prete pour approbation' })
  markReady(
    @ProjectId() projectId: string,
    @Param('pullRequestId', ParseUUIDPipe) pullRequestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PullRequestDetail> {
    return this.pullRequests.updateStatus(
      projectId,
      pullRequestId,
      { status: PullRequestStatus.READY_FOR_APPROVAL },
      user.id,
    );
  }

  @Patch(':pullRequestId/review')
  @RequirePermission('pr:approve')
  @ApiOperation({ summary: 'Approbation ou rejet PO' })
  review(
    @ProjectId() projectId: string,
    @Param('pullRequestId', ParseUUIDPipe) pullRequestId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updatePullRequestStatusSchema)) dto: UpdatePullRequestStatusInput,
  ): Promise<PullRequestDetail> {
    return this.pullRequests.updateStatus(projectId, pullRequestId, dto, user.id);
  }
}
