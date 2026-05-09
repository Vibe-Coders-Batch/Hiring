import { createHmac, timingSafeEqual } from 'crypto';
import type { AuthSession } from '@/server/trpc/auth';

const SEP = '.';

export interface DevTokenPayload {
  userId: string;
  email: string;
  name: string;
  role: AuthSession['role'];
  exp: number;
}

export function signDevToken(payload: DevTokenPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}${SEP}${sig}`;
}

export function verifyDevToken(token: string, secret: string): DevTokenPayload | null {
  const idx = token.lastIndexOf(SEP);
  if (idx <= 0) return null;
  const body = token.slice(0, idx);
  const sig = token.slice(idx + 1);
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  try {
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let parsed: DevTokenPayload;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as DevTokenPayload;
  } catch {
    return null;
  }
  if (typeof parsed.exp !== 'number' || parsed.exp < Date.now() / 1000) return null;
  if (!parsed.userId || !parsed.email || !parsed.role) return null;
  return parsed;
}
