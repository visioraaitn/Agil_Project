import { expect, test } from '@playwright/test';

const ADMIN_EMAIL = 'admin@visiora.ai';
const PASSWORD = 'Visiora2026!';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel(/adresse email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/mot de passe/i).fill(PASSWORD);
  await page.getByRole('button', { name: /se connecter/i }).click();
  await expect(page).toHaveURL(/\/portfolio$/);
}

test('admin can log in and open the main project areas', async ({ page }) => {
  await login(page);

  await expect(page.getByRole('heading', { name: /portefeuille/i })).toBeVisible();
  await page.getByRole('link', { name: /visiora/i }).first().click();
  await expect(page).toHaveURL(/\/projects\/VIS\/overview$/);

  await expect(page.getByRole('link', { name: 'Boards', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Backlog', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sprints', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Repos & PR', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Dashboards', exact: true })).toBeVisible();
});

test('backlog filters are stored in the URL and restored after reload', async ({ page }) => {
  await login(page);
  await page.goto('/projects/VIS/backlog');

  await page.getByLabel(/rechercher un ticket/i).fill('api');
  await page.getByLabel(/filtrer par type/i).selectOption('STORY');
  await page.getByLabel(/filtrer par priorit/i).selectOption('HIGH');
  await page.getByLabel(/masquer les termin/i).check();

  await expect(page).toHaveURL(/search=api/);
  await expect(page).toHaveURL(/type=STORY/);
  await expect(page).toHaveURL(/priority=HIGH/);
  await expect(page).toHaveURL(/hideDone=true/);

  await page.reload();
  await expect(page.getByLabel(/rechercher un ticket/i)).toHaveValue('api');
  await expect(page.getByLabel(/filtrer par type/i)).toHaveValue('STORY');
  await expect(page.getByLabel(/filtrer par priorit/i)).toHaveValue('HIGH');
  await expect(page.getByLabel(/masquer les termin/i)).toBeChecked();
});

test('drag handles are reachable from the keyboard', async ({ page }) => {
  await login(page);

  await page.goto('/projects/VIS/backlog');
  const backlogHandle = page.getByRole('button', { name: /repositionner/i }).first();
  await expect(backlogHandle).toBeVisible();
  await backlogHandle.focus();
  await expect(backlogHandle).toBeFocused();

  await page.goto('/projects/VIS/boards');
  const boardHandle = page.getByRole('button', { name: /d.placer/i }).first();
  await expect(boardHandle).toBeVisible();
  await boardHandle.focus();
  await expect(boardHandle).toBeFocused();
});
