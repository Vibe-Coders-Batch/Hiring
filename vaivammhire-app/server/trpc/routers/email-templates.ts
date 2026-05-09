import { TRPCError } from '@trpc/server';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db';
import { emailTemplates } from '@/server/db/schema';
import { ensureDefaultOrganization } from '@/lib/org';
import { adminProcedure, recruiterProcedure, router } from '../init';

export const emailTemplatesRouter = router({
  list: recruiterProcedure.query(async () => {
    return db.select().from(emailTemplates).orderBy(asc(emailTemplates.templateKey));
  }),

  upsert: adminProcedure
    .input(
      z.object({
        templateKey: z.string().min(1).max(64),
        name: z.string().min(1).max(200),
        subject: z.string().min(1).max(500),
        bodyHtml: z.string().min(1),
        bodyText: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const org = await ensureDefaultOrganization();

      const [row] = await db
        .insert(emailTemplates)
        .values({
          organizationId: org.id,
          templateKey: input.templateKey,
          name: input.name,
          subject: input.subject,
          bodyHtml: input.bodyHtml,
          bodyText: input.bodyText ?? null,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [emailTemplates.organizationId, emailTemplates.templateKey],
          set: {
            name: input.name,
            subject: input.subject,
            bodyHtml: input.bodyHtml,
            bodyText: input.bodyText ?? null,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!row) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
      return row;
    }),

  delete: adminProcedure.input(z.object({ id: z.string().uuid() })).mutation(async ({ input }) => {
    const [deleted] = await db.delete(emailTemplates).where(eq(emailTemplates.id, input.id)).returning();
    if (!deleted) throw new TRPCError({ code: 'NOT_FOUND' });
    return deleted;
  }),
});
