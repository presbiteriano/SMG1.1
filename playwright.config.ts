import { defineConfig } from '@playwright/test';

// Test end-to-end sui percorsi principali, su viewport da telefono (brief 14 e 16.3).
// Girano contro il sito in sviluppo con l'edizione di esempio; gli scenari si cambiano dal pannello.
//
//   npm run test:e2e                      avvia da solo il sito sulla porta 3211
//   E2E_BASE_URL=http://localhost:3000    usa un sito già avviato
//   E2E_CHANNEL=msedge                    usa il browser già installato (niente download)

const port = Number(process.env.E2E_PORT ?? 3211);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Gli scenari di esempio sono uno stato condiviso: un test alla volta, nell'ordine dei file.
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL,
    browserName: 'chromium',
    channel: process.env.E2E_CHANNEL || undefined,
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    trace: 'retain-on-failure',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npm run dev -- -p ${port}`,
        url: baseURL,
        reuseExistingServer: true,
        timeout: 180_000,
        env: { SMG_RATE_LIMIT: 'off', SMG_DATA_DIR: '.data/e2e', SITE_URL: baseURL },
      },
});
