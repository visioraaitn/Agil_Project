import { BadRequestException } from '@nestjs/common';
import { GlobalRole } from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import { EmailService } from '../collaboration/email.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let tokens: { revokeAllSessions: jest.Mock };
  let email: { sendAccountCreated: jest.Mock };
  let storage: { putObject: jest.Mock; getObject: jest.Mock; deleteObject: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    tokens = {
      revokeAllSessions: jest.fn().mockResolvedValue(undefined),
    };
    email = {
      sendAccountCreated: jest.fn().mockResolvedValue(true),
    };
    storage = {
      putObject: jest.fn().mockResolvedValue(true),
      getObject: jest.fn(),
      deleteObject: jest.fn().mockResolvedValue(undefined),
    };
    service = new UsersService(
      prisma as unknown as PrismaService,
      tokens as unknown as TokenService,
      email as unknown as EmailService,
      storage as unknown as ObjectStorageService,
    );
  });

  describe('create', () => {
    it("envoie les identifiants initiaux à l'adresse du nouveau compte", async () => {
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'new.user@example.com',
        name: 'New User',
        jobTitle: null,
        avatarUrl: null,
        globalRole: GlobalRole.MEMBER,
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
      });

      await service.create({
        email: 'new.user@example.com',
        name: 'New User',
        password: 'Initial1234',
        globalRole: GlobalRole.MEMBER,
      });

      expect(email.sendAccountCreated).toHaveBeenCalledWith({
        email: 'new.user@example.com',
        name: 'New User',
        initialPassword: 'Initial1234',
      });
    });
  });

  describe('uploadOwnAvatar', () => {
    it("stocke l'image puis met à jour l'URL du profil", async () => {
      prisma.user.findFirst.mockResolvedValue({ avatarUrl: null });
      prisma.user.update.mockImplementation(({ data }: { data: { avatarUrl: string } }) =>
        Promise.resolve({
          id: '11111111-1111-4111-8111-111111111111',
          email: 'user@example.com',
          name: 'User',
          jobTitle: null,
          avatarUrl: data.avatarUrl,
          globalRole: GlobalRole.MEMBER,
          isActive: true,
          lastLoginAt: null,
          createdAt: new Date(),
        }),
      );

      const result = await service.uploadOwnAvatar('11111111-1111-4111-8111-111111111111', {
        originalname: 'avatar.png',
        mimetype: 'image/png',
        size: 4,
        buffer: Buffer.from('test'),
      });

      expect(storage.putObject).toHaveBeenCalledWith(
        expect.stringMatching(/^avatars\/11111111-1111-4111-8111-111111111111\/.+\.png$/),
        expect.any(Buffer),
        'image/png',
      );
      expect(result.avatarUrl).toMatch(
        /^\/users\/11111111-1111-4111-8111-111111111111\/avatar\/.+\.png$/,
      );
    });

    it('refuse un fichier qui ne correspond pas à une image autorisée', async () => {
      await expect(
        service.uploadOwnAvatar('user-1', {
          originalname: 'avatar.svg',
          mimetype: 'image/svg+xml',
          size: 4,
          buffer: Buffer.from('test'),
        }),
      ).rejects.toThrow(BadRequestException);
      expect(storage.putObject).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('interdit la rétrogradation du dernier administrateur actif', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        globalRole: GlobalRole.ADMIN,
        isActive: true,
      });
      prisma.user.count.mockResolvedValue(0);

      await expect(service.update('admin-1', { globalRole: GlobalRole.MEMBER })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('interdit la désactivation du dernier administrateur actif', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        globalRole: GlobalRole.ADMIN,
        isActive: true,
      });
      prisma.user.count.mockResolvedValue(0);

      await expect(service.update('admin-1', { isActive: false })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('autorise la mise à jour si un autre administrateur actif existe', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        globalRole: GlobalRole.ADMIN,
        isActive: true,
      });
      prisma.user.count.mockResolvedValue(1);
      prisma.user.update.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@visiora.ai',
        name: 'Admin',
        jobTitle: null,
        avatarUrl: null,
        globalRole: GlobalRole.MEMBER,
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
      });

      const result = await service.update('admin-1', { globalRole: GlobalRole.MEMBER });
      expect(result.globalRole).toBe(GlobalRole.MEMBER);
    });
  });

  describe('softDelete', () => {
    it('interdit la suppression de son propre compte', async () => {
      await expect(service.softDelete('admin-1', 'admin-1')).rejects.toThrow(BadRequestException);
    });

    it('interdit la suppression du dernier administrateur', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });
      prisma.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        globalRole: GlobalRole.ADMIN,
        isActive: true,
      });
      prisma.user.count.mockResolvedValue(0);

      await expect(service.softDelete('admin-1', 'other-admin')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
