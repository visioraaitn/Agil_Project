import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AccessModule } from './modules/access/access.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { UsersModule } from './modules/users/users.module';
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
    HealthModule,
    // Phase 2 : WorkItemsModule, LabelsModule, BoardModule
    // Phase 3 : SprintsModule
    // Phase 4 : RepositoriesModule, PullRequestsModule
    // Phase 5 : CommentsModule, ActivityModule, NotificationsModule, RealtimeModule
    // Phase 6 : ReportsModule, SearchModule
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
