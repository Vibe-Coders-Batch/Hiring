import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { getServerEnv } from '@/lib/env';

export interface AuthSession {
  userId: string;
  email: string;
  role: 'admin' | 'recruiter' | 'hiring_manager' | 'interviewer' | 'ml_engineer';
  cognitoSub: string;
}

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  const env = getServerEnv();
  if (!env.COGNITO_USER_POOL_ID || !env.COGNITO_USER_POOL_CLIENT_ID) {
    return null;
  }
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: env.COGNITO_USER_POOL_ID,
      tokenUse: 'access',
      clientId: env.COGNITO_USER_POOL_CLIENT_ID,
    });
  }
  return verifier;
}

/**
 * Verify a Cognito access token from the `Authorization: Bearer <jwt>` header
 * and return the session, or null if no/invalid token.
 *
 * Roles come from the `cognito:groups` claim — group `admin`, `recruiter`, etc.
 */
export async function verifyCognitoToken(token: string | null | undefined): Promise<AuthSession | null> {
  if (!token) return null;
  const v = getVerifier();
  if (!v) return null; // Cognito not configured (local dev fallback)

  try {
    const payload = await v.verify(token);
    const groups = (payload['cognito:groups'] ?? []) as string[];
    const role = (groups[0] ?? 'recruiter') as AuthSession['role'];
    return {
      userId: String(payload.sub),
      email: String(payload.username ?? payload.email ?? ''),
      role,
      cognitoSub: String(payload.sub),
    };
  } catch {
    return null;
  }
}
