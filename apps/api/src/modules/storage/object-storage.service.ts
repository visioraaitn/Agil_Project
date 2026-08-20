import { Injectable, Logger, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
import { Readable } from 'node:stream';
import type { Env } from '../../config/env';

export interface UploadedFileLike {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface StoredObject {
  stream: Readable;
  contentType?: string;
}

@Injectable()
export class ObjectStorageService implements OnModuleInit {
  private readonly logger = new Logger(ObjectStorageService.name);
  // Conserve le chemin historique afin que les pièces jointes locales existantes
  // restent lisibles après la mutualisation du client S3 avec les avatars.
  private readonly uploadRoot = path.resolve(process.cwd(), 'uploads/attachments');
  private readonly s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly requireS3: boolean;

  constructor(private readonly config: ConfigService<Env, true>) {
    this.bucketName = this.config.get('S3_BUCKET', { infer: true }) ?? 'attachments';
    this.requireS3 = this.config.get('NODE_ENV', { infer: true }) === 'production';

    const endpoint = this.config.get('S3_ENDPOINT', { infer: true });
    const region = this.config.get('S3_REGION', { infer: true });
    const accessKey = this.config.get('S3_ACCESS_KEY', { infer: true });
    const secretKey = this.config.get('S3_SECRET_KEY', { infer: true });

    if (endpoint && region && accessKey && secretKey) {
      this.s3Client = new S3Client({
        endpoint,
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
    if (!this.s3Client) return;

    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
    } catch (error) {
      if (this.requireS3) {
        throw new Error(`Le bucket S3 "${this.bucketName}" n'est pas accessible.`, {
          cause: error,
        });
      }
      this.logger.warn(
        `Bucket S3 "${this.bucketName}" non accessible : ${(error as Error).message}`,
      );
    }
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<boolean> {
    let storedInS3 = false;

    if (this.s3Client) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: body,
            ContentType: contentType,
          }),
        );
        storedInS3 = true;
      } catch (error) {
        this.handleS3Error('envoi', error);
      }
    }

    if (!this.requireS3) {
      const absolutePath = this.storagePath(key);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, body);
    }

    return storedInS3;
  }

  async getObject(key: string): Promise<StoredObject> {
    if (this.s3Client) {
      try {
        const response = await this.s3Client.send(
          new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
        );
        if (response.Body) {
          return {
            stream: response.Body as Readable,
            ...(response.ContentType ? { contentType: response.ContentType } : {}),
          };
        }
      } catch (error) {
        this.handleS3Error('récupération', error);
      }
    }

    if (this.requireS3) throw this.storageUnavailable();
    return { stream: createReadStream(this.storagePath(key)) };
  }

  async deleteObject(key: string): Promise<void> {
    if (this.s3Client) {
      try {
        await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }));
      } catch (error) {
        this.handleS3Error('suppression', error);
      }
    }

    if (!this.requireS3) {
      await unlink(this.storagePath(key)).catch(() => undefined);
    }
  }

  private handleS3Error(operation: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    if (this.requireS3) {
      this.logger.error(`Échec S3 pendant ${operation} : ${message}`);
      throw this.storageUnavailable();
    }
    this.logger.warn(`Échec S3 pendant ${operation}, utilisation du disque local : ${message}`);
  }

  private storageUnavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException({
      code: 'STORAGE_UNAVAILABLE',
      message: 'Le stockage des fichiers est temporairement indisponible',
    });
  }

  private storagePath(key: string): string {
    const absolutePath = path.resolve(this.uploadRoot, key);
    if (!absolutePath.startsWith(`${this.uploadRoot}${path.sep}`)) {
      throw new Error('Clé de stockage invalide');
    }
    return absolutePath;
  }
}
