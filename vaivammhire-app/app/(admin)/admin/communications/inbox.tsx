'use client';

import { trpc } from '@/server/trpc/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function CommunicationsInbox() {
  const q = trpc.comms.inbox.useQuery();

  if (q.isLoading) {
    return <p className="text-sm text-neutral-500">Loading inbox…</p>;
  }

  if (q.error) {
    return (
      <div className="rounded-md border border-error-500 bg-error-50 p-4 text-sm text-error-700">
        Sign in required or insufficient permissions. Use staff login when AUTH_DEV_SECRET is configured.
      </div>
    );
  }

  const list = q.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.map((m) => (
          <div key={m.id} className="rounded-md border border-neutral-200 p-3 text-sm">
            <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
              <div className="flex flex-wrap gap-2">
                <Badge tone="primary">{m.channel}</Badge>
                <Badge tone={m.direction === 'outbound' ? 'neutral' : 'info'}>{m.direction}</Badge>
                {m.deliveryStatus && (
                  <Badge tone={m.deliveryStatus === 'sent' ? 'success' : 'warning'}>{m.deliveryStatus}</Badge>
                )}
              </div>
              <span>{new Date(m.sentAt).toLocaleString('en-IN')}</span>
            </div>
            {m.toEmail && <p className="text-xs text-neutral-500">To: {m.toEmail}</p>}
            {m.subject && <p className="font-medium">{m.subject}</p>}
            <p className="whitespace-pre-line text-neutral-700">{m.body}</p>
            {m.errorMessage && <p className="text-xs text-error-600 mt-1">{m.errorMessage}</p>}
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-neutral-500">Inbox is empty.</p>}
      </CardContent>
    </Card>
  );
}
