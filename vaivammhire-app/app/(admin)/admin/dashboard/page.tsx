import { db } from '@/server/db';
import { applications, candidates, jobs, modelRuns, trainingLabels } from '@/server/db/schema';
import { count, eq, gte, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Dashboard' };

async function safeCount(query: () => Promise<{ value: number }[]>): Promise<number> {
  return query()
    .then((r) => r[0]?.value ?? 0)
    .catch(() => 0);
}

export default async function AdminDashboard() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [openJobs, candidatesInPipeline, hiresLast7Days, labelsTotal, prodModels] = await Promise.all([
    safeCount(() => db.select({ value: count() }).from(jobs).where(eq(jobs.status, 'open'))),
    safeCount(() =>
      db
        .select({ value: count() })
        .from(applications)
        .where(sql`${applications.stage} not in ('hired', 'rejected', 'on_hold')`),
    ),
    safeCount(() =>
      db
        .select({ value: count() })
        .from(applications)
        .where(sql`${applications.stage} = 'hired' and ${applications.lastActionAt} >= ${sevenDaysAgo}`),
    ),
    safeCount(() => db.select({ value: count() }).from(trainingLabels)),
    safeCount(() => db.select({ value: count() }).from(modelRuns).where(eq(modelRuns.status, 'prod'))),
  ]);

  const totalCandidates = await safeCount(() => db.select({ value: count() }).from(candidates));

  const kpis: Array<{ label: string; value: number; help?: string }> = [
    { label: 'Open roles', value: openJobs },
    { label: 'In pipeline', value: candidatesInPipeline, help: 'Excludes hired / rejected / on-hold.' },
    { label: 'Hires (7d)', value: hiresLast7Days },
    { label: 'Total candidates', value: totalCandidates },
    { label: 'Training labels', value: labelsTotal, help: 'Capture rate is the leading indicator for Track B.' },
    { label: 'Prod models', value: prodModels, help: 'Custom models passing the promotion gate (PRD §7.7).' },
  ];

  return (
    <div>
      <h1 className="text-h2 font-semibold mb-1">Dashboard</h1>
      <p className="text-neutral-600 mb-8">A snapshot of hiring activity and Track B model health.</p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-neutral-600">{k.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">{k.value.toLocaleString()}</p>
              {k.help && <p className="text-xs text-neutral-500 mt-2">{k.help}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
