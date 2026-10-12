import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import it from '../lib/i18n/messages/it.json';

export const m = it;

export type Phase = keyof typeof it.admin.example.phases;

/** Un nuovo visitatore (o un nuovo telefono dello staff): contesto separato, senza cookie, stesso sito. */
export async function newVisitor(browser: Browser): Promise<BrowserContext> {
  return browser.newContext({ ...test.info().project.use, baseURL: test.info().project.use.baseURL });
}

/** Apre il pannello come utente di esempio e restituisce la pagina, da riusare nei test del file. */
export async function openPanel(browser: Browser, email: string): Promise<Page> {
  const page = await (await newVisitor(browser)).newPage();
  await login(page, email);
  return page;
}

/** Entra nel pannello con un utente di esempio: in sviluppo il link di accesso compare a schermo. */
export async function login(page: Page, email: string): Promise<void> {
  await page.goto('/admin/accedi');
  await page.getByLabel(m.admin.login.email).fill(email);
  await page.getByRole('button', { name: m.admin.login.submit }).click();
  await page.getByTestId('dev-login-link').click();
  await page.getByRole('button', { name: m.admin.login.confirm }).click();
  await page.waitForURL('**/admin');
}

/** Ricrea l'edizione di esempio nel momento del torneo indicato (pannello > Dati di esempio). */
export async function loadScenario(page: Page, phase: Phase): Promise<void> {
  await page.goto('/admin/esempio');
  const card = page.locator('li', { hasText: m.admin.example.phases[phase] });
  await card.getByRole('button', { name: m.admin.example.load }).click();
  await expect(card.getByText(m.admin.example.loaded)).toBeVisible({ timeout: 60_000 });
}

/** Accessibilità (brief 13.2): nessuna violazione grave o critica delle regole WCAG A e AA. */
export async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(
    serious.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(' | ')}`),
    `violazioni su ${page.url()}`,
  ).toEqual([]);
}
