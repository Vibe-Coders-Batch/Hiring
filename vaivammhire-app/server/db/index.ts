import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { getServerEnv } from '@/lib/env';
import * as schema from './schema';

const env = getServerEnv();

function postgresSslMode(url: string): false | 'require' {
  if (url.includes('localhost') || url.includes('127.0.0.1')) return false;
  if (url.includes('neon.tech')) return 'require';
  if (url.includes('rds.amazonaws.com')) return 'require';
  if (/[?&]sslmode=require/i.test(url)) return 'require';
  return false;
}

const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
  ssl: postgresSslMode(env.DATABASE_URL),
});

export const db = drizzle(queryClient, { schema, casing: 'snake_case' });
export type DB = typeof db;
export { schema };
