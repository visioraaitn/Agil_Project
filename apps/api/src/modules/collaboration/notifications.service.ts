import { Injectable, MessageEvent, UnauthorizedException } from '@nestjs/common';
import { EntityType, NotificationSummary, NotificationType } from '@visiora/shared';
import { Observable, Subject, interval, map, merge } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import { NOTIFICATION_SELECT, toNotificationSummary } from './collaboration.mapper';
import { EmailService } from './email.service';

@Injectable()
export class NotificationsService {
  private readonly streams = new Map<string, Subject<MessageEvent>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly email: EmailService,
  ) {}

  streamFromToken(rawToken: string | undefined): Observable<MessageEvent> {
    if (!rawToken) {
      throw new UnauthorizedException({ code: 'MISSING_TOKEN', message: 'Token manquant' });
    }
    const payload = this.tokens.verifyAccessToken(rawToken);
    return this.stream(payload.sub);
  }

  stream(userId: string): Observable<MessageEvent> {
    const subject = this.subject(userId);
    const heartbeat = interval(25_000).pipe(map(() => ({ type: 'ping', data: { ok: true } })));
    return merge(subject.asObservable(), heartbeat);
  }

  async notifyMention({
    userIds,
    projectId,
    itemId,
    itemKey,
    body,
  }: {
    userIds: string[];
    projectId: string;
    itemId: string;
    itemKey: string;
    body: string;
  }): Promise<void> {
    for (const userId of [...new Set(userIds)]) {
      const row = await this.prisma.notification.create({
        data: {
          userId,
          projectId,
          type: NotificationType.ITEM_MENTIONED,
          title: `Mention dans ${itemKey}`,
          body: body.slice(0, 240),
          entityType: EntityType.WORK_ITEM,
          entityId: itemId,
        },
        select: NOTIFICATION_SELECT,
      });
      const summary = toNotificationSummary(row);
      this.subject(userId).next({ type: 'notification', data: summary });
      void this.sendEmail(userId, summary);
    }
  }

  private subject(userId: string): Subject<MessageEvent> {
    let subject = this.streams.get(userId);
    if (!subject) {
      subject = new Subject<MessageEvent>();
      this.streams.set(userId, subject);
    }
    return subject;
  }

  private async sendEmail(userId: string, notification: NotificationSummary): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) return;
    const sent = await this.email.sendNotification(
      user.email,
      notification.title,
      `${notification.title}\n\n${notification.body ?? ''}`,
    );
    if (sent) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { emailSentAt: new Date() },
      });
    }
  }
}
