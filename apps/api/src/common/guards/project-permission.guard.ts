import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedUser, Permission, can, isPlatformAdministrator } from '@visiora/shared';
import type { Request } from 'express';
import { PERMISSION_KEY } from '../decorators/require-permission.decorator';
import { RESOLVED_PROJECT_ID } from '../decorators/project-id.decorator';
import { ProjectAccessService } from '../../modules/access/project-access.service';

type GuardedRequest = Request & {
  user?: AuthenticatedUser;
  [RESOLVED_PROJECT_ID]?: string;
};

/**
 * Autorisation RBAC par projet.
 *
 * 1. Si la route porte `:projectId`, on résout le rôle de l'utilisateur SUR CE
 *    PROJET en base — jamais depuis le token.
 * 2. L'appartenance au projet vaut droit de lecture : un non-membre est rejeté
 *    même sans permission explicite.
 * 3. Si la route déclare `@RequirePermission(...)`, la décision revient à la
 *    matrice partagée `can()`, seule autorité. Aucune comparaison de rôle en dur.
 */
@Injectable()
export class ProjectPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly access: ProjectAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardedRequest>();

    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const rawProjectParam: unknown = request.params?.projectId;
    const projectParam = typeof rawProjectParam === 'string' ? rawProjectParam : undefined;

    // Route ni rattachée à un projet ni soumise à permission : l'authentification suffit.
    if (!permission && !projectParam) return true;

    const user = request.user;
    if (!user)
      throw new UnauthorizedException({
        code: 'UNAUTHENTICATED',
        message: 'Authentification requise',
      });

    let projectId: string | null = null;
    if (projectParam) {
      projectId = await this.access.resolveProjectId(projectParam);
      request[RESOLVED_PROJECT_ID] = projectId;
    }

    const context_ = await this.access.getAccessContext(user, projectId);

    // L'appartenance conditionne l'accès au projet ; l'admin plateforme passe outre.
    if (projectId && !context_.projectRole && !isPlatformAdministrator(user.globalRole)) {
      throw new ForbiddenException({
        code: 'NOT_A_PROJECT_MEMBER',
        message: "Vous n'êtes pas membre de ce projet",
      });
    }

    if (permission && !can(context_, permission)) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: `Cette action requiert la permission « ${permission} »`,
      });
    }

    return true;
  }
}
