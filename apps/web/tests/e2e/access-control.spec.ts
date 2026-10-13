import { expect, test, type APIRequestContext } from '@playwright/test';

/**
 * Contrôle d'accès vérifié directement sur l'API — jamais par l'interface :
 * un bouton masqué n'est pas une sécurité. Le scénario crée ses propres comptes
 * et projets, puis les supprime.
 *
 *   Projet A : administrateur + membre affectés
 *   Projet B : aucun des deux (cible des tentatives IDOR)
 *   Projet C : visible du seul super administrateur
 */

test.describe.configure({ mode: 'serial' });

const base = () => process.env.E2E_API_URL!;
const PASSWORD = 'RbacTest2026!';
const CSRF = { 'X-Requested-With': 'VisioraAI' };

type Headers = Record<string, string>;
interface Ctx {
  superAdmin: Headers;
  admin: Headers;
  member: Headers;
  adminId: string;
  memberId: string;
  keys: { a: string; b: string; c: string };
  projectB: { id: string; itemId: string; sprintId: string };
}

let request: APIRequestContext;
const ctx = {} as Ctx;
const createdProjects: { key: string; name: string }[] = [];

async function login(email: string, password: string): Promise<Headers> {
  const response = await request.post(`${base()}/auth/login`, {
    data: { email, password },
    headers: CSRF,
  });
  expect(response.status(), await response.text()).toBe(200);
  const { accessToken } = (await response.json()) as { accessToken: string };
  return { Authorization: `Bearer ${accessToken}`, ...CSRF };
}

async function call(
  headers: Headers,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  data?: unknown,
) {
  const response = await request.fetch(`${base()}${path}`, { method, headers, data });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status(), body: body as Record<string, unknown> & unknown[] };
}

async function ok<T = Record<string, unknown>>(
  headers: Headers,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  data?: unknown,
): Promise<T> {
  const result = await call(headers, method, path, data);
  expect(result.status, `${method} ${path} → ${JSON.stringify(result.body)}`).toBeLessThan(300);
  return result.body as T;
}

async function expectStatus(
  headers: Headers,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  path: string,
  status: number,
  data?: unknown,
) {
  const result = await call(headers, method, path, data);
  expect(result.status, `${method} ${path} → ${JSON.stringify(result.body)}`).toBe(status);
  return result.body;
}

async function createProject(key: string, name: string) {
  const project = await ok<{ id: string }>(ctx.superAdmin, 'POST', '/projects', { key, name });
  createdProjects.push({ key, name });
  return project;
}

/** Dates de sprint futures et propres à chaque exécution (pas de chevauchement). */
function sprintDates(offsetDays: number) {
  const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  return { startDate: day(offsetDays), endDate: day(offsetDays + 13) };
}

const listKeys = async (headers: Headers) => {
  const page = await ok<{ items: { key: string }[]; total: number }>(
    headers,
    'GET',
    '/projects?pageSize=100',
  );
  return { keys: page.items.map((project) => project.key), total: page.total };
};

test.beforeAll(async ({ playwright }) => {
  request = await playwright.request.newContext();
  ctx.superAdmin = await login(process.env.E2E_ADMIN_EMAIL!, process.env.E2E_ADMIN_PASSWORD!);

  const me = await ok<{ isSuperAdmin: boolean }>(ctx.superAdmin, 'GET', '/auth/me');
  expect(me.isSuperAdmin, 'le compte de seed doit être super administrateur').toBe(true);

  const run = Date.now().toString(36).toUpperCase().slice(-5);
  ctx.keys = { a: `RA${run}`, b: `RB${run}`, c: `RC${run}` };

  const admin = await ok<{ id: string }>(ctx.superAdmin, 'POST', '/users', {
    email: `rbac.admin.${run.toLowerCase()}@visiora.test`,
    name: 'Admin RBAC',
    password: PASSWORD,
    globalRole: 'ADMIN',
  });
  const member = await ok<{ id: string }>(ctx.superAdmin, 'POST', '/users', {
    email: `rbac.member.${run.toLowerCase()}@visiora.test`,
    name: 'Membre RBAC',
    password: PASSWORD,
    globalRole: 'MEMBER',
  });
  ctx.adminId = admin.id;
  ctx.memberId = member.id;

  await createProject(ctx.keys.a, `RBAC A ${run}`);
  const projectB = await createProject(ctx.keys.b, `RBAC B ${run}`);
  await createProject(ctx.keys.c, `RBAC C ${run}`);

  for (const userId of [admin.id, member.id]) {
    await ok(ctx.superAdmin, 'POST', `/projects/${ctx.keys.a}/members`, { userId, role: 'MEMBER' });
  }

  const itemB = await ok<{ id: string }>(
    ctx.superAdmin,
    'POST',
    `/projects/${ctx.keys.b}/work-items`,
    {
      type: 'EPIC',
      title: 'Epic confidentiel du projet B',
    },
  );
  const sprintB = await ok<{ id: string }>(
    ctx.superAdmin,
    'POST',
    `/projects/${ctx.keys.b}/sprints`,
    {
      name: 'Sprint confidentiel B',
      ...sprintDates(30),
    },
  );
  ctx.projectB = { id: projectB.id, itemId: itemB.id, sprintId: sprintB.id };

  ctx.admin = await login(`rbac.admin.${run.toLowerCase()}@visiora.test`, PASSWORD);
  ctx.member = await login(`rbac.member.${run.toLowerCase()}@visiora.test`, PASSWORD);
});

test.afterAll(async () => {
  for (const project of createdProjects) {
    await call(ctx.superAdmin, 'DELETE', `/projects/${project.key}`, {
      confirmationName: project.name,
    });
  }
  for (const userId of [ctx.adminId, ctx.memberId].filter(Boolean)) {
    await call(ctx.superAdmin, 'DELETE', `/users/${userId}`);
  }
  await request.dispose();
});

test.describe('visibilité des projets', () => {
  test('le super administrateur voit A, B et C', async () => {
    const { keys } = await listKeys(ctx.superAdmin);
    expect(keys).toEqual(expect.arrayContaining([ctx.keys.a, ctx.keys.b, ctx.keys.c]));
  });

  for (const role of ['admin', 'member'] as const) {
    test(`${role} : seulement A, total compris`, async () => {
      const { keys, total } = await listKeys(ctx[role]);
      expect(keys).toEqual([ctx.keys.a]);
      expect(total).toBe(1);
    });

    test(`${role} : la recherche globale ne révèle ni B ni C`, async () => {
      const results = await ok<{ projectKey: string }[]>(ctx[role], 'GET', '/search?q=RBAC');
      const keys = new Set(results.map((result) => result.projectKey));
      expect(keys.has(ctx.keys.b)).toBe(false);
      expect(keys.has(ctx.keys.c)).toBe(false);
    });
  }
});

test.describe('IDOR : projet B inaccessible par URL ou API directe', () => {
  for (const role of ['admin', 'member'] as const) {
    test(`${role} : aucune route du projet B`, async () => {
      const b = ctx.keys.b;
      const headers = ctx[role];
      for (const path of [
        `/projects/${b}`,
        `/projects/${ctx.projectB.id}`,
        `/projects/${b}/access`,
        `/projects/${b}/members`,
        `/projects/${b}/backlog`,
        `/projects/${b}/board`,
        `/projects/${b}/sprints`,
        `/projects/${b}/sprints/${ctx.projectB.sprintId}`,
        `/projects/${b}/work-items/${ctx.projectB.itemId}`,
        `/projects/${b}/dashboard`,
      ]) {
        const body = await expectStatus(headers, 'GET', path, 403);
        expect(JSON.stringify(body)).not.toContain('RBAC B');
      }
      await expectStatus(headers, 'PATCH', `/projects/${b}`, 403, { name: 'Piraté' });
      await expectStatus(headers, 'DELETE', `/projects/${b}`, 403, { confirmationName: 'x' });
      await expectStatus(headers, 'POST', `/projects/${b}/work-items`, 403, {
        type: 'EPIC',
        title: 'Intrusion',
      });
    });

    test(`${role} : un ticket ou un sprint de B passé par le projet A est introuvable`, async () => {
      const a = ctx.keys.a;
      const headers = ctx[role];
      const item = `/projects/${a}/work-items/${ctx.projectB.itemId}`;
      await expectStatus(headers, 'GET', item, 404);
      await expectStatus(headers, 'PATCH', item, 404, { title: 'Modifié depuis A' });
      await expectStatus(headers, 'DELETE', item, 404);
      await expectStatus(headers, 'GET', `/projects/${a}/sprints/${ctx.projectB.sprintId}`, 404);
      await expectStatus(headers, 'POST', `/projects/${a}/work-items`, 400, {
        type: 'STORY',
        title: 'Story rattachée à un epic de B',
        parentId: ctx.projectB.itemId,
      });
    });

    test(`${role} : une clé inconnue répond comme un projet interdit`, async () => {
      const unknown = await call(ctx[role], 'GET', '/projects/ZZQQXX');
      const forbidden = await call(ctx[role], 'GET', `/projects/${ctx.keys.b}`);
      expect(unknown.status).toBe(403);
      const { code, message } = forbidden.body as { code: string; message: string };
      expect(unknown.body).toMatchObject({ code, message });
    });
  }

  test('le ticket de B est intact après les tentatives', async () => {
    const item = await ok<{ title: string; deletedAt?: string }>(
      ctx.superAdmin,
      'GET',
      `/projects/${ctx.keys.b}/work-items/${ctx.projectB.itemId}`,
    );
    expect(item.title).toBe('Epic confidentiel du projet B');
  });
});

test.describe('création de projet et gestion des membres : super administrateur seul', () => {
  test('administrateur et membre ne créent pas de projet', async () => {
    for (const role of ['admin', 'member'] as const) {
      await expectStatus(ctx[role], 'POST', '/projects', 403, { key: 'RBNOPE', name: 'Interdit' });
    }
  });

  test('administrateur et membre ne gèrent pas les membres, même sur A', async () => {
    const a = ctx.keys.a;
    for (const role of ['admin', 'member'] as const) {
      const other = role === 'admin' ? ctx.memberId : ctx.adminId;
      await expectStatus(ctx[role], 'POST', `/projects/${a}/members`, 403, {
        userId: other,
        role: 'PROJECT_LEAD',
      });
      await expectStatus(ctx[role], 'PATCH', `/projects/${a}/members/${other}`, 403, {
        role: 'PROJECT_LEAD',
      });
      await expectStatus(ctx[role], 'DELETE', `/projects/${a}/members/${other}`, 403);
    }
  });

  test('le super administrateur affecte, change le rôle et retire ; le retrait prend effet aussitôt', async () => {
    const c = ctx.keys.c;
    await ok(ctx.superAdmin, 'POST', `/projects/${c}/members`, {
      userId: ctx.memberId,
      role: 'MEMBER',
    });
    await ok(ctx.member, 'GET', `/projects/${c}`);
    await ok(ctx.superAdmin, 'PATCH', `/projects/${c}/members/${ctx.memberId}`, {
      role: 'PROJECT_LEAD',
    });
    await ok(ctx.superAdmin, 'DELETE', `/projects/${c}/members/${ctx.memberId}`);
    // Même token : les droits sont relus en base à chaque requête.
    await expectStatus(ctx.member, 'GET', `/projects/${c}`, 403);
  });

  test('le super administrateur crée et supprime un projet', async () => {
    const key = `RD${Date.now().toString(36).toUpperCase().slice(-5)}`;
    await ok(ctx.superAdmin, 'POST', '/projects', { key, name: `RBAC D ${key}` });
    await expectStatus(ctx.superAdmin, 'DELETE', `/projects/${key}`, 204, {
      confirmationName: `RBAC D ${key}`,
    });
  });
});

test.describe('administrateur sur un projet accessible', () => {
  test('modifie le projet et importe', async () => {
    const a = ctx.keys.a;
    await ok(ctx.admin, 'PATCH', `/projects/${a}`, { description: 'Modifié par l’admin' });
    // Sans fichier : 400 prouve que la route est autorisée (le guard passe avant).
    const body = await expectStatus(ctx.admin, 'POST', `/projects/${a}/work-items/import`, 400);
    expect(body).toMatchObject({ code: 'IMPORT_FILE_REQUIRED' });
  });

  test('crée, modifie, planifie et clôture un sprint', async () => {
    const a = ctx.keys.a;
    const sprint = await ok<{ id: string }>(ctx.admin, 'POST', `/projects/${a}/sprints`, {
      name: 'Sprint admin',
      ...sprintDates(60),
    });
    await ok(ctx.admin, 'PATCH', `/projects/${a}/sprints/${sprint.id}`, { goal: 'Objectif' });
    const story = await ok<{ id: string }>(ctx.admin, 'POST', `/projects/${a}/work-items`, {
      type: 'STORY',
      title: 'Story à planifier',
    });
    await ok(ctx.admin, 'PATCH', `/projects/${a}/work-items/${story.id}`, { sprintId: sprint.id });
    await ok(ctx.admin, 'PATCH', `/projects/${a}/work-items/${story.id}`, { status: 'DONE' });
    await ok(ctx.admin, 'POST', `/projects/${a}/sprints/${sprint.id}/close`, {});
  });

  test('supprime un projet auquel il est affecté', async () => {
    const key = `RE${Date.now().toString(36).toUpperCase().slice(-5)}`;
    const name = `RBAC E ${key}`;
    await ok(ctx.superAdmin, 'POST', '/projects', { key, name });
    await ok(ctx.superAdmin, 'POST', `/projects/${key}/members`, {
      userId: ctx.adminId,
      role: 'MEMBER',
    });
    await expectStatus(ctx.admin, 'DELETE', `/projects/${key}`, 204, { confirmationName: name });
  });
});

test.describe('membre sur un projet accessible', () => {
  test('lit la vue d’ensemble, le board, le backlog et les sprints', async () => {
    const a = ctx.keys.a;
    for (const path of ['', '/members', '/board', '/backlog', '/sprints', '/dashboard']) {
      await ok(ctx.member, 'GET', `/projects/${a}${path}`);
    }
  });

  test('n’administre ni le projet, ni l’import, ni les sprints', async () => {
    const a = ctx.keys.a;
    await expectStatus(ctx.member, 'PATCH', `/projects/${a}`, 403, { description: 'Non' });
    await expectStatus(ctx.member, 'DELETE', `/projects/${a}`, 403, { confirmationName: 'x' });
    await expectStatus(ctx.member, 'POST', `/projects/${a}/work-items/import`, 403);

    await expectStatus(ctx.member, 'POST', `/projects/${a}/sprints`, 403, {
      name: 'Sprint membre',
      ...sprintDates(120),
    });
    const sprint = await ok<{ id: string }>(ctx.admin, 'POST', `/projects/${a}/sprints`, {
      name: 'Sprint de référence',
      ...sprintDates(90),
    });
    await ok(ctx.member, 'GET', `/projects/${a}/sprints/${sprint.id}`);
    await expectStatus(ctx.member, 'PATCH', `/projects/${a}/sprints/${sprint.id}`, 403, {
      name: 'Renommé',
    });
    await expectStatus(ctx.member, 'POST', `/projects/${a}/sprints/${sprint.id}/close`, 403, {});

    // « Affecter des Work Items » : changer le sprint d'un ticket = planification.
    const story = await ok<{ id: string }>(ctx.member, 'POST', `/projects/${a}/work-items`, {
      type: 'STORY',
      title: 'Story du membre',
    });
    await expectStatus(ctx.member, 'PATCH', `/projects/${a}/work-items/${story.id}`, 403, {
      sprintId: sprint.id,
    });
    await ok(ctx.member, 'DELETE', `/projects/${a}/work-items/${story.id}`);
  });

  test('crée, modifie, déplace et supprime Epic, User Story, Sous-tâche et Bug', async () => {
    const path = `/projects/${ctx.keys.a}/work-items`;
    const create = (data: Record<string, unknown>) =>
      ok<{ id: string; type: string }>(ctx.member, 'POST', path, data);

    const epic = await create({ type: 'EPIC', title: 'Epic du membre' });
    const story = await create({ type: 'STORY', title: 'Story du membre', parentId: epic.id });
    const subtask = await create({ type: 'SUBTASK', title: 'Tâche du membre', parentId: story.id });
    const bug = await create({ type: 'BUG', title: 'Bug du membre', parentId: story.id });

    for (const item of [epic, story, subtask, bug]) {
      const updated = await ok<{ title: string }>(ctx.member, 'PATCH', `${path}/${item.id}`, {
        title: `${item.type} modifié`,
        priority: 'HIGH',
      });
      expect(updated.title).toBe(`${item.type} modifié`);
    }

    // Glisser-déposer sur le board : changement de colonne (donc de statut).
    const columns = await ok<{ id: string; status: string; isDefault: boolean }[]>(
      ctx.member,
      'GET',
      `/projects/${ctx.keys.a}/board/columns`,
    );
    const inProgress = columns.find(
      (column) => column.isDefault && column.status === 'IN_PROGRESS',
    );
    expect(inProgress).toBeDefined();
    const moved = await ok<{ status: string }>(ctx.member, 'POST', `${path}/${subtask.id}/move`, {
      columnId: inProgress!.id,
    });
    expect(moved.status).toBe('IN_PROGRESS');

    for (const item of [bug, subtask, story, epic]) {
      await expectStatus(ctx.member, 'DELETE', `${path}/${item.id}`, 204);
    }
  });

  test('ses permissions effectives excluent toute administration', async () => {
    const access = await ok<{ permissions: string[] }>(
      ctx.member,
      'GET',
      `/projects/${ctx.keys.a}/access`,
    );
    for (const permission of [
      'project:update',
      'project:delete',
      'project:member:manage',
      'workitem:import',
      'sprint:manage',
      'sprint:close',
      'sprint:plan',
    ]) {
      expect(access.permissions).not.toContain(permission);
    }
    for (const permission of ['workitem:create', 'workitem:update', 'workitem:delete']) {
      expect(access.permissions).toContain(permission);
    }
  });
});
