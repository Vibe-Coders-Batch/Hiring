import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { jobs } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const [job] = await db
    .select({ title: jobs.title })
    .from(jobs)
    .where(eq(jobs.slug, slug))
    .limit(1)
    .catch(() => [] as { title: string }[]);
  return { title: job?.title ?? 'Role' };
}

export default async function JobDetailPage({ params }: Props) {
  const { slug } = await params;
  const [job] = await db.select().from(jobs).where(eq(jobs.slug, slug)).limit(1).catch(() => []);
  if (!job || job.status !== 'open') notFound();

  return (
    <article className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-2 flex items-center gap-2">
        <Badge tone="primary">{job.level.toUpperCase()}</Badge>
        <Badge>{job.type.replace('_', ' ')}</Badge>
      </div>
      <h1 className="text-h1 font-semibold tracking-tight">{job.title}</h1>
      <p className="mt-2 text-neutral-600">
        {job.department} · {job.location.replace('_', ' ')}
      </p>

      <Button asChild size="lg" className="mt-6">
        <Link href={`/apply/${job.id}`}>Apply for this role</Link>
      </Button>

      <div className="prose prose-slate mt-12 max-w-none whitespace-pre-wrap leading-relaxed">
        {job.jdMarkdown}
      </div>

      <div className="mt-12 border-t border-neutral-200 pt-8">
        <Button asChild size="lg">
          <Link href={`/apply/${job.id}`}>Apply now</Link>
        </Button>
      </div>
    </article>
  );
}
