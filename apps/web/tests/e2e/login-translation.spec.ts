import { expect, test } from '@playwright/test';

test('translated login button survives loading and a rejected login', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/auth/refresh', (route) =>
    route.fulfill({ status: 401, json: { code: 'UNAUTHORIZED', message: 'Session absente' } }),
  );
  let releaseLogin!: () => void;
  const pendingLogin = new Promise<void>((resolve) => {
    releaseLogin = resolve;
  });
  await page.route('**/auth/login', async (route) => {
    await pendingLogin;
    await route.fulfill({
      status: 401,
      json: { code: 'INVALID_CREDENTIALS', message: 'Identifiants invalides' },
    });
  });

  await page.goto('/login');
  await page.getByLabel(/adresse email/i).fill('translation-test@example.com');
  await page.getByLabel(/mot de passe/i).fill('InvalidPassword123!');
  const button = page.getByRole('button', { name: 'Se connecter' });
  // Browser translation replaces text nodes with nested font elements, leaving
  // React holding a detached reference to the original text node.
  await button.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    for (const node of nodes) {
      if (!node.textContent?.trim()) continue;
      const outer = document.createElement('font');
      const inner = document.createElement('font');
      inner.textContent = node.textContent;
      outer.append(inner);
      node.replaceWith(outer);
    }
  });
  await button.click();
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute('aria-busy', 'true');
  releaseLogin();
  await expect(page.getByRole('alert')).toHaveText('Identifiants invalides');
  await expect(button).toBeEnabled();
  await expect(button).not.toHaveAttribute('aria-busy', 'true');
  await expect(button).toHaveText('Se connecter');
  expect(errors).toEqual([]);
});
