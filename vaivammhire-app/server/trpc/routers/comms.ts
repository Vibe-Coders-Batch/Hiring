import { desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db';
import { audit } from '@/server/db/audit';
import { communications } from '@/server/db/schema';
import { draftCandidateEmail } from '@/server/services/bedrock';
import { sendEmail } from '@/server/services/ses';
import { recruiterProcedure, router } from '../init';

export const commsRouter = router({
  inbox: recruiterProcedure.query(async () => {
    return db.select().from(communications).orderBy(desc(communications.sentAt)).limit(100);
  }),

  draftEmail: recruiterProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        intent: z.enum(['acknowledgement', 'screening_result', 'scheduling', 'rejection', 'offer']),
        toneNotes: z.string().optional(),
      }),
    )
    .mutation(({ input }) => draftCandidateEmail(input)),

  send: recruiterProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        channel: z.enum(['email', 'whatsapp', 'sms']),
        to: z.string(),
        subject: z.string().optional(),
        body: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.channel === 'email') {
        await sendEmail({ to: input.to, subject: input.subject ?? '', body: input.body });
      }
      const [row] = await db
        .insert(communications)
        .values({
          applicationId: input.applicationId,
          channel: input.channel,
          direction: 'outbound',
          subject: input.subject ?? null,
          body: input.body,
        })
        .returning();
      await audit({
        actorType: 'human',
        actorId: ctx.session.userId,
        action: 'comm.send',
        targetType: 'communication',
        targetId: row?.id ?? 'unknown',
        payload: { channel: input.channel },
      });
      return row;
    }),
});
