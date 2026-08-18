import { Body, Controller, Delete, Get, HttpCode, MessageEvent, Param, ParseUUIDPipe, Patch, Post, Query, Sse } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import {
  ActivitySummary,
  AuthenticatedUser,
  CommentSummary,
  CreateCommentInput,
  NotificationSummary,
  createCommentSchema,
} from '@visiora/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ProjectId } from '../../common/decorators/project-id.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CollaborationService } from './collaboration.service';
import { NotificationsService } from './notifications.service';
import type { Observable } from 'rxjs';

@ApiTags('collaboration')
@ApiParam({ name: 'projectId', description: 'UUID du projet ou cle courte (ex. VIS)' })
@Controller()
export class CollaborationController {
  constructor(
    private readonly collaboration: CollaborationService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get('projects/:projectId/work-items/:itemId/comments')
  listComments(
    @ProjectId() projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<CommentSummary[]> {
    return this.collaboration.listComments(projectId, itemId);
  }

  @Post('projects/:projectId/work-items/:itemId/comments')
  @RequirePermission('comment:create')
  createComment(
    @ProjectId() projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(createCommentSchema)) dto: CreateCommentInput,
  ): Promise<CommentSummary> {
    return this.collaboration.createComment(projectId, itemId, dto, user.id);
  }

  @Delete('projects/:projectId/work-items/:itemId/comments/:commentId')
  @RequirePermission('comment:delete:any')
  @HttpCode(204)
  async deleteComment(
    @ProjectId() projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ): Promise<void> {
    await this.collaboration.deleteComment(projectId, itemId, commentId);
  }

  @Get('projects/:projectId/work-items/:itemId/activity')
  listActivity(
    @ProjectId() projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<ActivitySummary[]> {
    return this.collaboration.listActivity(projectId, itemId);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Notifications de l utilisateur courant' })
  notifications(@CurrentUser() user: AuthenticatedUser): Promise<NotificationSummary[]> {
    return this.collaboration.listNotifications(user.id);
  }

  @Public()
  @Sse('notifications/stream')
  notificationStream(@Query('token') token?: string): Observable<MessageEvent> {
    return this.notificationsService.streamFromToken(token);
  }

  @Patch('notifications/:notificationId/read')
  markNotificationRead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('notificationId', ParseUUIDPipe) notificationId: string,
  ): Promise<NotificationSummary> {
    return this.collaboration.markNotificationRead(user.id, notificationId);
  }
}
