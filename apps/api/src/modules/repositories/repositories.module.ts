import { Module } from '@nestjs/common';
import { CollaborationModule } from '../collaboration/collaboration.module';
import { PullRequestsController } from './pull-requests.controller';
import { PullRequestsService } from './pull-requests.service';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesService } from './repositories.service';

@Module({
  imports: [CollaborationModule],
  controllers: [RepositoriesController, PullRequestsController],
  providers: [RepositoriesService, PullRequestsService],
  exports: [RepositoriesService, PullRequestsService],
})
export class RepositoriesModule {}
