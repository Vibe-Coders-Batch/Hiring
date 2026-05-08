import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { applications, candidates, communications, jobs } from '@/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata = { title: 'Candidate 360' };

export default async function CandidateDetail({ params }: Props) {
  const { id } = await params;
  const [c] = await db.select().from(candidates).where(eq(candidates.id, id)).limit(1).catch(() => []);
  if (!c) notFound();

  const apps = await db
    .select({ application: applications, job: jobs })
    .from(applications)
    .innerJoin(jobs, eq(jobs.id, applications.jobId))
    .where(eq(applications.candidateId, id))
    .catch(() => []);

  const comms = await db
    .select()
    .from(communications)
    .where(eq(communications.applicationId, apps[0]?.application.id ?? id))
    .orderBy(desc(communications.sentAt))
    .limit(20)
    .catch(() => []);

  return (
    <div>
      <h1 className="text-h2 font-semibold">{c.name}</h1>
      <p className="text-neutral-600 mb-8">
        {c.email} {c.phone ? `· ${c.phone}` : ''} {c.linkedin ? `· ${c.linkedin}` : ''}
      </p>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Applications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {apps.map((a) => {
                const score =
                  a.application.scoreCard &&
                  typeof a.application.scoreCard === 'object' &&
                  'overall_fit_score' in a.application.scoreCard
                    ? (a.application.scoreCard as { overall_fit_score: number }).overall_fit_score
                    : null;
                return (
                  <div key={a.application.id} className="flex items-center justify-between rounded-md border border-neutral-200 p-3">
                    <div>
                      <p className="font-medium">{a.job.title}</p>
                      <p className="text-sm text-neutral-600">Stage: {a.application.stage.replace('_', ' ')}</p>
                    </div>
                    {score !== null && <Badge tone={score >= 75 ? 'success' : 'neutral'}>{score}</Badge>}
                  </div>
                );
              })}
              {apps.length === 0 && <p className="text-sm text-neutral-500">No applications.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent communications</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {comms.map((m) => (
                <div key={m.id} className="rounded-md border border-neutral-200 p-3 text-sm">
                  <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
                    <span>{m.channel} · {m.direction}</span>
                    <span>{new Date(m.sentAt).toLocaleString('en-IN')}</span>
                  </div>
                  {m.subject && <p className="font-medium">{m.subject}</p>}
                  <p className="text-neutral-700 whitespace-pre-line">{m.body}</p>
                </div>
              ))}
              {comms.length === 0 && <p className="text-sm text-neutral-500">No comms yet.</p>}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Consent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>DPDP processing</span>
                <Badge tone={c.consentDpdp ? 'success' : 'error'}>
                  {c.consentDpdp ? 'granted' : 'missing'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Training data</span>
                <Badge tone={c.consentTraining ? 'success' : 'warning'}>
                  {c.consentTraining ? 'granted' : 'denied'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resume</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-neutral-600 break-all">{c.resumeS3Key}</p>
              <p className="text-xs text-neutral-500 mt-2">
                Signed download URL is generated on demand (15-min TTL, PRD §12.3).
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
