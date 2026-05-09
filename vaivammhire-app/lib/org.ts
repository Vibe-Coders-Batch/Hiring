import { db } from '@/server/db';
import { organizations } from '@/server/db/schema';

/**
 * Ensures a default tenant row exists (Vaivamm Capital single-org MVP).
 */
export async function ensureDefaultOrganization() {
  const existing = await db.select().from(organizations).limit(1);
  if (existing[0]) return existing[0];

  const [org] = await db
    .insert(organizations)
    .values({
      name: 'Vaivamm Capital',
      slug: 'vaivamm-capital',
    })
    .returning();

  if (!org) throw new Error('Failed to create default organization');
  return org;
}
