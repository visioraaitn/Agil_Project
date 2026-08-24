import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { ProjectDocumentsService } from './project-documents.service';

describe('ProjectDocumentsService', () => {
  let service: ProjectDocumentsService;
  let prisma: {
    projectDocument: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
    activityLog: { create: jest.Mock };
    $transaction: jest.Mock;
  };
  let storage: { putObject: jest.Mock; getObject: jest.Mock; deleteObject: jest.Mock };

  beforeEach(() => {
    prisma = {
      projectDocument: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
      activityLog: { create: jest.fn().mockResolvedValue(undefined) },
      $transaction: jest.fn(async (callback: (transaction: unknown) => unknown) =>
        callback(prisma),
      ),
    };
    storage = {
      putObject: jest.fn().mockResolvedValue(true),
      getObject: jest.fn(),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    const config = { get: jest.fn().mockReturnValue(25) };
    service = new ProjectDocumentsService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService<Env, true>,
      storage as unknown as ObjectStorageService,
    );
  });

  it('stocke un PDF valide et crée son enregistrement', async () => {
    prisma.projectDocument.create.mockResolvedValue({
      id: 'document-1',
      projectId: 'project-1',
      fileName: 'cadrage.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12,
      createdAt: new Date('2026-08-24T10:00:00Z'),
      uploadedBy: {
        id: 'admin-1',
        name: 'Admin',
        email: 'admin@example.com',
        avatarUrl: null,
      },
    });

    const result = await service.upload(
      'project-1',
      {
        originalname: 'cadrage.pdf',
        mimetype: 'application/pdf',
        size: 12,
        buffer: Buffer.from('%PDF-1.7 test'),
      },
      'admin-1',
    );

    expect(storage.putObject).toHaveBeenCalledWith(
      expect.stringMatching(/^projects\/project-1\/documents\/.+-cadrage\.pdf$/),
      expect.any(Buffer),
      'application/pdf',
    );
    expect(result.fileName).toBe('cadrage.pdf');
    expect(prisma.activityLog.create).toHaveBeenCalled();
  });

  it('refuse un fichier déguisé en PDF avant tout envoi S3', async () => {
    await expect(
      service.upload(
        'project-1',
        {
          originalname: 'faux.pdf',
          mimetype: 'application/pdf',
          size: 10,
          buffer: Buffer.from('not-a-pdf'),
        },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);

    expect(storage.putObject).not.toHaveBeenCalled();
    expect(prisma.projectDocument.create).not.toHaveBeenCalled();
  });
});
