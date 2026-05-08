import { z } from 'zod';

const serverSchema = z.object({
  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ACCOUNT_ID: z.string().optional(),
  DATABASE_URL: z.string().url(),

  BEDROCK_MODEL_ID: z.string().default('anthropic.claude-sonnet-4-v1:0'),
  BEDROCK_FALLBACK_REGION: z.string().default('ap-southeast-1'),
  BEDROCK_EMBEDDING_MODEL_ID: z.string().default('amazon.titan-embed-text-v2:0'),

  S3_RESUMES_BUCKET: z.string(),
  S3_OFFERS_BUCKET: z.string(),
  S3_TRAINING_BUCKET: z.string(),

  COGNITO_USER_POOL_ID: z.string().optional(),
  COGNITO_USER_POOL_CLIENT_ID: z.string().optional(),
  COGNITO_CANDIDATE_POOL_ID: z.string().optional(),
  COGNITO_CANDIDATE_POOL_CLIENT_ID: z.string().optional(),

  ML_API_BASE_URL: z.string().url().optional(),
  ML_API_FEATURE_FLAGS: z.string().default(''),

  SES_FROM_ADDRESS: z.string().email(),
  SES_REPLY_TO: z.string().email().optional(),

  CRM_WEBHOOK_URL: z.string().url().optional(),
  CRM_WEBHOOK_HMAC_SECRET: z.string().optional(),

  TURNSTILE_SECRET_KEY: z.string().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_BRAND_NAME: z.string().default('VaivammHire'),
});

export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;

let serverEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  // Next.js's RSC + 'use client' boundaries enforce server/client separation;
  // we don't need a runtime guard here, and a guard breaks unit tests in jsdom.
  if (!serverEnv) {
    const parsed = serverSchema.safeParse(process.env);
    if (!parsed.success) {
      console.error('Invalid server env:', parsed.error.flatten().fieldErrors);
      throw new Error('Invalid server environment variables');
    }
    serverEnv = parsed.data;
  }
  return serverEnv;
}

export function getClientEnv(): ClientEnv {
  return clientSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_BRAND_NAME: process.env.NEXT_PUBLIC_BRAND_NAME,
  });
}

export function parseFeatureFlags(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of raw.split(',').filter(Boolean)) {
    const [k, v] = pair.split('=');
    if (k && v) out[k.trim()] = v.trim();
  }
  return out;
}
