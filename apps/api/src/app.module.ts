import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AccessModule } from './modules/access/access.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { UsersModule } from './modules/users/users.module';
import { WorkItemsModule } from './modules/work-items/work-items.module';
import { LabelsModule } from './modules/labels/labels.module';
import { SprintsModule } from './modules/sprints/sprints.module';
import { RepositoriesModule } from './modules/repositories/repositories.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { ProjectPermissionGuard } from './common/guards/project-permission.guard';
import { validateEnv } from './config/env';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Le .env vit à la racine du monorepo : une seule source pour API et web.
      envFilePath: ['../../.env', '.env'],
      validate: validateEnv,
    }),
    PrismaModule,
    AccessModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    WorkItemsModule,
    LabelsModule,
    SprintsModule,
    RepositoriesModule,
    CollaborationModule,
    ReportsModule,
    AttachmentsModule,
    HealthModule,
    // Phase 5 suite : RealtimeModule, email jobs
  ],
  providers: [
    /**
     * Sécurité fermée par défaut : toute route est authentifiée sauf @Public(),
     * et toute route portant :projectId exige l'appartenance au projet.
     * L'ordre compte — l'identité doit être établie avant d'évaluer les droits.
     */
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ProjectPermissionGuard },
  ],
})
export class AppModule {}
