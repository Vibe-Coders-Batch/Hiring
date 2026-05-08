import { db } from '@/server/db';
import { trainingLabels } from '@/server/db/schema';
import { count, desc, eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Labeling' };

export default async function LabelingPage() {
  const counts = await Promise.all(
    (['M1', 'M2', 'M3', 'M4', 'M5'] as const).map(async (m) => {
      const [r] = await db
        .select({ value: count() })
        .from(trainingLabels)
        .where(eq(trainingLabels.modelTarget, m))
        .catch(() => [{ value: 0 }]);
      return { model: m, count: r?.value ?? 0 };
    }),
  );

  const recent = await db.select().from(trainingLabels).orderBy(desc(trainingLabels.createdAt)).limit(10).catch(() => []);

  return (
    <div>
      <h1 className="text-h2 font-semibold mb-1">Labeling workbench</h1>
      <p className="text-neutral-600 mb-8">
        Every HR override becomes a labeled training example (PRD §7.3). Counts below are the dataset growing in real time.
      </p>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5 mb-8">
        {counts.map((c) => (
          <Card key={c.model}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-neutral-600">
                {c.model} labels
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{c.count.toLocaleString()}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent labels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recent.map((l) => (
            <div key={l.id} className="flex items-center justify-between text-sm">
              <span className="font-mono text-xs text-neutral-500">{l.id.slice(0, 8)}</span>
              <Badge>{l.modelTarget}</Badge>
              <span>{l.source.replace('_', ' ')}</span>
              <span className="text-neutral-500">{new Date(l.createdAt).toLocaleString('en-IN')}</span>
            </div>
          ))}
          {recent.length === 0 && <p className="text-sm text-neutral-500">No labels yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
