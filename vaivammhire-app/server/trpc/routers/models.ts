import { TRPCError } from '@trpc/server';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db';
import { audit } from '@/server/db/audit';
import { modelRuns } from '@/server/db/schema';
import { evaluatePromotionGate } from '@/server/services/promotion-gate';
import { adminProcedure, recruiterProcedure, router } from '../init';

export const modelsRouter = router({
  list: recruiterProcedure.query(async () => {
    return db.select().from(modelRuns).orderBy(desc(modelRuns.trainedAt)).limit(50);
  }),

  evaluateGate: adminProcedure
    .input(z.object({ modelRunId: z.string().uuid() }))
    .mutation(async ({ input }) => evaluatePromotionGate(input.modelRunId)),

  promote: adminProcedure
    .input(z.object({ modelRunId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const gate = await evaluatePromotionGate(input.modelRunId);
      if (!gate.passes) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: `Promotion gate failed: ${gate.reasons.join('; ')}`,
        });
      }
      const [updated] = await db
        .update(modelRuns)
        .set({ status: 'prod', promotedAt: new Date(), promotedBy: ctx.session.userId })
        .where(eq(modelRuns.id, input.modelRunId))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

      await audit({
        actorType: 'human',
        actorId: ctx.session.userId,
        action: 'model.promote',
        targetType: 'model_run',
        targetId: updated.id,
        payload: { metrics: gate.metrics },
      });
      return updated;
    }),
});
