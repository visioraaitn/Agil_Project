import { BadRequestException } from '@nestjs/common';
import { GlobalRole } from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../auth/token.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
      findMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let tokens: { revokeAllSessions: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    tokens = {
      revokeAllSessions: jest.fn().mockResolvedValue(undefined),
    };
    service = new UsersService(prisma as unknown as PrismaService, tokens as unknown as TokenService);
  });

  describe('update', () => {
    it('interdit la rétrogradation du dernier administrateur actif', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', globalRole: GlobalRole.ADMIN, isActive: true });
      prisma.user.count.mockResolvedValue(0);

      await expect(
        service.update('admin-1', { globalRole: GlobalRole.MEMBER }),
      ).rejects.toThrow(BadRequestException);
    });

    it('interdit la désactivation du dernier administrateur actif', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', globalRole: GlobalRole.ADMIN, isActive: true });
      prisma.user.count.mockResolvedValue(0);

      await expect(
        service.update('admin-1', { isActive: false }),
      ).rejects.toThrow(BadRequestException);
    });

    it('autorise la mise à jour si un autre administrateur actif existe', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 'admin-1' });
      prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', globalRole: GlobalRole.ADMIN, isActive: true });
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
      prisma.user.findUnique.mockResolvedValue({ id: 'admin-1', globalRole: GlobalRole.ADMIN, isActive: true });
      prisma.user.count.mockResolvedValue(0);

      await expect(service.softDelete('admin-1', 'other-admin')).rejects.toThrow(BadRequestException);
    });
  });
});
