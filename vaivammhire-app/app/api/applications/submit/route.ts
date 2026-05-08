import { NextResponse } from 'next/server';
import { db } from '@/server/db';
import { applications, candidates, jobs } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { presignResumeUpload } from '@/server/services/s3';
import { audit } from '@/server/db/audit';
import { sendEmail } from '@/server/services/ses';

const MAX_BYTES = 5 * 1024 * 1024;

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new NextResponse('invalid form', { status: 400 });
  }

  const jobId = String(form.get('jobId') ?? '');
  const name = String(form.get('name') ?? '').trim();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const phone = (form.get('phone') as string | null)?.trim() || null;
  const linkedin = (form.get('linkedin') as string | null)?.trim() || null;
  const resume = form.get('resume');
  const consent = form.get('consent_dpdp') === 'on';

  if (!jobId || !name || !email || !(resume instanceof File) || !consent) {
    return new NextResponse('missing fields', { status: 400 });
  }
  if (resume.size === 0 || resume.size > MAX_BYTES) {
    return new NextResponse('resume size invalid', { status: 400 });
  }

  const ext = resume.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx';
  const upload = await presignResumeUpload({
    contentType: resume.type || (ext === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
    ext,
  });

  // Stream the file to S3 via the presigned URL.
  const buf = await resume.arrayBuffer();
  const putRes = await fetch(upload.url, {
    method: 'PUT',
    headers: { 'content-type': resume.type || 'application/octet-stream' },
    body: buf,
  });
  if (!putRes.ok) {
    return new NextResponse('upload failed', { status: 502 });
  }

  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job || job.status !== 'open') {
    return new NextResponse('role unavailable', { status: 404 });
  }

  // Upsert candidate by email (PRD §9 — candidates.email unique).
  const [candidate] = await db
    .insert(candidates)
    .values({
      name,
      email,
      phone,
      linkedin,
      resumeS3Key: upload.key,
      consentDpdp: consent,
      consentTraining: consent,
    })
    .onConflictDoUpdate({
      target: candidates.email,
      set: { name, phone, linkedin, resumeS3Key: upload.key },
    })
    .returning();
  if (!candidate) return new NextResponse('candidate insert failed', { status: 500 });

  const [application] = await db
    .insert(applications)
    .values({ jobId: job.id, candidateId: candidate.id, stage: 'applied' })
    .returning();
  if (!application) return new NextResponse('application insert failed', { status: 500 });

  await audit({
    actorType: 'system',
    actorId: 'apply-form',
    action: 'application.submit',
    targetType: 'application',
    targetId: application.id,
    payload: { jobId: job.id, ip: req.headers.get('x-forwarded-for') ?? null },
  });

  // Background screening pipeline is fired by the S3 ObjectCreated EventBridge rule;
  // we don't invoke it inline (PRD §6.2).

  await sendEmail({
    to: email,
    subject: `We received your application for ${job.title}`,
    body: `Hi ${name},\n\nThanks for applying to ${job.title} at Vaivamm Capital. You can track your application here:\n${process.env.NEXT_PUBLIC_APP_URL}/track/${application.id}\n\nThe Vaivamm Capital Hiring Team`,
  }).catch(() => {
    /* SES not configured locally — non-fatal */
  });

  return NextResponse.json({ applicationId: application.id });
}
