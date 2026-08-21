import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GlobalRole } from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenService } from '../../modules/auth/token.service';
import { JwtAuthGuard } from './jwt-auth.guard';

const ACTIVE_USER = {
  id: 'user-1',
  email: 'dev@visiora.ai',
  name: 'Nour Hamdi',
  avatarUrl: null,
  globalRole: GlobalRole.MEMBER,
  isActive: true,
  deletedAt: null,
};

function makeContext(headers: Record<string, string>) {
  const request: Record<string, unknown> = { headers, params: {} };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
  return { context, request };
}

function makeGuard(options: {
  isPublic?: boolean;
  user?: typeof ACTIVE_USER | null;
  verifyThrows?: boolean;
}) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(options.isPublic ?? false),
  } as unknown as Reflector;

  const tokens = {
    verifyAccessToken: jest.fn(() => {
      if (options.verifyThrows) {
        throw new UnauthorizedException({
          code: 'INVALID_TOKEN',
          message: 'Session expirée ou invalide',
        });
      }
      return { sub: ACTIVE_USER.id, email: ACTIVE_USER.email };
    }),
  } as unknown as TokenService;

  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(options.user ?? ACTIVE_USER) },
  } as unknown as PrismaService;

  return { guard: new JwtAuthGuard(reflector, tokens, prisma), prisma };
}

describe('JwtAuthGuard', () => {
  it('laisse passer une route @Public() sans token', async () => {
    const { guard } = makeGuard({ isPublic: true });
    const { context } = makeContext({});
    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('refuse une requête sans en-tête Authorization', async () => {
    const { guard } = makeGuard({});
    const { context } = makeContext({});
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('refuse un schéma autre que Bearer', async () => {
    const { guard } = makeGuard({});
    const { context } = makeContext({ authorization: 'Basic abc123' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('refuse un token invalide', async () => {
    const { guard } = makeGuard({ verifyThrows: true });
    const { context } = makeContext({ authorization: 'Bearer expired' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("attache l'utilisateur relu en base, sans rôle projet", async () => {
    const { guard } = makeGuard({});
    const { context, request } = makeContext({ authorization: 'Bearer valide' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: ACTIVE_USER.id,
      email: ACTIVE_USER.email,
      name: ACTIVE_USER.name,
      jobTitle: null,
      avatarUrl: null,
      globalRole: GlobalRole.MEMBER,
    });
  });

  it('rejette un compte désactivé bien que son token soit encore valide', async () => {
    const { guard } = makeGuard({ user: { ...ACTIVE_USER, isActive: false } });
    const { context } = makeContext({ authorization: 'Bearer valide' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('rejette un compte supprimé', async () => {
    const { guard } = makeGuard({
      user: { ...ACTIVE_USER, deletedAt: new Date() as unknown as null },
    });
    const { context } = makeContext({ authorization: 'Bearer valide' });
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });
});
