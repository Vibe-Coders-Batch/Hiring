import { db } from '@/server/db';
import { modelRuns } from '@/server/db/schema';
import { desc } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Models' };

const TONE = {
  training: 'neutral',
  staging: 'warning',
  prod: 'success',
  archived: 'neutral',
} as const;

export default async function ModelsPage() {
  const runs = await db.select().from(modelRuns).orderBy(desc(modelRuns.trainedAt)).limit(50).catch(() => []);
  return (
    <div>
      <h1 className="text-h2 font-semibold mb-1">Model registry</h1>
      <p className="text-neutral-600 mb-8">
        Each row is a SageMaker training run. Promotion to prod requires the gate in PRD §7.7 to pass.
      </p>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-left text-neutral-600">
              <tr>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Trained</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Promoted</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-neutral-100">
                  <td className="px-4 py-3 font-medium">{r.modelName}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.version}</td>
                  <td className="px-4 py-3">{new Date(r.trainedAt).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <Badge tone={TONE[r.status]}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">
                    {r.promotedAt ? new Date(r.promotedAt).toLocaleDateString('en-IN') : '—'}
                  </td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                    No model runs yet. Nightly SageMaker pipeline kicks off when training_labels grows by 50.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
