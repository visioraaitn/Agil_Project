import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser, GlobalRole, Permission, ProjectRole } from '@visiora/shared';
import { ProjectAccessService } from '../../modules/access/project-access.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProjectPermissionGuard } from './project-permission.guard';

const PROJECT_ID = '11111111-2222-3333-4444-555555555555';

const USER: AuthenticatedUser = {
  id: 'user-1',
  email: 'dev@visiora.ai',
  name: 'Utilisateur',
  jobTitle: null,
  avatarUrl: null,
  globalRole: GlobalRole.MEMBER,
  isSuperAdmin: false,
};

const ADMIN: AuthenticatedUser = { ...USER, id: 'admin-1', globalRole: GlobalRole.ADMIN };

/**
 * Prisma simulé : `role` est le rôle renvoyé pour l'appartenance au projet,
 * `null` signifiant que l'utilisateur n'est pas membre.
 */
function fakePrisma(role: ProjectRole | null) {
  return {
    projectMember: {
      findUnique: jest.fn().mockResolvedValue(role ? { role } : null),
    },
    project: {
      findUnique: jest.fn().mockResolvedValue({ id: PROJECT_ID }),
    },
  } as unknown as PrismaService;
}

function makeContext(
  user: AuthenticatedUser | undefined,
  params: Record<string, string>,
): { context: ExecutionContext; request: Record<string, unknown> } {
  const request: Record<string, unknown> = { user, params };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
  } as unknown as ExecutionContext;
  return { context, request };
}

function makeGuard(role: ProjectRole | null, permission: Permission | undefined) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(permission),
  } as unknown as Reflector;
  const prisma = fakePrisma(role);
  const guard = new ProjectPermissionGuard(reflector, new ProjectAccessService(prisma));
  return { guard, prisma };
}

/**
 * Exécute le guard et renvoie sa décision, ou l'exception levée.
 * `user: null` simule une requête non authentifiée — passer `undefined`
 * réactiverait la valeur par défaut du paramètre.
 */
async function run(
  role: ProjectRole | null,
  permission: Permission | undefined,
  user: AuthenticatedUser | null = USER,
  params: Record<string, string> = { projectId: PROJECT_ID },
): Promise<boolean | Error> {
  const { guard } = makeGuard(role, permission);
  const { context } = makeContext(user ?? undefined, params);
  try {
    return await guard.canActivate(context);
  } catch (error) {
    return error as Error;
  }
}

describe('ProjectPermissionGuard', () => {
  describe('cas passant et cas refusé pour chaque rôle projet', () => {
    const cases: Array<{
      role: ProjectRole;
      allowed: Permission;
      denied: Permission;
    }> = [
      {
        role: ProjectRole.PRODUCT_OWNER,
        allowed: 'pr:approve',
        denied: 'user:manage',
      },
      {
        role: ProjectRole.SCRUM_MASTER,
        allowed: 'sprint:manage',
        denied: 'pr:approve',
      },
      {
        role: ProjectRole.DEVELOPER,
        allowed: 'pr:declare',
        denied: 'workitem:delete',
      },
      {
        role: ProjectRole.VIEWER,
        allowed: 'report:view',
        denied: 'workitem:create',
      },
    ];

    it.each(cases)('$role : autorise « $allowed »', async ({ role, allowed }) => {
      await expect(run(role, allowed)).resolves.toBe(true);
    });

    it.each(cases)('$role : refuse « $denied »', async ({ role, denied }) => {
      const result = await run(role, denied);
      expect(result).toBeInstanceOf(ForbiddenException);
      expect((result as ForbiddenException).getResponse()).toMatchObject({
        code: 'PERMISSION_DENIED',
      });
    });
  });

  describe('appartenance au projet', () => {
    it('refuse un non-membre même sans permission requise', async () => {
      const result = await run(null, undefined);
      expect(result).toBeInstanceOf(ForbiddenException);
      expect((result as ForbiddenException).getResponse()).toMatchObject({
        code: 'NOT_A_PROJECT_MEMBER',
      });
    });

    it('laisse passer un membre en lecture simple', async () => {
      await expect(run(ProjectRole.VIEWER, undefined)).resolves.toBe(true);
    });

    it('exige une authentification', async () => {
      const result = await run(ProjectRole.DEVELOPER, 'workitem:update', null);
      expect(result).toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('administrateur plateforme', () => {
    it('accède à un projet dont il n’est pas membre', async () => {
      await expect(run(null, undefined, ADMIN)).resolves.toBe(true);
    });

    it('détient les permissions projet sans être membre', async () => {
      await expect(run(null, 'pr:approve', ADMIN)).resolves.toBe(true);
    });

    it('réserve la gestion des comptes aux administrateurs plateforme', async () => {
      await expect(run(null, 'user:manage', ADMIN, {})).resolves.toBe(true);
      const denied = await run(null, 'user:manage', USER, {});
      expect(denied).toBeInstanceOf(ForbiddenException);
    });
  });

  describe('routes hors projet', () => {
    it('laisse passer une route sans permission ni projet', async () => {
      await expect(run(null, undefined, USER, {})).resolves.toBe(true);
    });

    it('refuse la création de projet à un simple membre', async () => {
      const result = await run(null, 'project:create', USER, {});
      expect(result).toBeInstanceOf(ForbiddenException);
    });
  });

  describe('résolution du projet', () => {
    it('accepte la clé courte et expose l’UUID résolu', async () => {
      const { guard, prisma } = makeGuard(ProjectRole.DEVELOPER, 'workitem:update');
      const { context, request } = makeContext(USER, { projectId: 'vis' });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(prisma.project.findUnique).toHaveBeenCalledWith({
        where: { key: 'VIS' },
        select: { id: true },
      });
      expect(request.resolvedProjectId).toBe(PROJECT_ID);
    });

    it("n'interroge pas la table projet quand l'UUID est fourni", async () => {
      const { guard, prisma } = makeGuard(ProjectRole.DEVELOPER, 'workitem:update');
      const { context } = makeContext(USER, { projectId: PROJECT_ID });

      await guard.canActivate(context);
      expect(prisma.project.findUnique).not.toHaveBeenCalled();
    });

    it('résout le rôle sur le projet ciblé, jamais depuis le token', async () => {
      const { guard, prisma } = makeGuard(ProjectRole.PRODUCT_OWNER, 'pr:approve');
      const { context } = makeContext(USER, { projectId: PROJECT_ID });

      await guard.canActivate(context);
      expect(prisma.projectMember.findUnique).toHaveBeenCalledWith({
        where: { projectId_userId: { projectId: PROJECT_ID, userId: USER.id } },
        select: { role: true },
      });
    });
  });
});
