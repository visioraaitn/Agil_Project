import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { GlobalRole, type AuthenticatedUser } from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import { EmailService } from '../collaboration/email.service';
import { ObjectStorageService } from '../storage/object-storage.service';
import { UsersService } from './users.service';

const ADMIN: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@visiora.ai',
  name: 'Admin',
  jobTitle: null,
  avatarUrl: null,
  globalRole: GlobalRole.ADMIN,
  isSuperAdmin: false,
};
const SUPER_ADMIN: AuthenticatedUser = {
  ...ADMIN,
  id: 'super-admin-1',
  email: 'kenounheni4@gmail.com',
  isSuperAdmin: true,
};

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
    notification: {
      create: jest.Mock;
      update: jest.Mock;
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
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'notification-1' }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      $transaction: jest.fn(async (callback: (transaction: unknown) => unknown) =>
        callback(prisma),
      ),
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
        isSuperAdmin: false,
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
      });

      await service.create(
        {
          email: 'new.user@example.com',
          name: 'New User',
          password: 'Initial1234',
          globalRole: GlobalRole.MEMBER,
        },
        ADMIN,
      );

      expect(email.sendAccountCreated).toHaveBeenCalledWith({
        email: 'new.user@example.com',
        name: 'New User',
        initialPassword: 'Initial1234',
      });
      expect(prisma.notification.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-1' }),
        }),
      );
      expect(prisma.notification.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'notification-1' } }),
      );
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
          isSuperAdmin: false,
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
    it('interdit la rétrogradation du dernier super administrateur actif', async () => {
      prisma.user.findFirst.mockResolvedValue({
        globalRole: GlobalRole.ADMIN,
        isSuperAdmin: true,
        isActive: true,
      });
      prisma.user.findUnique.mockResolvedValue({
        isSuperAdmin: true,
        isActive: true,
      });
      prisma.user.count.mockResolvedValue(0);

      await expect(
        service.update('super-admin-1', { globalRole: GlobalRole.MEMBER }, SUPER_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('interdit la désactivation du dernier super administrateur actif', async () => {
      prisma.user.findFirst.mockResolvedValue({
        globalRole: GlobalRole.ADMIN,
        isSuperAdmin: true,
        isActive: true,
      });
      prisma.user.findUnique.mockResolvedValue({
        isSuperAdmin: true,
        isActive: true,
      });
      prisma.user.count.mockResolvedValue(0);

      await expect(
        service.update('super-admin-1', { isActive: false }, SUPER_ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('autorise la mise à jour si un autre super administrateur actif existe', async () => {
      prisma.user.findFirst.mockResolvedValue({
        globalRole: GlobalRole.ADMIN,
        isSuperAdmin: true,
        isActive: true,
      });
      prisma.user.findUnique.mockResolvedValue({ isSuperAdmin: true, isActive: true });
      prisma.user.count.mockResolvedValue(1);
      prisma.user.update.mockResolvedValue({
        id: 'super-admin-1',
        email: 'admin@visiora.ai',
        name: 'Admin',
        jobTitle: null,
        avatarUrl: null,
        globalRole: GlobalRole.MEMBER,
        isSuperAdmin: false,
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
      });

      const result = await service.update(
        'super-admin-1',
        { globalRole: GlobalRole.MEMBER },
        SUPER_ADMIN,
      );
      expect(result.globalRole).toBe(GlobalRole.MEMBER);
    });

    it('interdit à un administrateur normal de modifier un autre administrateur', async () => {
      prisma.user.findFirst.mockResolvedValue({
        globalRole: GlobalRole.ADMIN,
        isSuperAdmin: false,
        isActive: true,
      });
      await expect(service.update('admin-2', { name: 'Admin 2' }, ADMIN)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("interdit à un administrateur normal d'attribuer le rôle administrateur", async () => {
      prisma.user.findFirst.mockResolvedValue({
        globalRole: GlobalRole.MEMBER,
        isSuperAdmin: false,
        isActive: true,
      });
      await expect(
        service.update('member-1', { globalRole: GlobalRole.ADMIN }, ADMIN),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('softDelete', () => {
    it('interdit la suppression de son propre compte', async () => {
      await expect(service.softDelete('admin-1', ADMIN)).rejects.toThrow(BadRequestException);
    });

    it('interdit la suppression du dernier super administrateur', async () => {
      prisma.user.findFirst.mockResolvedValue({
        globalRole: GlobalRole.ADMIN,
        isSuperAdmin: true,
        isActive: true,
      });
      prisma.user.findUnique.mockResolvedValue({
        isSuperAdmin: true,
        isActive: true,
      });
      prisma.user.count.mockResolvedValue(0);

      await expect(service.softDelete('super-admin-1', SUPER_ADMIN)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
