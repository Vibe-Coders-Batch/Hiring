'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const fd = new FormData(e.currentTarget);
      const secret = String(fd.get('secret') ?? '');
      const email = String(fd.get('email') ?? '');
      const name = String(fd.get('name') ?? '');
      const role = String(fd.get('role') ?? 'recruiter');

      const res = await fetch('/api/auth/dev-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret, email, name, role }),
        credentials: 'include',
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? 'Login failed');
      }

      router.push('/admin/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md py-16">
      <h1 className="text-h2 font-semibold mb-1">Staff sign-in</h1>
      <p className="text-sm text-neutral-600 mb-8">
        Dev auth uses <code className="text-xs bg-neutral-100 px-1 rounded">AUTH_DEV_SECRET</code>. Configure
        Cognito in production and leave dev secret unset.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="secret">Dev secret</Label>
          <Input id="secret" name="secret" type="password" autoComplete="off" required minLength={8} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" name="email" type="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Display name</Label>
          <Input id="name" name="name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <select
            id="role"
            name="role"
            className="flex h-10 w-full rounded-[var(--radius-input)] border border-neutral-200 bg-white px-3 text-sm"
            defaultValue="recruiter"
          >
            <option value="admin">Admin</option>
            <option value="recruiter">Recruiter</option>
            <option value="hiring_manager">Hiring manager</option>
            <option value="interviewer">Interviewer</option>
            <option value="ml_engineer">ML engineer</option>
          </select>
        </div>

        {error && (
          <div className="rounded-md border border-error-500 bg-error-50 p-3 text-sm text-error-700" role="alert">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" disabled={loading}>
          {loading ? 'Signing in…' : 'Continue'}
        </Button>
      </form>
    </div>
  );
}
