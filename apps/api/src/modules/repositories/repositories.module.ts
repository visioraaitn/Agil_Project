import { Module } from '@nestjs/common';
import { PullRequestsController } from './pull-requests.controller';
import { PullRequestsService } from './pull-requests.service';
import { RepositoriesController } from './repositories.controller';
import { RepositoriesService } from './repositories.service';

@Module({
  controllers: [RepositoriesController, PullRequestsController],
  providers: [RepositoriesService, PullRequestsService],
})
export class RepositoriesModule {}
