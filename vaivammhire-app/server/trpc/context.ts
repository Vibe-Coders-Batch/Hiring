import { verifyCognitoToken } from './auth';
import type { Context } from './init';

export async function createContext(req: Request): Promise<Context> {
  const auth = req.headers.get('authorization');
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const session = await verifyCognitoToken(token);

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null;

  return { session, reqIp: ip };
}
