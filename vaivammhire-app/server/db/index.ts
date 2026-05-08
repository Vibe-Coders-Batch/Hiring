import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getServerEnv } from '@/lib/env';
import * as schema from './schema';

const env = getServerEnv();

const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
  ssl: env.DATABASE_URL.includes('rds.amazonaws.com') ? 'require' : false,
});

export const db = drizzle(queryClient, { schema, casing: 'snake_case' });
export type DB = typeof db;
export { schema };
