import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  AuthenticatedUser,
  CreatePullRequestCommentInput,
  CreatePullRequestInput,
  PullRequestCommentSummary,
  PullRequestDetail,
  PullRequestStatus,
  PullRequestSummary,
  UpdatePullRequestStatusInput,
  createPullRequestCommentSchema,
  createPullRequestSchema,
  updatePullRequestStatusSchema,
} from '@visiora/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProjectId } from '../../common/decorators/project-id.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PullRequestsService } from './pull-requests.service';

@ApiTags('pull-requests')
@ApiParam({ name: 'projectId', description: 'UUID du projet ou clé courte (ex. VIS)' })
@Controller('projects/:projectId/pull-requests')
export class PullRequestsController {
  constructor(private readonly pullRequests: PullRequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Liste des Pull Requests du projet avec filtres' })
  @ApiQuery({ name: 'repositoryId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: PullRequestStatus })
  list(
    @ProjectId() projectId: string,
    @Query('repositoryId') repositoryId?: string,
    @Query('status') status?: PullRequestStatus,
  ): Promise<PullRequestSummary[]> {
    return this.pullRequests.list(projectId, { repositoryId, status });
  }

  @Get(':pullRequestId')
  @ApiOperation({ summary: 'Détail complet, discussion et historique d’une Pull Request' })
  getById(
    @ProjectId() projectId: string,
    @Param('pullRequestId', ParseUUIDPipe) pullRequestId: string,
  ): Promise<PullRequestDetail> {
    return this.pullRequests.getById(projectId, pullRequestId);
  }

  @Post()
  @RequirePermission('pr:declare')
  @ApiOperation({ summary: 'Création d’une Pull Request' })
  create(
    @ProjectId() projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createPullRequestSchema)) dto: CreatePullRequestInput,
  ): Promise<PullRequestDetail> {
    return this.pullRequests.create(projectId, dto, user.id);
  }

  @Patch(':pullRequestId/status')
  @RequirePermission('pr:review')
  @ApiOperation({ summary: 'Mise à jour directe de statut (compatibilité)' })
  updateStatus(
    @ProjectId() projectId: string,
    @Param('pullRequestId', ParseUUIDPipe) pullRequestId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(updatePullRequestStatusSchema)) dto: UpdatePullRequestStatusInput,
  ): Promise<PullRequestDetail> {
    return this.pullRequests.updateStatus(projectId, pullRequestId, dto, user.id);
  }

  @Post(':pullRequestId/ready')
  @RequirePermission('pr:declare')
  @ApiOperation({ summary: 'Marque une PR prête pour révision de l’équipe' })
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

  @Post(':pullRequestId/approve')
  @RequirePermission('pr:review')
  @ApiOperation({ summary: 'Approbation de la PR par un reviewer' })
  approve(
    @ProjectId() projectId: string,
    @Param('pullRequestId', ParseUUIDPipe) pullRequestId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body?: { comment?: string },
  ): Promise<PullRequestDetail> {
    return this.pullRequests.updateStatus(
      projectId,
      pullRequestId,
      { status: PullRequestStatus.APPROVED, comment: body?.comment },
      user.id,
    );
  }

  @Post(':pullRequestId/request-changes')
  @RequirePermission('pr:review')
  @ApiOperation({ summary: 'Demande de modifications avec motif explicatif' })
  requestChanges(
    @ProjectId() projectId: string,
    @Param('pullRequestId', ParseUUIDPipe) pullRequestId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { comment: string },
  ): Promise<PullRequestDetail> {
    return this.pullRequests.updateStatus(
      projectId,
      pullRequestId,
      { status: PullRequestStatus.CHANGES_REQUESTED, comment: body.comment },
      user.id,
    );
  }

  @Post(':pullRequestId/reject')
  @RequirePermission('pr:review')
  @ApiOperation({ summary: 'Rejet définitif de la PR avec motif obligatoire' })
  reject(
    @ProjectId() projectId: string,
    @Param('pullRequestId', ParseUUIDPipe) pullRequestId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: { rejectionReason: string },
  ): Promise<PullRequestDetail> {
    return this.pullRequests.updateStatus(
      projectId,
      pullRequestId,
      { status: PullRequestStatus.REJECTED, rejectionReason: body.rejectionReason },
      user.id,
    );
  }

  @Post(':pullRequestId/merge')
  @RequirePermission('pr:merge')
  @ApiOperation({ summary: 'Fusion effective de la Pull Request dans la branche cible' })
  merge(
    @ProjectId() projectId: string,
    @Param('pullRequestId', ParseUUIDPipe) pullRequestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PullRequestDetail> {
    return this.pullRequests.updateStatus(
      projectId,
      pullRequestId,
      { status: PullRequestStatus.MERGED },
      user.id,
    );
  }

  @Post(':pullRequestId/close')
  @RequirePermission('pr:close')
  @ApiOperation({ summary: 'Fermeture / abandon de la Pull Request sans fusion' })
  close(
    @ProjectId() projectId: string,
    @Param('pullRequestId', ParseUUIDPipe) pullRequestId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PullRequestDetail> {
    return this.pullRequests.updateStatus(
      projectId,
      pullRequestId,
      { status: PullRequestStatus.CLOSED },
      user.id,
    );
  }

  @Post(':pullRequestId/comments')
  @RequirePermission('pr:comment')
  @ApiOperation({ summary: 'Ajoute un commentaire de discussion sur la PR' })
  addComment(
    @ProjectId() projectId: string,
    @Param('pullRequestId', ParseUUIDPipe) pullRequestId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createPullRequestCommentSchema)) dto: CreatePullRequestCommentInput,
  ): Promise<PullRequestCommentSummary> {
    return this.pullRequests.addComment(projectId, pullRequestId, dto, user.id);
  }
}
