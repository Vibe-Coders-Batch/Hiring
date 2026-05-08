import { db } from '@/server/db';
import { interviews } from '@/server/db/schema';
import { desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Interviews' };

export default async function InterviewsPage() {
  const list = await db.select().from(interviews).orderBy(desc(interviews.scheduledAt)).limit(50).catch(() => []);

  return (
    <div>
      <h1 className="text-h2 font-semibold mb-1">Interviews</h1>
      <p className="text-neutral-600 mb-8">Upcoming and recent. Calendar view ships in Phase 2.</p>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {list.map((iv) => (
            <div key={iv.id} className="flex items-center justify-between rounded-md border border-neutral-200 p-3">
              <div>
                <p className="text-sm font-medium">
                  {iv.type.replace('_', ' ')} · {new Date(iv.scheduledAt).toLocaleString('en-IN')}
                </p>
                <p className="text-xs text-neutral-500">Application: {iv.applicationId}</p>
              </div>
              <Badge tone={iv.status === 'scheduled' ? 'primary' : iv.status === 'completed' ? 'success' : 'warning'}>
                {iv.status}
              </Badge>
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-neutral-500">Nothing scheduled.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
