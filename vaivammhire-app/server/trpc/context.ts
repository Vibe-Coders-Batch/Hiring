import { verifyStaffSession } from './auth';
import type { Context } from './init';

function bearerFromRequest(req: Request): string | null {
  const auth = req.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  const cookie = req.headers.get('cookie');
  if (!cookie) return null;
  const m = cookie.match(/(?:^|;\s*)vaivamm_staff=([^;]+)/);
  return m?.[1] ? decodeURIComponent(m[1].trim()) : null;
}

export async function createContext(req: Request): Promise<Context> {
  const token = bearerFromRequest(req);
  const session = await verifyStaffSession(token);

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null;

  return { session, reqIp: ip };
}
