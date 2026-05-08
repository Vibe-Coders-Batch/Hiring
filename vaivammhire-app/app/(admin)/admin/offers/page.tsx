import { db } from '@/server/db';
import { offers } from '@/server/db/schema';
import { desc } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Offers' };

const TONE = {
  draft: 'neutral',
  pending_approval: 'warning',
  sent: 'primary',
  viewed: 'primary',
  signed: 'success',
  declined: 'error',
  expired: 'neutral',
} as const;

export default async function OffersPage() {
  const list = await db.select().from(offers).orderBy(desc(offers.createdAt)).catch(() => []);
  return (
    <div>
      <h1 className="text-h2 font-semibold mb-1">Offers</h1>
      <p className="text-neutral-600 mb-8">Drafted by AI, approved by humans, signed via Documenso.</p>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-left text-neutral-600">
              <tr>
                <th className="px-4 py-3">Application</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Signed</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id} className="border-b border-neutral-100">
                  <td className="px-4 py-3 font-mono text-xs">{o.applicationId}</td>
                  <td className="px-4 py-3">
                    <Badge tone={TONE[o.status]}>{o.status.replace('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{new Date(o.createdAt).toLocaleDateString('en-IN')}</td>
                  <td className="px-4 py-3 text-neutral-600">
                    {o.signedAt ? new Date(o.signedAt).toLocaleDateString('en-IN') : '—'}
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                    No offers yet.
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
