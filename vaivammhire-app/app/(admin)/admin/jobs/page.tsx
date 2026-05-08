import Link from 'next/link';
import { db } from '@/server/db';
import { jobs } from '@/server/db/schema';
import { desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export const metadata = { title: 'Jobs' };

const STATUS_TONES = {
  draft: 'neutral',
  open: 'success',
  paused: 'warning',
  closed: 'neutral',
} as const;

export default async function AdminJobsPage() {
  const allJobs = await db.select().from(jobs).orderBy(desc(jobs.createdAt)).catch(() => []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-h2 font-semibold">Jobs</h1>
          <p className="text-neutral-600">Create, publish, share, and run the pipeline per role.</p>
        </div>
        <Button asChild>
          <Link href="/admin/jobs/new">New job</Link>
        </Button>
      </div>

      <div className="grid gap-4">
        {allJobs.map((job) => (
          <Card key={job.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>
                    <Link href={`/admin/jobs/${job.id}/pipeline`} className="hover:text-primary-600">
                      {job.title}
                    </Link>
                  </CardTitle>
                  <p className="text-sm text-neutral-600 mt-1">
                    {job.department} · {job.level.toUpperCase()} · {job.location.replace('_', ' ')}
                  </p>
                </div>
                <Badge tone={STATUS_TONES[job.status]}>{job.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm">
                <Link href={`/admin/jobs/${job.id}/pipeline`} className="text-primary-600 hover:underline">
                  Pipeline
                </Link>
                <span className="text-neutral-300">·</span>
                <Link href={`/admin/jobs/${job.id}/share`} className="text-primary-600 hover:underline">
                  Share link
                </Link>
                <span className="text-neutral-300">·</span>
                <span className="text-neutral-500">
                  Auto-shortlist threshold: {job.autoShortlistThreshold}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
        {allJobs.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-neutral-600">
              No jobs yet. <Link href="/admin/jobs/new" className="text-primary-600">Create the first one.</Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
