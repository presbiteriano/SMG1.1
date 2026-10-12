import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, loadScenario, m, openPanel } from './helpers';

// Iscrizioni aperte: un capitano arriva dal link in bio, compila il modulo e l'organizzatore
// trova la richiesta nel pannello (scena 4 del brief).

test.describe.configure({ mode: 'serial' });

let admin: Page;
const labels = m.registration;

test.beforeAll(async ({ browser }) => {
  admin = await openPanel(browser, 'titolare@example.org');
  await loadScenario(admin, 'iscrizioni');
});

test.afterAll(async () => {
  await loadScenario(admin, 'live');
  await admin.context().close();
});

test('la home invita a iscriversi e il conto alla rovescia scorre', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(m.home.registrationTitle);
  await expect(page.getByRole('timer')).toBeVisible();
  await page.getByRole('link', { name: m.home.registrationCta }).click();
  await expect(page).toHaveURL(/\/iscrizioni$/);
  await expectAccessible(page);
});

test('senza i consensi il modulo non salva nulla e spiega che cosa manca', async ({ page }) => {
  await page.goto('/iscrizioni');
  await page.getByLabel(labels.teamName).fill('Squadra Senza Consenso');
  await page.getByLabel(labels.contactFirstName, { exact: true }).fill('Referente');
  await page.getByLabel(labels.contactLastName, { exact: true }).fill('Esempio');
  await page.getByLabel(labels.phone, { exact: true }).fill('3XX');
  await page.getByLabel(labels.email, { exact: true }).fill('referente@example.org');
  await page.getByRole('button', { name: labels.submit }).click();
  await expect(page.getByText(labels.errors.phone)).toBeVisible();
  await expect(page.getByText(labels.errors.consentRules)).toBeVisible();
  await expect(page.getByText(labels.errors.consentPrivacy)).toBeVisible();
  // I dati già scritti restano nel modulo.
  await expect(page.getByLabel(labels.teamName)).toHaveValue('Squadra Senza Consenso');

  await admin.goto('/admin/iscrizioni');
  await expect(admin.getByText('Squadra Senza Consenso')).toHaveCount(0);
});

test('iscrizione completa: conferma al capitano e richiesta nel pannello', async ({ page }) => {
  await page.goto('/iscrizioni');
  await page.getByLabel(labels.teamName).fill('Squadra Prova E2E');
  await page.getByLabel(labels.contactFirstName, { exact: true }).fill('Referente');
  await page.getByLabel(labels.contactLastName, { exact: true }).fill('Esempio');
  await page.getByLabel(labels.phone, { exact: true }).fill('333 0000000');
  await page.getByLabel(labels.email, { exact: true }).fill('referente@example.org');
  await page.getByLabel(labels.hasMinors).check();
  await page.getByLabel(new RegExp(labels.consentRules)).check();
  await page.getByLabel(new RegExp(labels.consentPrivacy)).check();
  await page.getByRole('button', { name: labels.submit }).click();
  await expect(page.getByText(labels.successTitle)).toBeVisible();
  await expect(page.getByText(labels.successText)).toBeVisible();

  await admin.goto('/admin/iscrizioni');
  const card = admin.locator('li', { hasText: 'Squadra Prova E2E' });
  await expect(card).toContainText(m.admin.registrations.statuses.new);
  await expect(card).toContainText('333 0000000');

  // Accettata con «Crea la squadra»: compare tra le iscritte nella pagina dell'edizione.
  await card.getByLabel(m.admin.registrations.createTeam).check();
  await card.getByRole('button', { name: m.admin.common.save }).click();
  await expect(card.getByText(m.admin.registrations.teamCreated)).toBeVisible();
  await page.goto('/2027');
  await expect(page.getByRole('link', { name: 'Squadra Prova E2E' })).toBeVisible();
});

test('la richiesta di rimozione arriva al pannello con la scadenza delle 72 ore', async ({ page }) => {
  await page.goto('/rimozione-contenuti');
  const removal = m.legal.removal;
  await page.getByLabel(removal.reference).fill('Foto della finale, terza della galleria 2027');
  await page.getByLabel(removal.email).fill('genitore@example.org');
  await page.getByLabel(new RegExp(removal.consent)).check();
  await page.getByRole('button', { name: removal.submit }).click();
  await expect(page.getByText(removal.successTitle)).toBeVisible();

  await admin.goto('/admin/richieste');
  await expect(admin.getByText('Foto della finale, terza della galleria 2027')).toBeVisible();
  await expect(admin.getByText(m.admin.removals.due).first()).toBeVisible();
});
