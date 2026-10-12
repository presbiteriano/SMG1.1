import { expect, test, type Page } from '@playwright/test';
import { loadScenario, m, openPanel } from './helpers';

// Serata in corso: l'organizzatore inserisce un risultato dal telefono e il sito si aggiorna (scena 2 del brief).

test.describe.configure({ mode: 'serial' });

let admin: Page;

test.beforeAll(async ({ browser }) => {
  admin = await openPanel(browser, 'titolare@example.org');
  await loadScenario(admin, 'live');
});

test.afterAll(async () => {
  await admin.context().close();
});

test('risultato in tre tocchi: partita, punteggio, salva', async ({ page }) => {
  await admin.goto('/admin');
  // Primo tocco: la partita ancora da giocare stasera.
  await admin.getByRole('link', { name: /Levante United/ }).click();
  await expect(admin.getByRole('heading', { name: /Levante United/ })).toBeVisible();
  // Secondo tocco: un gol alla squadra di casa.
  await admin.getByRole('button', { name: m.admin.result.plus.replace('{team}', 'Levante United') }).click();
  // Terzo tocco: salva.
  await admin.getByRole('button', { name: m.admin.result.saveFinal }).click();
  await expect(admin.getByText(m.admin.result.saved)).toBeVisible();

  // Il pubblico vede subito risultato e classifica aggiornati, senza aspettare.
  await page.goto('/edizioni/2027/calendario');
  const card = page.getByRole('link', { name: /Levante United 1, Ormeggio Team 0/ });
  await expect(card).toBeVisible();
  await page.goto('/edizioni/2027/classifica');
  const groupD = page.locator('table', { hasText: m.standings.caption.replace('{group}', 'D') });
  await expect(groupD.locator('tbody tr').first()).toContainText('LEV');
});

test('la cronologia registra la modifica e «Annulla» la riporta indietro', async () => {
  await expect(admin.getByText(m.admin.result.history)).toBeVisible();
  await admin.getByRole('button', { name: m.admin.result.undo }).click();
  await expect(admin.getByText(m.admin.result.undone)).toBeVisible();
  await expect(admin.getByText(m.status.scheduled).first()).toBeVisible();
});

test('rinvio con avviso: un banner compare in cima a ogni pagina', async ({ page }) => {
  const postpone = admin.locator('details', { hasText: m.admin.result.postponeNote });
  await postpone.locator('summary').click();
  await postpone.getByLabel(m.admin.result.postponeNote).fill('si gioca domani alle 21:00');
  await postpone.locator('button[type=submit]').click();
  await expect(admin.getByText(m.admin.result.statusSaved)).toBeVisible();

  await page.goto('/info');
  const banner = page.getByRole('alert').filter({ hasText: m.admin.result.postponeTitle });
  await expect(banner.first()).toContainText('LEV-ORM: si gioca domani alle 21:00');
});

test('un punteggio molto alto chiede conferma prima di salvare', async () => {
  await admin.goto('/admin');
  await admin.getByRole('link', { name: /Pineta Boys/ }).click();
  const plus = admin.getByRole('button', { name: m.admin.result.plus.replace('{team}', 'Pineta Boys') });
  for (let goals = 0; goals < 21; goals += 1) await plus.click();
  await admin.getByRole('button', { name: m.admin.result.saveFinal }).click();
  await expect(admin.getByText(m.admin.result.warnings.high_score)).toBeVisible();
  // Non si conferma: il risultato vero resta 0-2.
  await admin.reload();
  await expect(admin.getByRole('status').filter({ hasText: '0' }).first()).toBeVisible();
});

test('permessi: la sola lettura non modifica e non vede le sezioni riservate', async ({ browser }) => {
  const viewer = await openPanel(browser, 'socio@example.org');
  await viewer.goto('/admin/partite');
  await viewer.getByRole('link', { name: /Levante United/ }).first().click();
  await expect(viewer.getByText(m.admin.common.readOnly)).toBeVisible();
  await expect(viewer.getByRole('button', { name: m.admin.result.saveFinal })).toHaveCount(0);
  // Le pagine riservate al titolare rimandano alla prima pagina del pannello.
  await viewer.goto('/admin/utenti');
  await expect(viewer).toHaveURL(/\/admin$/);
  await viewer.goto('/admin/esempio');
  await expect(viewer).toHaveURL(/\/admin$/);
  await viewer.context().close();
});

test('chi non è entrato non vede il pannello', async ({ page }) => {
  await page.goto('/admin/iscrizioni');
  await expect(page).toHaveURL(/\/admin\/accedi$/);
  const response = await page.request.get('/api/admin/export/iscrizioni?edizione=2027');
  expect(response.status()).toBe(404);
});
