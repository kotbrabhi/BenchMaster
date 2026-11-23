import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:4200';
let parsedBaseURL: URL;
try {
  parsedBaseURL = new URL(baseURL);
} catch {
  throw new Error(`Invalid E2E_BASE_URL: ${baseURL}. Set it to a local HTTP URL.`);
}
const allowedHosts = new Set(['127.0.0.1', 'localhost']);

if (parsedBaseURL.protocol !== 'http:' || !allowedHosts.has(parsedBaseURL.hostname)) {
  throw new Error(
    `Unsafe E2E_BASE_URL: ${baseURL}. End-to-end tests may only target local HTTP hosts (localhost or 127.0.0.1).`
  );
}

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: parsedBaseURL.origin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    ...devices['Desktop Chrome']
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev:frontend',
    url: parsedBaseURL.origin,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      E2E: '1',
      CI: process.env.CI ?? ''
    }
  }
});
