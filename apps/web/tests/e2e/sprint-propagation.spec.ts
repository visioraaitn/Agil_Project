import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';

const apiRequire = createRequire(new URL('../../../api/package.json', import.meta.url));
const { PrismaClient } = apiRequire('@prisma/client');

test('renumérote après suppression et crée au numéro suivant', async ({ request }) => {
  const base = process.env.E2E_API_URL!;
  const login = await request.post(`${base}/auth/login`, {
    data: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD },
    headers: { 'X-Requested-With': 'VisioraAI' },
  });
  expect(login.status()).toBe(200);
  const { accessToken } = await login.json();
  const headers = { Authorization: `Bearer ${accessToken}`, 'X-Requested-With': 'VisioraAI' };
  const prisma = new PrismaClient();
  async function create(path: string, data: unknown) {
    const response = await request.post(`${base}${path}`, { data, headers });
    expect(response.status(), await response.text()).toBe(201);
    return response.json();
  }
  try {
    const key = `N${Date.now().toString(36).toUpperCase()}`;
    const project = await create('/projects', { key, name: `Vérification numéro ${key}` });
    const path = `/projects/${key}/work-items`;
    const epic = await create(path, {
      type: 'EPIC',
      title: 'Epic numérotation',
      priority: 'MEDIUM',
    });
    const stories = [];
    for (let number = 1; number <= 4; number++) {
      const story = await create(path, {
        type: 'STORY',
        title: `Story numéro ${number}`,
        parentId: epic.id,
        priority: 'MEDIUM',
      });
      expect(story.number).toBe(number);
      stories.push(story);
    }
    const subtask = await create(path, {
      type: 'SUBTASK', title: 'Sous-tâche du troisième ticket', parentId: stories[2].id, priority: 'MEDIUM',
    });
    const removed = await request.delete(`${base}${path}/${stories[1].id}`, { headers });
    expect(removed.status()).toBe(204);
    const remainingIds = [stories[0].id, stories[2].id, stories[3].id];
    const before = await prisma.workItem.findMany({
      where: { id: { in: remainingIds } },
      orderBy: { number: 'asc' },
    });
    expect(before.map((row: { number: number }) => row.number)).toEqual([1, 2, 3]);
    expect(before.map((row: { id: string }) => row.id)).toEqual(remainingIds);
    const childRead = await request.get(`${base}${path}/${subtask.id}`, { headers });
    expect((await childRead.json()).key).toBe(`${key}-1-2-T1`);
    const replacement = await create(path, {
      type: 'STORY',
      title: 'Story créée après suppression',
      parentId: epic.id,
      priority: 'MEDIUM',
    });
    expect(replacement.number).toBe(4);
    expect(replacement.key).toBe(`${key}-1-4`);
    const after = await prisma.workItem.findMany({
      where: { id: { in: remainingIds } },
      orderBy: { number: 'asc' },
    });
    expect(after).toEqual(before);
    const stored = await prisma.workItem.findUnique({ where: { id: replacement.id } });
    expect(stored.number).toBe(4);
    const read = await request.get(`${base}${path}/${replacement.id}`, { headers });
    expect(read.status()).toBe(200);
    expect((await read.json()).key).toBe(`${key}-1-4`);
    console.log(
      `PASS ${project.key} : 1,2,3,4 → suppression 2 → 1,2,3 → nouveau 4 ; UUID conservés.`,
    );
  } finally {
    await prisma.$disconnect();
  }
});

test('sprint : interface, API, persistance, conflits, classement et clôture', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  expect(email, 'E2E_ADMIN_EMAIL ou ADMIN_SEED_EMAIL requis').toBeTruthy();
  expect(password, 'E2E_ADMIN_PASSWORD ou ADMIN_SEED_PASSWORD requis').toBeTruthy();
  const base = process.env.E2E_API_URL!;
  const login = await request.post(`${base}/auth/login`, {
    data: { email, password },
    headers: { 'X-Requested-With': 'VisioraAI' },
  });
  expect(login.status()).toBe(200);
  const { accessToken } = await login.json();
  const headers = { Authorization: `Bearer ${accessToken}`, 'X-Requested-With': 'VisioraAI' };
  async function api(method: string, path: string, data?: unknown, status?: number) {
    const response = await request.fetch(`${base}${path}`, { method, data, headers });
    if (status) expect(response.status(), await response.text()).toBe(status);
    else expect(response.ok(), await response.text()).toBeTruthy();
    return response.status() === 204 ? null : response.json();
  }
  const prisma = new PrismaClient();
  const key = `T${Date.now().toString(36).toUpperCase()}`;
  const project = await api('POST', '/projects', { key, name: `Vérification sprint ${key}` });
  const root = `/projects/${key}`;
  const now = new Date();
  const end = new Date(now.getTime() + 14 * 86400_000);
  const sprint1 = await api('POST', `${root}/sprints`, {
    name: 'Sprint 1',
    startDate: now,
    endDate: end,
  });
  const sprint2 = await api('POST', `${root}/sprints`, {
    name: 'Sprint 2',
    startDate: new Date(end.getTime() + 86400_000),
    endDate: new Date(end.getTime() + 15 * 86400_000),
  });
  const create = (title: string, type: string, parentId?: string, sprintId?: string | null) =>
    api('POST', `${root}/work-items`, { title, type, parentId, sprintId, priority: 'MEDIUM' });
  const epic = await create('Epic propagation', 'EPIC');
  const story1 = await create('Story première', 'STORY', epic.id);
  const story2 = await create('Story seconde', 'STORY', epic.id);
  const subtask = await create('Sous-tâche profonde', 'SUBTASK', story1.id);
  const ids = [epic.id, story1.id, story2.id, subtask.id];
  const original = await prisma.workItem.findMany({
    where: { id: { in: ids } },
    orderBy: { id: 'asc' },
  });
  async function assertSprint(sprintId: string | null, itemIds = ids) {
    const rows = await prisma.workItem.findMany({ where: { id: { in: itemIds } } });
    expect(rows).toHaveLength(itemIds.length);
    for (const row of rows) {
      expect(row.sprintId).toBe(sprintId);
      expect((await api('GET', `${root}/work-items/${row.id}`)).sprintId).toBe(sprintId);
    }
  }
  async function openItem(title: string) {
    await page.getByRole('button', { name: title, exact: true }).click();
    await expect(page.locator('#wi-sprint')).toBeVisible();
  }
  async function saveSprint(id: string, expectedStatus = 200) {
    await page.locator('#wi-sprint').selectOption(id);
    const response = page.waitForResponse(
      (r) => r.url().includes(`/work-items/${epic.id}`) && r.request().method() === 'PATCH',
    );
    await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
    expect((await response).status()).toBe(expectedStatus);
  }
  try {
    await test.step('Epic → sprint → tous les descendants, DB et refresh', async () => {
      await page.goto('/login');
      await page.getByLabel(/adresse email/i).fill(email!);
      await page.getByLabel(/mot de passe/i).fill(password!);
      await page.getByRole('button', { name: /se connecter/i }).click();
      await expect(page).toHaveURL(/\/portfolio$/);
      await page.goto(`/projects/${key}/backlog`);
      await openItem(epic.title);
      await saveSprint(sprint1.id);
      await assertSprint(sprint1.id);
      await page.reload();
      for (const item of [epic, story1, story2, subtask]) {
        await openItem(item.title);
        await expect(page.locator('#wi-sprint')).toHaveValue(sprint1.id);
        await page.getByRole('button', { name: 'Fermer', exact: true }).last().click();
      }
    });
    await test.step('Conflit : annuler ne modifie rien ; confirmer propage', async () => {
      await api('PATCH', `${root}/work-items/${story2.id}`, { sprintId: sprint2.id });
      const before = await prisma.workItem.findMany({
        where: { id: { in: ids } },
        orderBy: { id: 'asc' },
      });
      await openItem(epic.title);
      await saveSprint(sprint2.id, 400);
      const dialog = page.getByRole('dialog', { name: "Changer le sprint de l'Epic ?" });
      await expect(dialog.getByText(story1.title, { exact: true })).toBeVisible();
      await dialog.getByRole('button', { name: 'Annuler', exact: true }).click();
      await expect(page.locator('#wi-sprint')).toHaveValue(sprint1.id);
      expect(
        await prisma.workItem.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } }),
      ).toEqual(before);
      await saveSprint(sprint2.id, 400);
      const saved = page.waitForResponse(
        (r) => r.url().includes(`/work-items/${epic.id}`) && r.request().method() === 'PATCH',
      );
      await dialog.getByRole('button', { name: 'Confirmer', exact: true }).click();
      expect((await saved).status()).toBe(200);
      await expect(dialog).not.toBeVisible();
      await assertSprint(sprint2.id);
      await page.reload();
      await openItem(epic.title);
      await expect(page.locator('#wi-sprint')).toHaveValue(sprint2.id);
      await page.getByRole('button', { name: 'Fermer', exact: true }).last().click();
    });
    await test.step('Création ultérieure : héritage et choix explicite du backlog', async () => {
      await page.getByRole('button', { name: 'Nouveau ticket', exact: true }).click();
      await page.locator('#new-title').fill('Story héritée');
      await page.locator('#new-parent').selectOption(epic.id);
      await expect(page.locator('#new-sprint')).toHaveValue(sprint2.id);
      const creation = page.waitForResponse(
        (r) => r.url().endsWith('/work-items') && r.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Créer', exact: true }).click();
      const created = await creation;
      expect(created.status()).toBe(201);
      const inherited = await created.json();
      await assertSprint(sprint2.id, [inherited.id]);
      const inheritedApi = await create('Story héritée via API', 'STORY', epic.id);
      await assertSprint(sprint2.id, [inheritedApi.id]);
      const backlog = await create('Story backlog explicite', 'STORY', epic.id, null);
      await assertSprint(null, [backlog.id]);
    });
    await test.step('La route move respecte aussi conflits et propagation', async () => {
      const error = await api(
        'POST',
        `${root}/work-items/${epic.id}/move`,
        { sprintId: sprint1.id },
        400,
      );
      expect(error.code).toBe('SPRINT_PROPAGATION_CONFIRMATION_REQUIRED');
      await assertSprint(sprint2.id);
      await api('POST', `${root}/work-items/${epic.id}/move`, {
        sprintId: sprint1.id,
        confirmSprintPropagation: true,
      });
      await assertSprint(sprint1.id);
    });
    await test.step('Reorder : rank et numéros suivent la position', async () => {
      const before = await api('GET', `${root}/work-items/${story2.id}`);
      await api('POST', `${root}/work-items/${story2.id}/reorder`, { afterId: story1.id });
      const after = await api('GET', `${root}/work-items/${story2.id}`);
      expect(after.number).toBe(1);
      expect(after.id).toBe(before.id);
      expect(after.key).not.toBe(before.key);
      expect(after.rank).not.toBe(before.rank);
      const disposable = await create('Numéro réutilisable', 'EPIC');
      await api('DELETE', `${root}/work-items/${disposable.id}`);
      const replacement = await create('Numéro réutilisé', 'EPIC');
      expect(replacement.number).toBe(disposable.number);
      expect((await api('GET', `${root}/work-items/${epic.id}`)).number).toBe(epic.number);
      await page.reload();
      await page.getByRole('button', { name: 'Replier', exact: true }).first().click();
      const handle = page.getByRole('button', {
        name: `Repositionner ${replacement.key}`,
        exact: true,
      });
      await handle.focus();
      await page.keyboard.press('Space');
      await expect(handle).toHaveAttribute('aria-pressed', 'true');
      await page.keyboard.press('ArrowUp');
      // Laisser finir l'animation de déplacement avant de relâcher le ticket.
      await page.waitForTimeout(300);
      const reordered = page.waitForResponse(
        (r) => r.url().endsWith(`/work-items/${replacement.id}/reorder`),
        { timeout: 10_000 },
      );
      await page.keyboard.press('Space');
      expect((await reordered).ok()).toBeTruthy();
      const moved = await api('GET', `${root}/work-items/${replacement.id}`);
      expect(moved.number).toBe(1);
      expect(moved.id).toBe(replacement.id);
      expect(moved.key).not.toBe(replacement.key);
      expect(moved.rank).not.toBe(replacement.rank);
      const descendant = await api('GET', `${root}/work-items/${subtask.id}`);
      expect(descendant.key).toBe(`${key}-2-2-T1`);
      await page.reload();
      await expect(page.getByText(descendant.key, { exact: true })).toBeVisible();
    });
    await test.step('Clôture : cible obligatoire, report puis backlog, hiérarchie intacte', async () => {
      await api(
        'POST',
        `${root}/sprints/${sprint1.id}/close`,
        { unfinishedItemsAction: 'MOVE_TO_SPRINT' },
        400,
      );
      await assertSprint(sprint1.id);
      await page.goto(`/projects/${key}/sprints`);
      await page.getByRole('button', { name: /Sprint 1/ }).click();
      await page.getByRole('button', { name: 'Clôturer', exact: true }).click();
      const closeDialog = page.getByRole('dialog', { name: 'Clôturer Sprint 1 ?' });
      await closeDialog.getByLabel('Déplacer vers un autre sprint').check();
      await expect(
        closeDialog.getByRole('button', { name: 'Clôturer', exact: true }),
      ).toBeDisabled();
      await closeDialog.locator('#close-target-sprint').selectOption(sprint2.id);
      const closed = page.waitForResponse((r) => r.url().endsWith(`/sprints/${sprint1.id}/close`));
      await closeDialog.getByRole('button', { name: 'Clôturer', exact: true }).click();
      expect((await closed).ok()).toBeTruthy();
      await assertSprint(sprint2.id);
      await expect(closeDialog).not.toBeVisible();
      await page.getByRole('button', { name: /Sprint 2/ }).click();
      await page.getByRole('button', { name: 'Clôturer', exact: true }).click();
      const backlogDialog = page.getByRole('dialog', { name: 'Clôturer Sprint 2 ?' });
      await backlogDialog.getByLabel('Remettre dans le backlog (aucun sprint)').check();
      const backlogged = page.waitForResponse((r) =>
        r.url().endsWith(`/sprints/${sprint2.id}/close`),
      );
      await backlogDialog.getByRole('button', { name: 'Clôturer', exact: true }).click();
      expect((await backlogged).ok()).toBeTruthy();
      await assertSprint(null);
      for (const row of original) {
        const current = await prisma.workItem.findUnique({ where: { id: row.id } });
        expect(current.parentId).toBe(row.parentId);
        expect(current.deletedAt).toBeNull();
      }
    });
    await test.step('Seed labels idempotent, couleurs distinctes, lecture API', async () => {
      const { seedProjectLabels, DEFAULT_LABELS } = apiRequire('./dist/prisma/default-labels.js');
      const first = await seedProjectLabels(prisma, project.id);
      const second = await seedProjectLabels(prisma, project.id);
      expect(second).toEqual(first);
      const labels = await prisma.label.findMany({ where: { projectId: project.id } });
      expect(labels).toHaveLength(6);
      expect(new Set(labels.map((label: { color: string }) => label.color)).size).toBe(6);
      expect(labels.map((label: { name: string }) => label.name).sort()).toEqual(
        DEFAULT_LABELS.map((label: { name: string }) => label.name).sort(),
      );
      const fromApi = await api('GET', `${root}/labels`);
      expect(fromApi.map((label: { id: string }) => label.id).sort()).toEqual(
        labels.map((label: { id: string }) => label.id).sort(),
      );
    });
    console.log(`Projet de vérification conservé : ${project.key}`);
  } finally {
    await prisma.$disconnect();
  }
});
