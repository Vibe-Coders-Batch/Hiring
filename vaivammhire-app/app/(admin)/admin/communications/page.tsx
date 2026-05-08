import { db } from '@/server/db';
import { communications } from '@/server/db/schema';
import { desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata = { title: 'Communications' };

export default async function CommunicationsPage() {
  const list = await db
    .select()
    .from(communications)
    .orderBy(desc(communications.sentAt))
    .limit(100)
    .catch(() => []);

  return (
    <div>
      <h1 className="text-h2 font-semibold mb-1">Communications hub</h1>
      <p className="text-neutral-600 mb-8">
        Email, WhatsApp, and LinkedIn DMs in one inbox. Outbound messages are AI-drafted, HR-approved.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Recent</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {list.map((m) => (
            <div key={m.id} className="rounded-md border border-neutral-200 p-3 text-sm">
              <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
                <div className="flex gap-2">
                  <Badge tone="primary">{m.channel}</Badge>
                  <Badge tone={m.direction === 'outbound' ? 'neutral' : 'info'}>{m.direction}</Badge>
                </div>
                <span>{new Date(m.sentAt).toLocaleString('en-IN')}</span>
              </div>
              {m.subject && <p className="font-medium">{m.subject}</p>}
              <p className="whitespace-pre-line text-neutral-700">{m.body}</p>
            </div>
          ))}
          {list.length === 0 && <p className="text-sm text-neutral-500">Inbox is empty.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
