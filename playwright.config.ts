import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

/* O E2E reseeda o banco antes de subir. Desde que o runtime foi para o Supabase, isso rodaria na
   nuvem — por isso o servidor de teste aponta para o Postgres local (`LOCAL_*` no .env).
   Autenticação continua no Supabase Auth: as contas demo existem lá com a senha do seed. */
const localDatabaseUrl = process.env.LOCAL_DATABASE_URL;
const localDirectUrl = process.env.LOCAL_DIRECT_URL ?? localDatabaseUrl;
if (!localDatabaseUrl) throw new Error("LOCAL_DATABASE_URL ausente: o E2E só roda contra o banco local.");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  // Servidor de desenvolvimento compila rota na primeira visita e o login passa pelo Supabase
  // Auth: poucos workers e espera mais folgada evitam falso negativo por tempo.
  workers: 2,
  retries: 1,
  reporter: "list",
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3107",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run db:seed && npm run dev -- --port 3107",
    url: "http://localhost:3107",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { DATABASE_URL: localDatabaseUrl, DIRECT_URL: localDirectUrl!, NEXT_PUBLIC_APP_URL: "http://localhost:3107" },
  },
});
