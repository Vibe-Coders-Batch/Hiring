import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db';
import { captureTrainingLabel } from '@/server/db/audit';
import { trainingLabels } from '@/server/db/schema';
import { recruiterProcedure, router } from '../init';

export const labelingRouter = router({
  // Active queue: lowest-confidence applications waiting for HR review.
  // Stub: real implementation joins applications + scoreCard + filters by confidence.
  activeQueue: recruiterProcedure.query(async () => {
    return db
      .select()
      .from(trainingLabels)
      .orderBy(desc(trainingLabels.createdAt))
      .limit(20);
  }),

  byTarget: recruiterProcedure
    .input(z.object({ modelTarget: z.enum(['M1', 'M2', 'M3', 'M4', 'M5']), limit: z.number().min(1).max(200).default(50) }))
    .query(async ({ input }) =>
      db
        .select()
        .from(trainingLabels)
        .where(eq(trainingLabels.modelTarget, input.modelTarget))
        .orderBy(desc(trainingLabels.createdAt))
        .limit(input.limit),
    ),

  // Bulk CSV upload (PRD §7.4) — accepts an array of (resume_id, decision) pairs.
  bulkUpload: recruiterProcedure
    .input(
      z.object({
        modelTarget: z.enum(['M1', 'M2', 'M3', 'M4', 'M5']),
        rows: z
          .array(
            z.object({
              inputRef: z.record(z.unknown()),
              label: z.record(z.unknown()),
            }),
          )
          .max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      for (const r of input.rows) {
        await captureTrainingLabel({
          modelTarget: input.modelTarget,
          inputRef: r.inputRef,
          label: r.label,
          source: 'hr_explicit',
          labelerId: ctx.session.userId,
        });
      }
      return { inserted: input.rows.length };
    }),
});
