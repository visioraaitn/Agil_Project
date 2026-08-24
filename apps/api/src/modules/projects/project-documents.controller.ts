import {
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  MAX_ATTACHMENT_SIZE_MB,
  type AuthenticatedUser,
  type ProjectDocumentSummary,
} from '@visiora/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProjectId } from '../../common/decorators/project-id.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { UploadedFileLike } from '../storage/object-storage.service';
import { ProjectDocumentsService } from './project-documents.service';

@ApiTags('project-documents')
@Controller('projects/:projectId/documents')
export class ProjectDocumentsController {
  constructor(private readonly documents: ProjectDocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'Documents PDF du projet' })
  list(@ProjectId() projectId: string): Promise<ProjectDocumentSummary[]> {
    return this.documents.list(projectId);
  }

  @Post()
  @RequirePermission('project:document:manage')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_ATTACHMENT_SIZE_MB * 1024 * 1024, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Ajout d’un document PDF par un administrateur' })
  upload(
    @ProjectId() projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedFileLike | undefined,
  ): Promise<ProjectDocumentSummary> {
    return this.documents.upload(projectId, file, user.id);
  }

  @Get(':documentId/download')
  @Header('Cache-Control', 'private, max-age=60')
  @ApiOperation({ summary: 'Téléchargement d’un document PDF du projet' })
  async download(
    @ProjectId() projectId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.documents.getDownload(projectId, documentId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    );
    return new StreamableFile(file.stream);
  }

  @Delete(':documentId')
  @RequirePermission('project:document:manage')
  @HttpCode(204)
  async remove(
    @ProjectId() projectId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.documents.remove(projectId, documentId, user.id);
  }
}
