import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  AttachmentSummary,
  EntityType,
  MAX_ATTACHMENT_SIZE_MB,
} from '@visiora/shared';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createReadStream } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { PrismaService } from '../../prisma/prisma.service';
import type { Env } from '../../config/env';
import { ATTACHMENT_SELECT, toAttachmentSummary } from './attachment.mapper';

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class AttachmentsService implements OnModuleInit {
  private readonly logger = new Logger(AttachmentsService.name);
  private readonly uploadRoot = path.resolve(process.cwd(), 'uploads/attachments');
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly requireS3: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {
    this.bucketName = this.config.get('S3_BUCKET', { infer: true }) ?? 'attachments';
    this.requireS3 = this.config.get('NODE_ENV', { infer: true }) === 'production';
    const s3Endpoint = this.config.get('S3_ENDPOINT', { infer: true });
    const region = this.config.get('S3_REGION', { infer: true });
    const accessKey = this.config.get('S3_ACCESS_KEY', { infer: true });
    const secretKey = this.config.get('S3_SECRET_KEY', { infer: true });

    if (s3Endpoint && region && accessKey && secretKey) {
      this.s3Client = new S3Client({
        endpoint: s3Endpoint,
        region,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
        forcePathStyle: true,
      });
      this.logger.log(`Stockage S3 compatible actif (bucket: ${this.bucketName})`);
    }
  }

  async onModuleInit(): Promise<void> {
    if (this.s3Client) {
      try {
        await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      } catch (err) {
        if (this.requireS3) {
          throw new Error(`Le bucket S3 "${this.bucketName}" n'est pas accessible.`, {
            cause: err,
          });
        }
        this.logger.warn(
          `Bucket S3 "${this.bucketName}" non accessible ou non créé : ${(err as Error).message}. Vérifiez la configuration Supabase Storage.`,
        );
      }
    }
  }

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

    // Stockage dans le bucket S3 compatible si configuré
    let storedInS3 = false;
    if (this.s3Client) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: storageKey,
            Body: file.buffer,
            ContentType: file.mimetype,
          }),
        );
        storedInS3 = true;
      } catch (err) {
        if (this.requireS3) {
          this.logger.error(`Echec envoi S3 : ${(err as Error).message}`);
          throw new ServiceUnavailableException({
            code: 'STORAGE_UNAVAILABLE',
            message: 'Le stockage des pièces jointes est temporairement indisponible',
          });
        }
        this.logger.warn(`Echec envoi S3, bascule sur disque local : ${(err as Error).message}`);
      }
    }

    // En développement, le disque reste un fallback pratique. En production,
    // Supabase Storage est l'unique source afin de ne pas remplir le disque
    // éphémère du conteneur.
    if (!this.requireS3) {
      const absolutePath = this.storagePath(storageKey);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, file.buffer);
    }

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

    // Récupération depuis le stockage S3 compatible si disponible
    if (this.s3Client) {
      try {
        const s3Response = await this.s3Client.send(
          new GetObjectCommand({
            Bucket: this.bucketName,
            Key: attachment.storageKey,
          }),
        );
        if (s3Response.Body) {
          return {
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            stream: s3Response.Body as Readable,
          };
        }
      } catch (err) {
        if (this.requireS3) {
          this.logger.error(`Recuperation S3 echouee : ${(err as Error).message}`);
          throw new ServiceUnavailableException({
            code: 'STORAGE_UNAVAILABLE',
            message: 'Le stockage des pièces jointes est temporairement indisponible',
          });
        }
        this.logger.warn(`Recuperation S3 echouee, tentative locale : ${(err as Error).message}`);
      }
    }

    if (this.requireS3) {
      throw new ServiceUnavailableException({
        code: 'STORAGE_UNAVAILABLE',
        message: 'Le stockage des pièces jointes est temporairement indisponible',
      });
    }

    // Fallback disque local
    return {
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      stream: createReadStream(this.storagePath(attachment.storageKey)),
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

    // Suppression du binaire dans le stockage S3 compatible
    if (this.s3Client) {
      try {
        await this.s3Client.send(
          new DeleteObjectCommand({
            Bucket: this.bucketName,
            Key: attachment.storageKey,
          }),
        );
      } catch (err) {
        if (this.requireS3) {
          this.logger.error(`Suppression S3 : ${(err as Error).message}`);
          throw new ServiceUnavailableException({
            code: 'STORAGE_UNAVAILABLE',
            message: 'Le stockage des pièces jointes est temporairement indisponible',
          });
        }
        this.logger.warn(`Suppression S3 : ${(err as Error).message}`);
      }
    }

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

    await unlink(this.storagePath(attachment.storageKey)).catch(() => undefined);
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

  private storagePath(storageKey: string): string {
    return path.resolve(this.uploadRoot, storageKey);
  }
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
}
