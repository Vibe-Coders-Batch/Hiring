import { db } from '@/server/db';
import { assessments } from '@/server/db/schema';
import { desc } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = { title: 'Assessments' };

export default async function AssessmentsPage() {
  const templates = await db.select().from(assessments).orderBy(desc(assessments.createdAt)).catch(() => []);

  return (
    <div>
      <h1 className="text-h2 font-semibold mb-1">Assessments</h1>
      <p className="text-neutral-600 mb-8">MCQ, coding, and case-study templates. Auto-sent at the assignment stage.</p>

      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className="rounded-md border border-neutral-200 p-3 text-sm">
              <p className="font-medium">{t.type.replace('_', ' ').toUpperCase()}</p>
              <p className="text-xs text-neutral-500 mt-1">Created {new Date(t.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
          {templates.length === 0 && <p className="text-sm text-neutral-500">No templates yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
