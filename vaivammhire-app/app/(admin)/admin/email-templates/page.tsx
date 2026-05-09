'use client';

import { useState } from 'react';
import { trpc } from '@/server/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function EmailTemplatesPage() {
  const list = trpc.emailTemplates.list.useQuery();
  const upsert = trpc.emailTemplates.upsert.useMutation({
    onSuccess: () => list.refetch(),
  });

  const [templateKey, setTemplateKey] = useState('custom_note');
  const [name, setName] = useState('Custom note');
  const [subject, setSubject] = useState('Note from Vaivamm — {{job_title}}');
  const [bodyHtml, setBodyHtml] = useState('<p>Hi {{candidate_name}},</p><p>{{body}}</p>');

  return (
    <div>
      <h1 className="text-h2 font-semibold mb-1">Email templates</h1>
      <p className="text-neutral-600 mb-8">
        Keys <code className="text-xs bg-neutral-100 px-1 rounded">rejection</code>,{' '}
        <code className="text-xs bg-neutral-100 px-1 rounded">interview_invite</code>,{' '}
        <code className="text-xs bg-neutral-100 px-1 rounded">offer</code> are seeded for SES sends via{' '}
        <code className="text-xs bg-neutral-100 px-1 rounded">comms.sendTemplate</code>. Use{' '}
        <code className="text-xs bg-neutral-100 px-1 rounded">{'{{variable}}'}</code> placeholders.
      </p>

      {list.isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {list.error && (
        <p className="text-sm text-error-700">Admin sign-in required to manage templates.</p>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-[var(--radius-card)] border border-neutral-200 p-4">
          <h2 className="text-h4 font-semibold mb-3">Existing</h2>
          <ul className="space-y-2 text-sm">
            {(list.data ?? []).map((t) => (
              <li key={t.id} className="border-b border-neutral-100 pb-2">
                <span className="font-medium">{t.templateKey}</span> — {t.name}
              </li>
            ))}
            {(list.data ?? []).length === 0 && !list.isLoading && (
              <li className="text-neutral-500">No templates yet — seed the database.</li>
            )}
          </ul>
        </div>

        <div className="rounded-[var(--radius-card)] border border-neutral-200 p-4 space-y-3">
          <h2 className="text-h4 font-semibold mb-1">Upsert (admin)</h2>
          <div className="space-y-2">
            <Label htmlFor="tk">Template key</Label>
            <Input id="tk" value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nm">Display name</Label>
            <Input id="nm" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sub">Subject</Label>
            <Input id="sub" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="html">Body HTML</Label>
            <textarea
              id="html"
              className="flex min-h-[140px] w-full rounded-[var(--radius-input)] border border-neutral-200 p-3 text-sm font-mono"
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
            />
          </div>
          <Button
            type="button"
            disabled={upsert.isPending}
            onClick={() =>
              upsert.mutate({
                templateKey,
                name,
                subject,
                bodyHtml,
              })
            }
          >
            {upsert.isPending ? 'Saving…' : 'Save template'}
          </Button>
          {upsert.error && <p className="text-sm text-error-700">{upsert.error.message}</p>}
        </div>
      </div>
    </div>
  );
}
