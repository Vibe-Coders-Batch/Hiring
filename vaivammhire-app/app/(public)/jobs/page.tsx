import Link from 'next/link';
import { db } from '@/server/db';
import { jobs } from '@/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Open roles' };

export default async function JobsListPage() {
  const openJobs = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, 'open'))
    .orderBy(desc(jobs.createdAt));

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-h1 font-semibold mb-2">Open roles</h1>
      <p className="text-neutral-600 mb-8">
        {openJobs.length} {openJobs.length === 1 ? 'role' : 'roles'} hiring now.
      </p>

      {openJobs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-neutral-600">No open roles right now. Check back soon.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {openJobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.slug}`}>
              <Card className="hover:shadow-[var(--shadow-md)] transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{job.title}</CardTitle>
                      <CardDescription>
                        {job.department} · {job.location.replace('_', ' ')} · {job.type.replace('_', ' ')}
                      </CardDescription>
                    </div>
                    <Badge tone="primary">{job.level.toUpperCase()}</Badge>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
