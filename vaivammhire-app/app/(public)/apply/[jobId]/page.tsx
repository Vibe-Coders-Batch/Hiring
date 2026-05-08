import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { jobs } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { ApplyForm } from './apply-form';

interface Props {
  params: Promise<{ jobId: string }>;
}

export const metadata = { title: 'Apply' };

export default async function ApplyPage({ params }: Props) {
  const { jobId } = await params;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1).catch(() => []);
  if (!job || job.status !== 'open') notFound();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-h1 font-semibold tracking-tight">Apply: {job.title}</h1>
      <p className="mt-2 text-neutral-600">
        {job.department} · {job.location.replace('_', ' ')}
      </p>
      <ApplyForm
        jobId={job.id}
        screeningQuestions={(job.screeningQuestions as ScreeningQuestion[] | null) ?? []}
      />
    </div>
  );
}

export interface ScreeningQuestion {
  prompt: string;
  type: 'yes_no' | 'short_text' | 'multi_select';
  options?: string[];
  required?: boolean;
}
