import { NextResponse } from 'next/server';
import { z } from 'zod';
import { audit } from '@/server/db/audit';
import { sendEmail } from '@/server/services/ses';

const schema = z.object({ email: z.string().email() });

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) return new NextResponse('invalid', { status: 400 });

  // Real impl: generate a signed magic-link token (15-min TTL) → email it →
  // confirmation endpoint cascades S3 + RDS deletes (PRD §12.1).
  const token = crypto.randomUUID();
  await sendEmail({
    to: parsed.data.email,
    subject: 'Confirm deletion of your VaivammHire data',
    body: `Click to confirm deletion (link expires in 15 minutes):\n${process.env.NEXT_PUBLIC_APP_URL}/api/dpdp/confirm?token=${token}`,
  }).catch(() => {
    /* SES not configured locally — log only */
  });

  await audit({
    actorType: 'system',
    actorId: 'dpdp',
    action: 'delete_request.initiated',
    targetType: 'candidate_email',
    targetId: parsed.data.email,
  });

  // Always return 200 to avoid email-enumeration.
  return NextResponse.json({ ok: true });
}
