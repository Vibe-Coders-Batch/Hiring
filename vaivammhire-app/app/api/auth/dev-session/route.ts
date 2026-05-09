import { NextResponse } from 'next/server';
import { z } from 'zod';
import { signDevToken } from '@/server/auth/dev-token';
import { getServerEnv } from '@/lib/env';
import { ensureDefaultOrganization } from '@/lib/org';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';

export const runtime = 'nodejs';

const bodySchema = z.object({
  secret: z.string().min(8),
  email: z.string().email(),
  name: z.string().min(1).max(200),
  role: z.enum(['admin', 'recruiter', 'hiring_manager', 'interviewer', 'ml_engineer']).default('recruiter'),
});

/**
 * Exchange a shared secret for a signed staff token + HttpOnly cookie (local / staging).
 * Disabled when AUTH_DEV_SECRET is not set.
 */
export async function POST(req: Request) {
  const env = getServerEnv();
  if (!env.AUTH_DEV_SECRET) {
    return NextResponse.json({ error: 'Dev auth disabled' }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const { secret, email, name, role } = parsed.data;
  if (secret !== env.AUTH_DEV_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const org = await ensureDefaultOrganization();

  const [user] = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      name,
      role,
      organizationId: org.id,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { name, role, organizationId: org.id },
    })
    .returning();

  if (!user) return NextResponse.json({ error: 'User upsert failed' }, { status: 500 });

  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7;
  const token = signDevToken(
    { userId: user.id, email: user.email, name: user.name, role: user.role, exp },
    env.AUTH_DEV_SECRET,
  );

  const res = NextResponse.json({ token, email: user.email, role: user.role });
  res.cookies.set('vaivamm_staff', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}

export async function DELETE() {
  const env = getServerEnv();
  if (!env.AUTH_DEV_SECRET) {
    return NextResponse.json({ ok: true });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set('vaivamm_staff', '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
