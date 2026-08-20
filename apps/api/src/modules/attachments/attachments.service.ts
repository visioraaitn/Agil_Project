import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  AttachmentSummary,
  EntityType,
  MAX_ATTACHMENT_SIZE_MB,
} from '@visiora/shared';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { Env } from '../../config/env';
import { ObjectStorageService, type UploadedFileLike } from '../storage/object-storage.service';
import { ATTACHMENT_SELECT, toAttachmentSummary } from './attachment.mapper';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly storage: ObjectStorageService,
  ) {}

  async list(projectId: string, itemId: string): Promise<AttachmentSummary[]> {
    await this.assertWorkItem(projectId, itemId);
    const rows = await this.prisma.attachment.findMany({
      where: { workItemId: itemId },
      select: ATTACHMENT_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toAttachmentSummary);
  }

  async upload(
    projectId: string,
    itemId: string,
    file: UploadedFileLike | undefined,
    userId: string,
  ): Promise<AttachmentSummary> {
    await this.assertWorkItem(projectId, itemId);
    if (!file) {
      throw new BadRequestException({
        code: 'ATTACHMENT_REQUIRED',
        message: 'Aucun fichier fourni',
      });
    }

    const maxBytes = this.config.get('MAX_UPLOAD_MB', { infer: true }) * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException({
        code: 'ATTACHMENT_TOO_LARGE',
        message: `Le fichier depasse ${MAX_ATTACHMENT_SIZE_MB} Mo`,
      });
    }
    if (!ALLOWED_ATTACHMENT_MIME_TYPES.includes(file.mimetype as never)) {
      throw new BadRequestException({
        code: 'ATTACHMENT_TYPE_NOT_ALLOWED',
        message: 'Type de fichier non autorise',
      });
    }

    const storageKey = `${projectId}/${itemId}/${randomUUID()}-${safeFileName(file.originalname)}`;

    const storedInS3 = await this.storage.putObject(storageKey, file.buffer, file.mimetype);

    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.attachment.create({
        data: {
          workItemId: itemId,
          fileName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          storageKey,
          uploadedById: userId,
        },
        select: ATTACHMENT_SELECT,
      });

      await tx.activityLog.create({
        data: {
          projectId,
          entityType: EntityType.WORK_ITEM,
          entityId: itemId,
          actorId: userId,
          action: 'attachment_uploaded',
          field: 'attachment',
          newValue: created.id,
        },
      });

      return created;
    });

    if (storedInS3) {
      this.logger.log(`Piece jointe ${file.originalname} stockee dans S3 (cle: ${storageKey})`);
    }

    return toAttachmentSummary(row);
  }

  async getDownload(projectId: string, itemId: string, attachmentId: string) {
    await this.assertWorkItem(projectId, itemId);
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, workItemId: itemId },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        storageKey: true,
      },
    });
    if (!attachment) {
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: "Cette piece jointe n'existe pas",
      });
    }

    const storedObject = await this.storage.getObject(attachment.storageKey);
    return {
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      stream: storedObject.stream,
    };
  }

  async remove(
    projectId: string,
    itemId: string,
    attachmentId: string,
    userId: string,
  ): Promise<void> {
    await this.assertWorkItem(projectId, itemId);
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, workItemId: itemId },
      select: { id: true, storageKey: true },
    });
    if (!attachment) {
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: "Cette piece jointe n'existe pas",
      });
    }

    await this.storage.deleteObject(attachment.storageKey);

    await this.prisma.$transaction([
      this.prisma.activityLog.create({
        data: {
          projectId,
          entityType: EntityType.WORK_ITEM,
          entityId: itemId,
          actorId: userId,
          action: 'attachment_deleted',
          field: 'attachment',
          oldValue: attachment.id,
        },
      }),
      this.prisma.attachment.delete({ where: { id: attachmentId } }),
    ]);
  }

  private async assertWorkItem(projectId: string, itemId: string): Promise<void> {
    const item = await this.prisma.workItem.findFirst({
      where: { id: itemId, projectId, deletedAt: null },
      select: { id: true },
    });
    if (!item)
      throw new NotFoundException({
        code: 'WORK_ITEM_NOT_FOUND',
        message: "Ce ticket n'existe pas",
      });
  }
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
}
