import Link from 'next/link';
import type { ReactNode } from 'react';

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-200 bg-white">
        <nav className="mx-auto max-w-5xl px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-semibold text-neutral-900">
            Vaivamm Capital · Careers
          </Link>
          <div className="flex items-center gap-6 text-sm text-neutral-600">
            <Link href="/jobs">Open roles</Link>
            <Link href="/privacy">Privacy</Link>
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-8 text-sm text-neutral-600 flex items-center justify-between">
          <span>© {new Date().getFullYear()} Vaivamm Capital Advisors</span>
          <div className="flex gap-4">
            <Link href="/privacy">Privacy</Link>
            <Link href="/delete-my-data">Delete my data</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
