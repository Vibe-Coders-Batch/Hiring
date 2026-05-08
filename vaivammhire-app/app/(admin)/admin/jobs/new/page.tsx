'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/server/trpc/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function NewJobPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [responsibilities, setResponsibilities] = useState('');
  const [level, setLevel] = useState<'intern' | 'l1' | 'l2' | 'l3' | 'l4' | 'lead' | 'manager'>('l3');
  const [location, setLocation] = useState<'hyderabad' | 'remote_india' | 'uae'>('hyderabad');
  const [jdMarkdown, setJdMarkdown] = useState('');

  const generate = trpc.jobs.generateDescription.useMutation({
    onSuccess: (out) => setJdMarkdown(out.jdMarkdown),
  });

  const create = trpc.jobs.create.useMutation({
    onSuccess: (job) => router.push(`/admin/jobs/${job.id}/pipeline`),
  });

  return (
    <div className="max-w-3xl">
      <h1 className="text-h2 font-semibold mb-1">New job</h1>
      <p className="text-neutral-600 mb-8">Use the AI draft to start, then edit before publishing.</p>

      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate({ title, department, level, location, jdMarkdown });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="title">Role title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dept">Department</Label>
            <Input id="dept" value={department} onChange={(e) => setDepartment(e.target.value)} required />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="level">Level</Label>
            <select
              id="level"
              value={level}
              onChange={(e) => setLevel(e.target.value as typeof level)}
              className="block h-10 w-full rounded-[var(--radius-input)] border border-neutral-200 px-3"
            >
              {['intern', 'l1', 'l2', 'l3', 'l4', 'lead', 'manager'].map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="loc">Location</Label>
            <select
              id="loc"
              value={location}
              onChange={(e) => setLocation(e.target.value as typeof location)}
              className="block h-10 w-full rounded-[var(--radius-input)] border border-neutral-200 px-3"
            >
              <option value="hyderabad">Hyderabad</option>
              <option value="remote_india">Remote (India)</option>
              <option value="uae">UAE</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="resp">Key responsibilities (for AI draft)</Label>
          <textarea
            id="resp"
            value={responsibilities}
            onChange={(e) => setResponsibilities(e.target.value)}
            rows={4}
            className="block w-full rounded-[var(--radius-input)] border border-neutral-200 p-3 text-sm"
          />
          <Button
            type="button"
            variant="secondary"
            disabled={!title || !responsibilities || generate.isPending}
            onClick={() => generate.mutate({ title, responsibilities, level })}
          >
            {generate.isPending ? 'Drafting…' : 'Draft with AI'}
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="jd">Job description (markdown)</Label>
          <textarea
            id="jd"
            value={jdMarkdown}
            onChange={(e) => setJdMarkdown(e.target.value)}
            rows={16}
            required
            className="block w-full rounded-[var(--radius-input)] border border-neutral-200 p-3 font-mono text-sm"
          />
        </div>

        <Button type="submit" size="lg" disabled={create.isPending}>
          {create.isPending ? 'Saving…' : 'Save as draft'}
        </Button>
      </form>
    </div>
  );
}
