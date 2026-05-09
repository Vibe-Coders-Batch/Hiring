import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: process.env.CI
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        timeout: 120_000,
        reuseExistingServer: true,
        env: {
          ...process.env,
          E2E_DISABLE_ADMIN_GUARD: 'true',
          DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
          NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
          AWS_REGION: process.env.AWS_REGION ?? 'ap-south-1',
          S3_RESUMES_BUCKET: process.env.S3_RESUMES_BUCKET ?? 'test-resumes',
          S3_OFFERS_BUCKET: process.env.S3_OFFERS_BUCKET ?? 'test-offers',
          S3_TRAINING_BUCKET: process.env.S3_TRAINING_BUCKET ?? 'test-training',
          SES_FROM_ADDRESS: process.env.SES_FROM_ADDRESS ?? 'hiring@example.com',
          BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID ?? 'anthropic.claude-sonnet-4-v1:0',
        },
      },
});
