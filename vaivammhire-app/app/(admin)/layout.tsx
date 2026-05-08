import Link from 'next/link';
import type { ReactNode } from 'react';

const NAV = [
  { href: '/admin/dashboard', label: 'Dashboard' },
  { href: '/admin/jobs', label: 'Jobs' },
  { href: '/admin/candidates', label: 'Candidates' },
  { href: '/admin/interviews', label: 'Interviews' },
  { href: '/admin/assessments', label: 'Assessments' },
  { href: '/admin/comp-bands', label: 'Comp bands' },
  { href: '/admin/offers', label: 'Offers' },
  { href: '/admin/communications', label: 'Comms' },
  { href: '/admin/labeling', label: 'Labeling' },
  { href: '/admin/models', label: 'Models' },
  { href: '/admin/agent', label: 'Agent' },
  { href: '/admin/settings', label: 'Settings' },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-60 shrink-0 border-r border-neutral-200 bg-white">
        <div className="px-6 py-5 border-b border-neutral-200">
          <Link href="/admin/dashboard" className="font-semibold">
            VaivammHire
          </Link>
          <p className="text-xs text-neutral-500 mt-0.5">Admin console</p>
        </div>
        <nav className="px-3 py-4 space-y-0.5 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-md px-3 py-2 text-neutral-700 hover:bg-neutral-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
