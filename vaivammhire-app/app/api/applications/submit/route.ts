import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { audit } from '@/server/db/audit';
import { db } from '@/server/db';
import { applications, candidates, jobs } from '@/server/db/schema';
import {
  parseQuestionnaireFromForm,
  questionnaireToSummary,
  type ScreeningQuestionShape,
} from '@/lib/questionnaire';
import { presignResumeUpload } from '@/server/services/s3';
import { sendEmail } from '@/server/services/ses';
import { runScreening } from '@/server/services/screening-pipeline';

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

  const screeningQs = ((job.screeningQuestions as ScreeningQuestionShape[] | null) ?? []).filter(Boolean);
  const questionnairePayload = parseQuestionnaireFromForm(form, screeningQs);
  const questionnaireSummary = questionnaireToSummary(questionnairePayload);

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
    .values({
      jobId: job.id,
      candidateId: candidate.id,
      stage: 'applied',
      questionnaireAnswers: questionnairePayload as never,
    })
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

  void runScreening({
    applicationId: application.id,
    resumeBucket: upload.bucket,
    resumeKey: upload.key,
    questionnaireSummary,
  }).catch((err) => {
    console.error('[screening]', application.id, err);
  });

  await sendEmail({
    to: email,
    subject: `We received your application for ${job.title}`,
    body: `Hi ${name},\n\nThanks for applying to ${job.title} at Vaivamm Capital. You can track your application here:\n${process.env.NEXT_PUBLIC_APP_URL}/track/${application.id}\n\nThe Vaivamm Capital Hiring Team`,
  }).catch(() => {
    /* SES not configured locally — non-fatal */
  });

  return NextResponse.json({ applicationId: application.id });
}
