import { expect, test, type Page } from '@playwright/test';
import { expectAccessible, loadScenario, m, newVisitor, openPanel } from './helpers';

// Torneo concluso: archivio, classifiche, tabellone, statistiche. Qui si verificano anche le regole
// su minorenni e foto (T9 e T10 del brief) e che il sito non contatti nessun dominio di terzi.

test.describe.configure({ mode: 'serial' });

let admin: Page;

test.beforeAll(async ({ browser }) => {
  admin = await openPanel(browser, 'titolare@example.org');
  await loadScenario(admin, 'conclusa');
});

test.afterAll(async () => {
  // Si lascia il sito nello stato «serata in corso», quello da cui parte lo sviluppo.
  await loadScenario(admin, 'live');
  await admin.context().close();
});

test('la home racconta chi ha vinto e non parla con nessun altro sito', async ({ page, context, baseURL }) => {
  const own = new URL(baseURL as string).origin;
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.protocol.startsWith('http') && url.origin !== own) foreign.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Porto Canale');
  await page.goto('/edizioni/2027/calendario');
  await page.goto('/sponsor');
  await page.goto('/info');
  // Nessuna richiesta a domini di terzi e nessun cookie per chi visita il sito pubblico (brief 13.4).
  expect(foreign).toEqual([]);
  expect(await context.cookies()).toEqual([]);
});

test('le classifiche sono quelle attese dall’edizione di esempio (T2 e T4)', async ({ page }) => {
  await page.goto('/edizioni/2027/classifica');
  const order = async (group: string) => {
    const table = page.locator('table', { hasText: m.standings.caption.replace('{group}', group) });
    return (await table.locator('tbody tr th .display').allInnerTexts()).map((text) => text.trim());
  };
  expect(await order('A')).toEqual(['FAR', 'SCO', 'GAB', 'DAR']);
  expect(await order('B')).toEqual(['BAG', 'MOL', 'TRA', 'MAE']);
  expect(await order('D')).toEqual(['LEV', 'COR', 'ORM', 'SAB']);
  await expect(page.getByText('MOL, TRA, MAE')).toBeVisible();
});

test('il tabellone si legge un turno alla volta e incorona il campione', async ({ page }) => {
  await page.goto('/edizioni/2027/tabellone');
  await expect(page.getByRole('heading', { name: m.match.stageName.quarter })).toBeVisible();
  await expect(page.getByText(m.match.afterPens).first()).toBeVisible();
  await expect(page.getByText(m.bracket.championOf.replace('{competition}', 'Coppa'))).toBeVisible();
});

test('T9 - un minorenne compare solo come «Lorenzo V.», in ogni pagina e nei dati', async ({ page }) => {
  for (const path of ['/statistiche?edizione=2027', '/squadre/faro-rovers', '/albo-doro']) {
    await page.goto(path);
    await expect(page.getByText('Lorenzo V.').first()).toBeVisible();
    expect(await page.content()).not.toContain('Venturelli');
  }
  const search = await page.request.get('/api/search');
  const body = await search.text();
  expect(body).toContain('Lorenzo V.');
  expect(body).not.toContain('Venturelli');
  // Il maggiorenne che ha chiesto di non comparire resta «Giocatore n. 5» e non è cercabile per nome.
  expect(body).not.toContain('Pasini');
});

test('T10 - una foto non approvata non si vede, nemmeno con il link diretto', async ({ page, browser }) => {
  await admin.goto('/admin/foto?stato=draft&edizione=2027');
  const draftSource = await admin.locator('img[src^="/media/"]').first().getAttribute('src');
  expect(draftSource).toBeTruthy();
  const draftId = /\/media\/(\d+)/.exec(draftSource as string)?.[1] as string;
  // Chi lavora nel pannello la vede, per poterla approvare.
  expect((await admin.request.get(`/media/${draftId}`)).status()).toBe(200);

  // Un visitatore qualunque no: 404 con il link diretto, assente dalla galleria e dalla sitemap.
  const visitor = await newVisitor(browser);
  expect((await visitor.request.get(`/media/${draftId}`)).status()).toBe(404);
  await visitor.close();

  await page.goto('/foto?edizione=2027');
  const shown = await page.locator('img[src^="/media/"]').evaluateAll((images) => images.map((image) => image.getAttribute('src') ?? ''));
  expect(shown.length).toBeGreaterThan(0);
  expect(shown.some((source) => source.startsWith(`/media/${draftId}?`))).toBe(false);
  expect(await (await page.request.get('/sitemap.xml')).text()).not.toContain('/media/');
});

test('con minorenni riconoscibili e senza liberatoria l’approvazione è impedita', async () => {
  await admin.goto('/admin/foto?stato=draft&edizione=2027');
  const card = admin.locator('li', { has: admin.locator('input[name="containsMinors"]:checked') }).first();
  await card.getByRole('button', { name: m.admin.photos.approve }).click();
  await expect(card.getByText(m.admin.photos.blocked)).toBeVisible();
});

test('404 con il tono del torneo', async ({ page }) => {
  const response = await page.goto('/pagina-che-non-esiste');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: m.errors.notFoundTitle })).toBeVisible();
  await expect(page.getByRole('link', { name: m.errors.notFoundCta })).toBeVisible();
});

test('il calendario si aggiunge all’agenda e il risultato si condivide come immagine', async ({ page }) => {
  const ics = await page.request.get('/api/ics/squadra/porto-canale');
  expect(ics.headers()['content-type']).toContain('text/calendar');
  expect(await ics.text()).toContain('SUMMARY:Vele Bianche - Porto Canale');
  await page.goto('/edizioni/2027/tabellone');
  const final = page.getByRole('link', { name: /Finale\. Porto Canale 3, Bagni Atletico 2/ });
  // Si apre la pagina come farebbe chi arriva da un link condiviso: caricamento completo, non navigazione interna.
  await page.goto((await final.getAttribute('href')) as string);
  await expect(page.getByRole('button', { name: m.share.button })).toBeVisible();
  const previews = page.locator('meta[property="og:image"]');
  await expect(previews).toHaveCount(1);
  const preview = await page.request.get((await previews.getAttribute('content')) as string);
  expect(preview.headers()['content-type']).toBe('image/png');
  const story = await page.request.get(`/api/share/${page.url().split('/').pop()}?formato=storia`);
  expect(story.headers()['content-type']).toBe('image/png');
});

test('accessibilità delle pagine principali (WCAG 2.2 AA)', async ({ page }) => {
  for (const path of ['/', '/edizioni/2027/calendario?giorno=tutte', '/edizioni/2027/classifica', '/edizioni/2027/tabellone', '/squadre/faro-rovers', '/statistiche', '/albo-doro', '/info', '/iscrizioni']) {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    await expectAccessible(page);
  }
});
