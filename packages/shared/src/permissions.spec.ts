import { describe, expect, it } from 'vitest';
import { GlobalRole, ProjectRole } from './enums';
import {
  can,
  hasProjectAccess,
  isSuperAdministrator,
  PERMISSIONS,
  PROJECT_ADMIN_PERMISSIONS,
  ROLE_PERMISSIONS,
  type Permission,
} from './permissions';

const member = (projectRole: ProjectRole | null) => ({
  globalRole: GlobalRole.MEMBER,
  projectRole,
});
const admin = (projectRole: ProjectRole | null) => ({
  globalRole: GlobalRole.ADMIN,
  isSuperAdmin: false,
  projectRole,
});
const superAdmin = (projectRole: ProjectRole | null = null) => ({
  globalRole: GlobalRole.ADMIN,
  isSuperAdmin: true,
  projectRole,
});

const WORK_ITEM_CRUD: Permission[] = [
  'workitem:create',
  'workitem:update',
  'workitem:delete',
  'workitem:move',
];
const SPRINT_ADMIN: Permission[] = ['sprint:manage', 'sprint:close', 'sprint:plan'];

describe('matrice de permissions', () => {
  describe('super administrateur', () => {
    it('a toutes les permissions, même sans être membre du projet', () => {
      for (const permission of PERMISSIONS) {
        expect(can(superAdmin(), permission)).toBe(true);
      }
    });

    it('accède à tous les projets', () => {
      expect(hasProjectAccess(superAdmin())).toBe(true);
    });

    it("n'existe que sur un compte ADMIN", () => {
      const flaggedMember = {
        globalRole: GlobalRole.MEMBER,
        isSuperAdmin: true,
        projectRole: null,
      };
      expect(isSuperAdministrator(flaggedMember)).toBe(false);
      expect(can(flaggedMember, 'project:create')).toBe(false);
      expect(hasProjectAccess(flaggedMember)).toBe(false);
    });
  });

  describe('administrateur', () => {
    it('ne voit pas un projet dont il n’est pas membre', () => {
      expect(hasProjectAccess(admin(null))).toBe(false);
    });

    it('n’a aucune permission projet hors de ses projets', () => {
      for (const permission of PERMISSIONS) {
        if (permission === 'user:manage') continue;
        expect(can(admin(null), permission)).toBe(false);
      }
    });

    it('gère les comptes de la plateforme', () => {
      expect(can(admin(null), 'user:manage')).toBe(true);
    });

    it('ne crée pas de projet et ne gère pas les membres, même membre du projet', () => {
      for (const role of [null, ...Object.values(ProjectRole)]) {
        expect(can(admin(role), 'project:create')).toBe(false);
        expect(can(admin(role), 'project:member:manage')).toBe(false);
      }
    });

    it('administre un projet dont il est membre : projet, import, sprints, tickets', () => {
      const ctx = admin(ProjectRole.MEMBER);
      for (const permission of [...PROJECT_ADMIN_PERMISSIONS, ...WORK_ITEM_CRUD]) {
        expect(can(ctx, permission)).toBe(true);
      }
    });
  });

  describe('membre', () => {
    it("n'a aucune permission sur un projet dont il n'est pas membre", () => {
      for (const permission of PERMISSIONS) {
        expect(can(member(null), permission)).toBe(false);
      }
      expect(hasProjectAccess(member(null))).toBe(false);
    });

    it('lit les projets dont il est membre', () => {
      expect(hasProjectAccess(member(ProjectRole.MEMBER))).toBe(true);
    });

    it('crée, modifie, déplace et supprime les tickets (Epic, Story, Sous-tâche, Bug)', () => {
      for (const permission of WORK_ITEM_CRUD) {
        expect(can(member(ProjectRole.MEMBER), permission)).toBe(true);
      }
    });

    it("n'administre ni le projet, ni l'import, ni les sprints, ni les membres — même Project Lead", () => {
      for (const role of Object.values(ProjectRole)) {
        for (const permission of [
          ...PROJECT_ADMIN_PERMISSIONS,
          ...SPRINT_ADMIN,
          'project:create',
          'project:member:manage',
          'user:manage',
        ] as Permission[]) {
          expect(can(member(role), permission)).toBe(false);
        }
      }
    });

    it("réserve l'approbation de PR au Project Lead", () => {
      expect(can(member(ProjectRole.PROJECT_LEAD), 'pr:approve')).toBe(true);
      expect(can(member(ProjectRole.MEMBER), 'pr:approve')).toBe(false);
    });

    it('autorise un membre à déclarer une PR', () => {
      expect(can(member(ProjectRole.MEMBER), 'pr:declare')).toBe(true);
    });
  });

  describe('refus par défaut', () => {
    it('refuse un rôle global inconnu', () => {
      const unknown = { globalRole: 'GUEST' as GlobalRole, projectRole: ProjectRole.PROJECT_LEAD };
      expect(hasProjectAccess(unknown)).toBe(false);
      for (const permission of PERMISSIONS) {
        expect(can(unknown, permission)).toBe(false);
      }
    });

    it('refuse un rôle projet inconnu', () => {
      const unknown = { globalRole: GlobalRole.MEMBER, projectRole: 'OWNER' as ProjectRole };
      for (const permission of PERMISSIONS) {
        expect(can(unknown, permission)).toBe(false);
      }
    });
  });

  it('ne déclare que des permissions existantes', () => {
    for (const permissions of Object.values(ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });

  it("ne laisse aucun rôle projet détenir une permission d'administration", () => {
    for (const permissions of Object.values(ROLE_PERMISSIONS)) {
      for (const permission of PROJECT_ADMIN_PERMISSIONS) {
        expect(permissions).not.toContain(permission);
      }
    }
  });
});
