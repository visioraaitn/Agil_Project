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
import type { AttachmentSummary, AuthenticatedUser } from '@visiora/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProjectId } from '../../common/decorators/project-id.decorator';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import type { UploadedFileLike } from '../storage/object-storage.service';
import { AttachmentsService } from './attachments.service';

@ApiTags('attachments')
@Controller('projects/:projectId/work-items/:itemId/attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get()
  list(
    @ProjectId() projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ): Promise<AttachmentSummary[]> {
    return this.attachments.list(projectId, itemId);
  }

  @Post()
  @RequirePermission('attachment:manage')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  upload(
    @ProjectId() projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: UploadedFileLike | undefined,
  ): Promise<AttachmentSummary> {
    return this.attachments.upload(projectId, itemId, file, user.id);
  }

  @Get(':attachmentId/download')
  @Header('Cache-Control', 'private, max-age=60')
  @ApiOperation({ summary: 'Telechargement d une piece jointe' })
  async download(
    @ProjectId() projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const file = await this.attachments.getDownload(projectId, itemId, attachmentId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.fileName)}"`,
    );
    return new StreamableFile(file.stream);
  }

  @Delete(':attachmentId')
  @RequirePermission('attachment:manage')
  @HttpCode(204)
  async remove(
    @ProjectId() projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Param('attachmentId', ParseUUIDPipe) attachmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.attachments.remove(projectId, itemId, attachmentId, user.id);
  }
}
