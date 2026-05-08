import { db } from '@/server/db';
import { compBands } from '@/server/db/schema';
import { desc } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Comp bands' };

export default async function CompBandsPage() {
  const bands = await db.select().from(compBands).orderBy(desc(compBands.createdAt)).catch(() => []);

  return (
    <div>
      <h1 className="text-h2 font-semibold mb-1">Compensation bands</h1>
      <p className="text-neutral-600 mb-8">
        Auto-offers only fire for combinations marked Approved (PRD §6.7).
      </p>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-left text-neutral-600">
              <tr>
                <th className="px-4 py-3">Family</th>
                <th className="px-4 py-3">Level</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Fixed (min–max)</th>
                <th className="px-4 py-3">Variable</th>
                <th className="px-4 py-3">ESOPs</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {bands.map((b) => (
                <tr key={b.id} className="border-b border-neutral-100">
                  <td className="px-4 py-3">{b.roleFamily.replace('_', ' ')}</td>
                  <td className="px-4 py-3">{b.level.toUpperCase()}</td>
                  <td className="px-4 py-3">{b.location.replace('_', ' ')}</td>
                  <td className="px-4 py-3">
                    {b.fixedMin.toLocaleString('en-IN')}–{b.fixedMax.toLocaleString('en-IN')}
                  </td>
                  <td className="px-4 py-3">{b.variablePct}%</td>
                  <td className="px-4 py-3">{b.esopsInr.toLocaleString('en-IN')}</td>
                  <td className="px-4 py-3">
                    <Badge tone={b.approved ? 'success' : 'warning'}>{b.approved ? 'approved' : 'draft'}</Badge>
                  </td>
                </tr>
              ))}
              {bands.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-neutral-500">
                    No bands yet. Founder approval required to enable auto-offers.
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
