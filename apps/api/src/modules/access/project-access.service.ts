import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRole as PrismaProjectRole } from '@prisma/client';
import {
  AccessContext,
  GlobalRole,
  Permission,
  ProjectAccess,
  ProjectRole,
  can,
  permissionsFor,
} from '@visiora/shared';
import { PrismaService } from '../../prisma/prisma.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AccessSubject {
  id: string;
  globalRole: GlobalRole;
}

/**
 * Résout les droits d'un utilisateur sur un projet.
 *
 * Le token ne porte AUCUN rôle : il prouve seulement l'identité. Les rôles et
 * permissions sont relus en base à chaque requête, si bien qu'un retrait de
 * membre ou un changement de rôle prend effet immédiatement, sans attendre
 * l'expiration d'un token.
 */
@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Accepte l'UUID ou la clé courte du projet (« VIS »). */
  async resolveProjectId(idOrKey: string): Promise<string> {
    if (UUID_PATTERN.test(idOrKey)) return idOrKey;

    const project = await this.prisma.project.findUnique({
      where: { key: idOrKey.toUpperCase() },
      select: { id: true },
    });
    if (!project) throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: "Ce projet n'existe pas" });
    return project.id;
  }

  async getProjectRole(userId: string, projectId: string): Promise<ProjectRole | null> {
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    });
    return membership ? (membership.role as ProjectRole) : null;
  }

  async getAccessContext(subject: AccessSubject, projectId: string | null): Promise<AccessContext> {
    return {
      globalRole: subject.globalRole,
      projectRole: projectId ? await this.getProjectRole(subject.id, projectId) : null,
    };
  }

  async can(subject: AccessSubject, projectId: string | null, permission: Permission): Promise<boolean> {
    return can(await this.getAccessContext(subject, projectId), permission);
  }

  /** Droits effectifs envoyés au front pour masquer les commandes interdites. */
  async getProjectAccess(subject: AccessSubject, projectId: string): Promise<ProjectAccess> {
    const context = await this.getAccessContext(subject, projectId);
    return {
      projectId,
      role: context.projectRole ?? null,
      permissions: permissionsFor(context),
    };
  }

  /** Rôles de l'utilisateur sur plusieurs projets, en une requête. */
  async getRolesForProjects(userId: string, projectIds: string[]): Promise<Map<string, ProjectRole>> {
    if (projectIds.length === 0) return new Map();

    const memberships = await this.prisma.projectMember.findMany({
      where: { userId, projectId: { in: projectIds } },
      select: { projectId: true, role: true },
    });

    return new Map(
      memberships.map((membership) => [
        membership.projectId,
        membership.role as unknown as ProjectRole,
      ]),
    );
  }

  /** Conversion explicite entre l'enum Prisma et celui du paquet partagé. */
  static toPrismaRole(role: ProjectRole): PrismaProjectRole {
    return role as unknown as PrismaProjectRole;
  }
}
