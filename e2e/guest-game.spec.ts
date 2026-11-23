import { expect, test } from '@playwright/test';

const guestStorageKeys = ['benchmaster.app-mode', 'benchmaster.guest-state', 'benchmaster.locale'];

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate((keys) => keys.forEach((key) => localStorage.removeItem(key)), guestStorageKeys);
  await page.reload();
});

test('creates, tracks, finishes and reloads a guest game summary', async ({ page }) => {
  const playerNames = ['Alex Martin', 'Camille Bernard', 'Noah Petit', 'Lina Robert', 'Ethan Richard', 'Jade Durand'];

  await page.getByRole('textbox', { name: /nom de l'équipe/i }).fill('Étoiles E2E');
  await page.getByRole('textbox', { name: /liste de joueur/i }).fill(playerNames.join('\n'));
  await page.getByRole('button', { name: /créer l'équipe/i }).click();

  await expect(page.getByRole('heading', { name: /étoiles e2e/i })).toBeVisible();
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Nouveau match' })
    .click();

  await page.getByLabel(/nom du match/i).fill('Finale E2E');
  await page.getByRole('button', { name: /continuer vers le cinq/i }).click();
  for (const name of playerNames.slice(0, 5)) {
    await page.getByRole('button', { name: new RegExp(`retirer ${name} du cinq de départ`, 'i') }).click();
  }
  for (const name of playerNames.slice(0, 5)) {
    await page.getByRole('button', { name: new RegExp(`inclure ${name} dans le cinq`, 'i') }).click();
  }
  await page.getByRole('button', { name: /voir le résumé/i }).click();
  await page.getByRole('button', { name: /créer le match/i }).click();

  await expect(page.getByRole('heading', { name: /finale e2e/i })).toBeVisible();
  await page.getByRole('button', { name: /démarrer le match/i }).click();
  await expect(page.getByRole('button', { name: /mettre en pause/i })).toBeVisible();

  await page.getByRole('button', { name: 'Ajouter +2' }).first().click();

  await page.locator('[data-live-control="end-game"]').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: /terminer le match/i }).click();

  await expect(page.getByRole('heading', { name: 'Finale E2E' })).toBeVisible();
  await expect(page.getByText(/alex martin/i)).toBeVisible();
  await expect(page.getByRole('region', { name: /tableau des statistiques/i })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Finale E2E' })).toBeVisible();
  await expect(page.getByText(/alex martin/i)).toBeVisible();
});
