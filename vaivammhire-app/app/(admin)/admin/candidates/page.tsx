import Link from 'next/link';
import { db } from '@/server/db';
import { candidates } from '@/server/db/schema';
import { desc } from 'drizzle-orm';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: 'Candidates' };

export default async function CandidatesPage() {
  const list = await db
    .select()
    .from(candidates)
    .orderBy(desc(candidates.createdAt))
    .limit(100)
    .catch(() => []);

  return (
    <div>
      <h1 className="text-h2 font-semibold mb-1">Candidates</h1>
      <p className="text-neutral-600 mb-8">Latest 100 applicants across all roles.</p>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 text-left text-neutral-600">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Applied</th>
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-b border-neutral-100">
                  <td className="px-4 py-3">
                    <Link href={`/admin/candidates/${c.id}`} className="text-primary-600 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-600">{c.email}</td>
                  <td className="px-4 py-3 text-neutral-600">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-neutral-500">
                    {new Date(c.createdAt).toLocaleDateString('en-IN')}
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-neutral-500">
                    No candidates yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
