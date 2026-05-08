import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { applications, candidates, jobs } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props {
  params: Promise<{ applicationId: string }>;
}

export const metadata = { title: 'Track your application' };

const STAGE_LABELS: Record<string, { label: string; tone: 'neutral' | 'primary' | 'success' | 'warning' | 'error' }> = {
  applied: { label: 'Applied', tone: 'neutral' },
  ai_screened: { label: 'AI screening', tone: 'primary' },
  hr_review: { label: 'HR review', tone: 'primary' },
  shortlisted: { label: 'Shortlisted', tone: 'success' },
  interview_1: { label: 'Interview · Phone', tone: 'primary' },
  assignment: { label: 'Take-home', tone: 'primary' },
  interview_2: { label: 'Interview · Hiring manager', tone: 'primary' },
  interview_3: { label: 'Interview · Founder', tone: 'primary' },
  reference_check: { label: 'Reference check', tone: 'primary' },
  offer: { label: 'Offer', tone: 'success' },
  hired: { label: 'Hired', tone: 'success' },
  rejected: { label: 'Closed', tone: 'error' },
  on_hold: { label: 'On hold', tone: 'warning' },
};

export default async function TrackPage({ params }: Props) {
  const { applicationId } = await params;

  // PRD §4.1: this page is magic-link verified. The link itself is the verification —
  // anyone with it can see status, but we deliberately do NOT show full scorecard,
  // PII, or internal notes here.
  const rows = await db
    .select({
      stage: applications.stage,
      lastActionAt: applications.lastActionAt,
      jobTitle: jobs.title,
      candidateName: candidates.name,
    })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .innerJoin(candidates, eq(candidates.id, applications.candidateId))
    .where(eq(applications.id, applicationId))
    .limit(1)
    .catch(() => [] as never[]);
  const row = rows[0];
  if (!row) notFound();

  const stage = STAGE_LABELS[row.stage] ?? { label: row.stage, tone: 'neutral' as const };

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-h2 font-semibold">Hi {row.candidateName.split(' ')[0]},</h1>
      <p className="mt-2 text-neutral-600">Here's where your application for <strong>{row.jobTitle}</strong> stands.</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge tone={stage.tone}>{stage.label}</Badge>
          <p className="mt-3 text-sm text-neutral-600">
            Last update: {new Date(row.lastActionAt).toLocaleDateString('en-IN', { dateStyle: 'long' })}
          </p>
        </CardContent>
      </Card>

      <p className="mt-8 text-sm text-neutral-600">
        Need to update something or withdraw?{' '}
        <a href="/delete-my-data" className="text-primary-600 hover:underline">Manage my data</a>.
      </p>
    </div>
  );
}
