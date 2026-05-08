import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db';
import { audit } from '@/server/db/audit';
import { applications, compBands, jobs, offers } from '@/server/db/schema';
import { draftOfferLetter } from '@/server/services/bedrock';
import { adminProcedure, recruiterProcedure, router } from '../init';

export const offersRouter = router({
  draft: recruiterProcedure
    .input(z.object({ applicationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [app] = await db
        .select({ application: applications, job: jobs })
        .from(applications)
        .innerJoin(jobs, eq(jobs.id, applications.jobId))
        .where(eq(applications.id, input.applicationId))
        .limit(1);
      if (!app) throw new TRPCError({ code: 'NOT_FOUND' });

      const [band] = await db
        .select()
        .from(compBands)
        .where(
          eq(compBands.level, app.job.level),
        )
        .limit(1);
      if (!band || !band.approved) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'No approved comp band for this role/level/location combination (PRD §6.7).',
        });
      }

      const draft = await draftOfferLetter({
        candidateName: '<candidate>',
        roleTitle: app.job.title,
        level: app.job.level,
        location: app.job.location,
        compBand: band,
      });

      const [created] = await db
        .insert(offers)
        .values({
          applicationId: input.applicationId,
          draftPdfS3Key: draft.s3Key,
          status: 'draft',
        })
        .returning();
      if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      await audit({
        actorType: 'agent',
        actorId: ctx.session.userId,
        action: 'offer.draft',
        targetType: 'offer',
        targetId: created.id,
        payload: { compBandId: band.id },
      });
      return created;
    }),

  approve: adminProcedure
    .input(z.object({ offerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(offers)
        .set({ status: 'pending_approval', approvedBy: ctx.session.userId })
        .where(eq(offers.id, input.offerId))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

      await audit({
        actorType: 'human',
        actorId: ctx.session.userId,
        action: 'offer.approve',
        targetType: 'offer',
        targetId: updated.id,
      });
      return updated;
    }),
});
