import { createParamDecorator, ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import type { Request } from 'express';

export const RESOLVED_PROJECT_ID = 'resolvedProjectId';

/**
 * Identifiant UUID du projet ciblé, déjà résolu par le ProjectPermissionGuard.
 * L'URL accepte indifféremment l'UUID ou la clé courte (« VIS ») : la résolution
 * a lieu une seule fois, dans le guard.
 */
export const ProjectId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request & { [RESOLVED_PROJECT_ID]?: string }>();
  const projectId = request[RESOLVED_PROJECT_ID];
  if (!projectId) {
    throw new InternalServerErrorException(
      "@ProjectId() exige une route contenant :projectId protégée par le ProjectPermissionGuard",
    );
  }
  return projectId;
});
