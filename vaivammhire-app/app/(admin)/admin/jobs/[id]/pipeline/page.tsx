import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { applications, candidates, jobs } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { PipelineBoard } from './pipeline-board';

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata = { title: 'Pipeline' };

export default async function PipelinePage({ params }: Props) {
  const { id } = await params;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1).catch(() => []);
  if (!job) notFound();

  const rows = await db
    .select({
      applicationId: applications.id,
      stage: applications.stage,
      scoreCard: applications.scoreCard,
      lastActionAt: applications.lastActionAt,
      candidateId: candidates.id,
      candidateName: candidates.name,
      candidateEmail: candidates.email,
    })
    .from(applications)
    .innerJoin(candidates, eq(candidates.id, applications.candidateId))
    .where(eq(applications.jobId, id))
    .catch(() => []);

  return (
    <div>
      <h1 className="text-h2 font-semibold mb-1">{job.title}</h1>
      <p className="text-neutral-600 mb-8">Drag a card to move it. Each move is audited.</p>
      <PipelineBoard jobId={job.id} rows={rows} />
    </div>
  );
}
