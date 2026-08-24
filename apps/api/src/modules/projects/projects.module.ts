import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { EmailService } from '../collaboration/email.service';
import { ProjectDocumentsController } from './project-documents.controller';
import { ProjectDocumentsService } from './project-documents.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [StorageModule],
  controllers: [ProjectsController, ProjectDocumentsController],
  providers: [ProjectsService, ProjectDocumentsService, EmailService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
