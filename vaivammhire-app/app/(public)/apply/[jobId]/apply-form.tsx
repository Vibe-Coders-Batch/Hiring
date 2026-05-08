'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ScreeningQuestion } from './page';

interface Props {
  jobId: string;
  screeningQuestions: ScreeningQuestion[];
}

const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export function ApplyForm({ jobId, screeningQuestions }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="mt-8 rounded-[var(--radius-card)] border border-success-500 bg-success-50 p-6">
        <h2 className="text-h3 font-semibold text-success-700">Application received</h2>
        <p className="mt-2 text-sm text-success-700">
          We've sent a tracking link to your email. Reviews are AI-assisted; a human at Vaivamm has the final say.
        </p>
      </div>
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData(e.currentTarget);
      const file = form.get('resume');
      if (!(file instanceof File) || file.size === 0) {
        throw new Error('Please attach your resume.');
      }
      if (file.size > MAX_RESUME_BYTES) {
        throw new Error('Resume must be 5 MB or smaller.');
      }
      if (!form.get('consent_dpdp')) {
        throw new Error('DPDP consent is required.');
      }

      const res = await fetch('/api/applications/submit', {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || 'Submission failed');
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-6">
      <input type="hidden" name="jobId" value={jobId} />

      <div className="space-y-2">
        <Label htmlFor="name">Full name</Label>
        <Input id="name" name="name" required minLength={2} maxLength={200} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" inputMode="tel" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="linkedin">LinkedIn (optional)</Label>
        <Input id="linkedin" name="linkedin" type="url" placeholder="https://linkedin.com/in/..." />
      </div>

      <div className="space-y-2">
        <Label htmlFor="resume">Resume (PDF or DOCX, ≤ 5 MB)</Label>
        <input
          id="resume"
          name="resume"
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
          className="block w-full text-sm"
        />
      </div>

      {screeningQuestions.length > 0 && (
        <div className="space-y-4 rounded-[var(--radius-card)] border border-neutral-200 p-4">
          <h2 className="text-h4 font-semibold">A few questions</h2>
          {screeningQuestions.map((q, i) => (
            <div key={i} className="space-y-2">
              <Label htmlFor={`sq_${i}`}>{q.prompt}</Label>
              {q.type === 'yes_no' ? (
                <select
                  id={`sq_${i}`}
                  name={`screening[${i}]`}
                  required={q.required ?? true}
                  className="block h-10 w-full rounded-[var(--radius-input)] border border-neutral-200 px-3"
                >
                  <option value="">Select…</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              ) : q.type === 'multi_select' && q.options ? (
                <select
                  id={`sq_${i}`}
                  name={`screening[${i}]`}
                  multiple
                  required={q.required ?? true}
                  className="block w-full rounded-[var(--radius-input)] border border-neutral-200 p-2"
                >
                  {q.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <Input id={`sq_${i}`} name={`screening[${i}]`} required={q.required ?? true} />
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-neutral-200 p-4">
        <input id="consent_dpdp" name="consent_dpdp" type="checkbox" required className="mt-1" />
        <label htmlFor="consent_dpdp" className="text-sm text-neutral-700">
          I consent to Vaivamm Capital processing this data for recruitment purposes, including AI-based screening,
          and to use of anonymised data for model training. (PRD §12.1)
        </label>
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="rounded-[var(--radius-card)] border border-error-500 bg-error-50 p-3 text-sm text-error-700">
          {error}
        </div>
      )}

      <Button type="submit" size="lg" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit application'}
      </Button>
    </form>
  );
}
