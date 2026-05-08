import { notFound } from 'next/navigation';
import { db } from '@/server/db';
import { jobs } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { buildShareLinks } from '@/server/services/share-links';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CopyRow } from './copy-row';

interface Props {
  params: Promise<{ id: string }>;
}

export const metadata = { title: 'Share' };

export default async function ShareJobPage({ params }: Props) {
  const { id } = await params;
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1).catch(() => []);
  if (!job) notFound();

  const links = buildShareLinks(job.slug, job.title);

  return (
    <div className="max-w-2xl">
      <h1 className="text-h2 font-semibold">Share: {job.title}</h1>
      <p className="text-neutral-600 mb-8">
        Use these links on LinkedIn, WhatsApp, in email signatures, or post directly to the Vaivamm Page.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Share links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CopyRow label="Public URL" value={links.url} />
          <CopyRow label="LinkedIn share" value={links.linkedin} />
          <CopyRow label="WhatsApp share" value={links.whatsapp} />
          <CopyRow label="Email signature" value={links.emailSignature} />
        </CardContent>
      </Card>
    </div>
  );
}
