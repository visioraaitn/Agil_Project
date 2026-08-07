import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
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
    HealthModule,
    // Phase 1 : AuthModule, UsersModule, ProjectsModule
    // Phase 2 : WorkItemsModule, LabelsModule, BoardModule
    // Phase 3 : SprintsModule
    // Phase 4 : RepositoriesModule, PullRequestsModule
    // Phase 5 : CommentsModule, ActivityModule, NotificationsModule, RealtimeModule
    // Phase 6 : ReportsModule, SearchModule
  ],
})
export class AppModule {}
