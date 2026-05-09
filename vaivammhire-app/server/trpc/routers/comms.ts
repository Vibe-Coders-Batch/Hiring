import { TRPCError } from '@trpc/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db';
import { audit } from '@/server/db/audit';
import { applications, candidates, communications, emailTemplates } from '@/server/db/schema';
import { draftCandidateEmail } from '@/server/services/bedrock';
import { sendEmail } from '@/server/services/ses';
import { recruiterProcedure, router } from '../init';

function applyTemplateVars(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

export const commsRouter = router({
  inbox: recruiterProcedure.query(async () => {
    return db.select().from(communications).orderBy(desc(communications.sentAt)).limit(100);
  }),

  /** Send using a stored template key + {{var}} substitution. */
  sendTemplate: recruiterProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        templateKey: z.string().min(1),
        variables: z.record(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const vars = input.variables ?? {};

      const rows = await db
        .select({
          application: applications,
          candidate: candidates,
        })
        .from(applications)
        .innerJoin(candidates, eq(candidates.id, applications.candidateId))
        .where(eq(applications.id, input.applicationId))
        .limit(1);
      const row = rows[0];
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });

      const [tpl] = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.templateKey, input.templateKey))
        .limit(1);

      if (!tpl) throw new TRPCError({ code: 'NOT_FOUND', message: `Template ${input.templateKey} not found` });

      const subject = applyTemplateVars(tpl.subject, vars);
      const bodyHtml = applyTemplateVars(tpl.bodyHtml, vars);
      const bodyText =
        tpl.bodyText != null && tpl.bodyText.length > 0
          ? applyTemplateVars(tpl.bodyText, vars)
          : bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

      let messageId: string | undefined;
      let deliveryStatus: 'sent' | 'failed' = 'sent';
      let errorMessage: string | null = null;

      try {
        const sent = await sendEmail({
          to: row.candidate.email,
          subject,
          body: bodyText,
          htmlBody: bodyHtml,
        });
        messageId = sent.messageId;
      } catch (e) {
        deliveryStatus = 'failed';
        errorMessage = e instanceof Error ? e.message : String(e);
      }

      const [comm] = await db
        .insert(communications)
        .values({
          applicationId: input.applicationId,
          channel: 'email',
          direction: 'outbound',
          subject,
          body: bodyText,
          toEmail: row.candidate.email,
          templateKey: input.templateKey,
          deliveryStatus,
          providerMessageId: messageId ?? null,
          errorMessage,
        })
        .returning();

      await audit({
        actorType: 'human',
        actorId: ctx.session.userId,
        action: 'comm.send_template',
        targetType: 'communication',
        targetId: comm?.id ?? 'unknown',
        payload: { templateKey: input.templateKey, deliveryStatus },
      });

      return comm;
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
      let messageId: string | undefined;
      let deliveryStatus: 'sent' | 'failed' = 'sent';
      let errorMessage: string | null = null;

      if (input.channel === 'email') {
        try {
          const sent = await sendEmail({ to: input.to, subject: input.subject ?? '', body: input.body });
          messageId = sent.messageId;
        } catch (e) {
          deliveryStatus = 'failed';
          errorMessage = e instanceof Error ? e.message : String(e);
        }
      }

      const [row] = await db
        .insert(communications)
        .values({
          applicationId: input.applicationId,
          channel: input.channel,
          direction: 'outbound',
          subject: input.subject ?? null,
          body: input.body,
          toEmail: input.channel === 'email' ? input.to : null,
          deliveryStatus,
          providerMessageId: messageId ?? null,
          errorMessage,
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
