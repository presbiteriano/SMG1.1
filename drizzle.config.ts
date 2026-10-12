import { defineConfig } from 'drizzle-kit';

// Le migrazioni si generano dallo schema senza collegarsi al database: `npm run db:generate`.
export default defineConfig({
  dialect: 'postgresql',
  schema: './db/schema/index.ts',
  out: './db/migrations',
});
