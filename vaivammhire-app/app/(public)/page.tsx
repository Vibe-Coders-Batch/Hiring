import Link from 'next/link';
import { db } from '@/server/db';
import { jobs } from '@/server/db/schema';
import { desc, eq } from 'drizzle-orm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function LandingPage() {
  const featured = await db
    .select({ id: jobs.id, slug: jobs.slug, title: jobs.title, department: jobs.department, location: jobs.location })
    .from(jobs)
    .where(eq(jobs.status, 'open'))
    .orderBy(desc(jobs.createdAt))
    .limit(6)
    .catch(() => []);

  return (
    <div>
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h1 className="text-h1 font-semibold tracking-tight">Build with Vaivamm Capital.</h1>
        <p className="mt-4 max-w-2xl text-lg text-neutral-600">
          We're a wealth-management firm building a high-bar team across Hyderabad, Remote India, and the UAE.
          Browse open roles below.
        </p>
        <div className="mt-8 flex gap-3">
          <Button asChild size="lg">
            <Link href="/jobs">View open roles</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/privacy">How we use your data</Link>
          </Button>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="mx-auto max-w-5xl px-6 py-12">
          <h2 className="text-h2 font-semibold mb-6">Featured roles</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((job) => (
              <Link key={job.id} href={`/jobs/${job.slug}`}>
                <Card className="h-full hover:shadow-[var(--shadow-md)] transition-shadow">
                  <CardHeader>
                    <CardTitle>{job.title}</CardTitle>
                    <CardDescription>
                      {job.department} · {job.location.replace('_', ' ')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <span className="text-sm text-primary-600">View role →</span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
