import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CollaborationController } from './collaboration.controller';
import { CollaborationService } from './collaboration.service';
import { EmailService } from './email.service';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CollaborationController],
  providers: [CollaborationService, EmailService, NotificationsService],
})
export class CollaborationModule {}
