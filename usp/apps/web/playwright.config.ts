import { defineConfig } from '@playwright/test';

// Runs against a running stack: `docker compose -f infra/docker-compose.yml up -d`, `pnpm dev:backend`, `pnpm dev:web`.
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: process.env.USP_WEB_URL ?? 'http://localhost:5173', viewport: { width: 1280, height: 900 }, locale: 'ar' },
  reporter: [['list']],
});
