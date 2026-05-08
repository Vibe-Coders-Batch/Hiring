'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function DeleteMyDataPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch('/api/dpdp/delete-request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('Request failed');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-h2 font-semibold">Delete my data</h1>
      <p className="mt-3 text-neutral-600">
        Per India's DPDP Act, you can request deletion of your data at any time. We'll send a verification link to your
        email. Once verified, we cascade delete your resume, parsed data, and communications. An anonymised audit log
        is kept for 12 months for legal defence.
      </p>

      {submitted ? (
        <div className="mt-6 rounded-[var(--radius-card)] border border-success-500 bg-success-50 p-4 text-success-700">
          Verification link sent. Check your email to confirm deletion.
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email used in your application</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-error-700">
              {error}
            </p>
          )}
          <Button type="submit" size="lg">
            Send verification link
          </Button>
        </form>
      )}
    </div>
  );
}
