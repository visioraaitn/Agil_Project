import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  EntityType,
  PROJECT_DOCUMENT_MIME_TYPE,
  type ProjectDocumentSummary,
} from '@visiora/shared';
import type { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { ObjectStorageService, type UploadedFileLike } from '../storage/object-storage.service';
import { PROJECT_DOCUMENT_SELECT, toProjectDocumentSummary } from './project-document.mapper';

@Injectable()
export class ProjectDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
    private readonly storage: ObjectStorageService,
  ) {}

  async list(projectId: string): Promise<ProjectDocumentSummary[]> {
    const rows = await this.prisma.projectDocument.findMany({
      where: { projectId },
      select: PROJECT_DOCUMENT_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toProjectDocumentSummary);
  }

  async upload(
    projectId: string,
    file: UploadedFileLike | undefined,
    userId: string,
  ): Promise<ProjectDocumentSummary> {
    this.validatePdf(file);

    const storageKey = `projects/${projectId}/documents/${randomUUID()}-${safeFileName(file.originalname)}`;
    await this.storage.putObject(storageKey, file.buffer, PROJECT_DOCUMENT_MIME_TYPE);

    try {
      const row = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.projectDocument.create({
          data: {
            projectId,
            fileName: file.originalname,
            mimeType: PROJECT_DOCUMENT_MIME_TYPE,
            sizeBytes: file.size,
            storageKey,
            uploadedById: userId,
          },
          select: PROJECT_DOCUMENT_SELECT,
        });

        await transaction.activityLog.create({
          data: {
            projectId,
            entityType: EntityType.PROJECT,
            entityId: projectId,
            actorId: userId,
            action: 'project_document_uploaded',
            field: 'document',
            newValue: created.id,
          },
        });
        return created;
      });
      return toProjectDocumentSummary(row);
    } catch (error) {
      await this.storage.deleteObject(storageKey).catch(() => undefined);
      throw error;
    }
  }

  async getDownload(projectId: string, documentId: string) {
    const document = await this.prisma.projectDocument.findFirst({
      where: { id: documentId, projectId },
      select: { fileName: true, mimeType: true, storageKey: true },
    });
    if (!document) throw documentNotFound();

    const storedObject = await this.storage.getObject(document.storageKey);
    return {
      fileName: document.fileName,
      mimeType: document.mimeType,
      stream: storedObject.stream,
    };
  }

  async remove(projectId: string, documentId: string, userId: string): Promise<void> {
    const document = await this.prisma.projectDocument.findFirst({
      where: { id: documentId, projectId },
      select: { id: true, storageKey: true },
    });
    if (!document) throw documentNotFound();

    await this.storage.deleteObject(document.storageKey);
    await this.prisma.$transaction([
      this.prisma.activityLog.create({
        data: {
          projectId,
          entityType: EntityType.PROJECT,
          entityId: projectId,
          actorId: userId,
          action: 'project_document_deleted',
          field: 'document',
          oldValue: document.id,
        },
      }),
      this.prisma.projectDocument.delete({ where: { id: documentId } }),
    ]);
  }

  private validatePdf(file: UploadedFileLike | undefined): asserts file is UploadedFileLike {
    if (!file) {
      throw new BadRequestException({
        code: 'PROJECT_DOCUMENT_REQUIRED',
        message: 'Aucun document fourni',
      });
    }

    const maxUploadMb = this.config.get('MAX_UPLOAD_MB', { infer: true });
    const maxBytes = maxUploadMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException({
        code: 'PROJECT_DOCUMENT_TOO_LARGE',
        message: `Le document dépasse ${maxUploadMb} Mo`,
      });
    }

    const hasPdfSignature = file.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
    if (file.mimetype !== PROJECT_DOCUMENT_MIME_TYPE || !hasPdfSignature) {
      throw new BadRequestException({
        code: 'PROJECT_DOCUMENT_TYPE_NOT_ALLOWED',
        message: 'Seuls les documents PDF valides sont autorisés',
      });
    }
  }
}

function documentNotFound(): NotFoundException {
  return new NotFoundException({
    code: 'PROJECT_DOCUMENT_NOT_FOUND',
    message: "Ce document n'existe pas",
  });
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160) || 'document.pdf';
}
