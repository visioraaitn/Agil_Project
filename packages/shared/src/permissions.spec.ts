import { describe, expect, it } from 'vitest';
import { GlobalRole, ProjectRole } from './enums';
import { can, permissionsFor, PERMISSIONS, ROLE_PERMISSIONS } from './permissions';

const member = (projectRole: ProjectRole | null) => ({
  globalRole: GlobalRole.MEMBER,
  projectRole,
});

describe('matrice de permissions', () => {
  it("réserve l'approbation de PR au Product Owner", () => {
    expect(can(member(ProjectRole.PRODUCT_OWNER), 'pr:approve')).toBe(true);
    expect(can(member(ProjectRole.SCRUM_MASTER), 'pr:approve')).toBe(false);
    expect(can(member(ProjectRole.DEVELOPER), 'pr:approve')).toBe(false);
    expect(can(member(ProjectRole.VIEWER), 'pr:approve')).toBe(false);
  });

  it('réserve la déclaration de PR aux développeurs', () => {
    expect(can(member(ProjectRole.DEVELOPER), 'pr:declare')).toBe(true);
    expect(can(member(ProjectRole.VIEWER), 'pr:declare')).toBe(false);
  });

  it("n'accorde aucune permission à un non-membre", () => {
    for (const permission of PERMISSIONS) {
      expect(can(member(null), permission)).toBe(false);
    }
  });

  it('accorde tout à un administrateur plateforme, même hors projet', () => {
    const admin = { globalRole: GlobalRole.ADMIN, projectRole: null };
    for (const permission of PERMISSIONS) {
      expect(can(admin, permission)).toBe(true);
    }
  });

  it('refuse les permissions plateforme à tous les rôles projet', () => {
    for (const role of Object.values(ProjectRole)) {
      expect(can(member(role), 'user:manage')).toBe(false);
      expect(can(member(role), 'project:create')).toBe(false);
      expect(can(member(role), 'project:delete')).toBe(false);
    }
  });

  it('limite le lecteur à la consultation des rapports', () => {
    expect(permissionsFor(member(ProjectRole.VIEWER))).toEqual(['report:view']);
  });

  it('ne déclare que des permissions existantes', () => {
    for (const permissions of Object.values(ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        expect(PERMISSIONS).toContain(permission);
      }
    }
  });

  it('interdit au développeur de supprimer un ticket ou de gérer les membres', () => {
    expect(can(member(ProjectRole.DEVELOPER), 'workitem:delete')).toBe(false);
    expect(can(member(ProjectRole.DEVELOPER), 'project:member:manage')).toBe(false);
    expect(can(member(ProjectRole.DEVELOPER), 'workitem:update')).toBe(true);
  });
});
