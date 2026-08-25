import { describe, expect, it } from 'vitest';
import { GlobalRole, ProjectRole } from './enums';
import { can, PERMISSIONS, ROLE_PERMISSIONS } from './permissions';

const member = (projectRole: ProjectRole | null) => ({
  globalRole: GlobalRole.MEMBER,
  projectRole,
});

describe('matrice de permissions', () => {
  it("réserve l'approbation de PR au Project Lead", () => {
    expect(can(member(ProjectRole.PROJECT_LEAD), 'pr:approve')).toBe(true);
    expect(can(member(ProjectRole.MEMBER), 'pr:approve')).toBe(false);
  });

  it('autorise un membre à déclarer une PR', () => {
    expect(can(member(ProjectRole.MEMBER), 'pr:declare')).toBe(true);
  });

  it("n'accorde aucune permission à un non-membre", () => {
    for (const permission of PERMISSIONS) {
      expect(can(member(null), permission)).toBe(false);
    }
  });

  it("accorde tout à l'administrateur plateforme, même hors projet", () => {
    const productOwner = { globalRole: GlobalRole.ADMIN, projectRole: null };
    for (const permission of PERMISSIONS) {
      expect(can(productOwner, permission)).toBe(true);
    }
  });

  it("autorise l'administrateur à gérer les comptes et les projets", () => {
    const admin = { globalRole: GlobalRole.ADMIN, projectRole: null };
    expect(can(admin, 'user:manage')).toBe(true);
    expect(can(admin, 'project:member:manage')).toBe(true);
    expect(can(admin, 'project:create')).toBe(true);
    expect(can(admin, 'pr:approve')).toBe(true);
  });

  it('refuse les permissions plateforme à tous les rôles projet', () => {
    for (const role of Object.values(ProjectRole)) {
      expect(can(member(role), 'user:manage')).toBe(false);
      expect(can(member(role), 'project:create')).toBe(false);
      expect(can(member(role), 'project:delete')).toBe(false);
      expect(can(member(role), 'project:document:manage')).toBe(false);
      expect(can(member(role), 'project:update')).toBe(false);
      expect(can(member(role), 'project:member:manage')).toBe(false);
    }
  });

  it('ne déclare que des permissions existantes', () => {
    for (const permissions of Object.values(ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });

  it('interdit au membre de supprimer un ticket ou de gérer les membres', () => {
    expect(can(member(ProjectRole.MEMBER), 'workitem:delete')).toBe(false);
    expect(can(member(ProjectRole.MEMBER), 'project:member:manage')).toBe(false);
    expect(can(member(ProjectRole.MEMBER), 'workitem:update')).toBe(true);
  });
});
