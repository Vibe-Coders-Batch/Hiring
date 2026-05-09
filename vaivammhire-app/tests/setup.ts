import { vi } from 'vitest';

// Sane env defaults for unit tests (anything that hits AWS is mocked).
process.env.AWS_REGION ??= 'ap-south-1';
process.env.DATABASE_URL ??= 'postgres://test:test@localhost:5432/test';
process.env.S3_RESUMES_BUCKET ??= 'test-resumes';
process.env.S3_OFFERS_BUCKET ??= 'test-offers';
process.env.S3_TRAINING_BUCKET ??= 'test-training';
process.env.SES_FROM_ADDRESS ??= 'hiring@example.com';
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000';
process.env.BEDROCK_MODEL_ID ??= 'anthropic.claude-sonnet-4-v1:0';
process.env.ML_API_FEATURE_FLAGS ??= 'm1=off,m2=off,m3=off,m4=on,m5=on';
process.env.AUTH_DEV_SECRET ??= 'VaivammAdminDev2026!';

// Avoid logging from libraries during tests.
vi.spyOn(console, 'error').mockImplementation(() => {});
