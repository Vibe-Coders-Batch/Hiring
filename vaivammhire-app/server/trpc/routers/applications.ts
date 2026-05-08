import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db';
import { audit, captureTrainingLabel } from '@/server/db/audit';
import { applications, candidates, jobs } from '@/server/db/schema';
import { recruiterProcedure, router } from '../init';

export const applicationStageEnum = z.enum([
  'applied',
  'ai_screened',
  'hr_review',
  'shortlisted',
  'interview_1',
  'assignment',
  'interview_2',
  'interview_3',
  'reference_check',
  'offer',
  'hired',
  'rejected',
  'on_hold',
]);

export const applicationsRouter = router({
  // Pipeline view for a single job (kanban backing query).
  byJob: recruiterProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db
        .select({
          application: applications,
          candidate: {
            id: candidates.id,
            name: candidates.name,
            email: candidates.email,
          },
        })
        .from(applications)
        .innerJoin(candidates, eq(candidates.id, applications.candidateId))
        .where(eq(applications.jobId, input.jobId));
    }),

  getById: recruiterProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db
        .select({
          application: applications,
          candidate: candidates,
          job: jobs,
        })
        .from(applications)
        .innerJoin(candidates, eq(candidates.id, applications.candidateId))
        .innerJoin(jobs, eq(jobs.id, applications.jobId))
        .where(eq(applications.id, input.id))
        .limit(1);
      const row = rows[0];
      if (!row) throw new TRPCError({ code: 'NOT_FOUND' });
      return row;
    }),

  // HR override — promote/reject. Captures a training label per PRD §7.3.
  override: recruiterProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        decision: z.enum(['promote', 'reject']),
        reason: z.string().optional(),
        targetStage: applicationStageEnum.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [app] = await db
        .select()
        .from(applications)
        .where(eq(applications.id, input.applicationId))
        .limit(1);
      if (!app) throw new TRPCError({ code: 'NOT_FOUND' });

      const newStage =
        input.targetStage ?? (input.decision === 'promote' ? 'shortlisted' : 'rejected');

      const [updated] = await db
        .update(applications)
        .set({
          stage: newStage,
          hrOverride: {
            decision: input.decision,
            reason: input.reason ?? null,
            by: ctx.session.userId,
            at: new Date().toISOString(),
            previousStage: app.stage,
          } as never,
          lastActionAt: new Date(),
        })
        .where(eq(applications.id, input.applicationId))
        .returning();
      if (!updated) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      await audit({
        actorType: 'human',
        actorId: ctx.session.userId,
        action: 'application.override',
        targetType: 'application',
        targetId: updated.id,
        payload: { decision: input.decision, reason: input.reason ?? null, newStage },
      });

      // Every override is a training label (PRD §7.3, §1.2).
      await captureTrainingLabel({
        modelTarget: 'M2',
        inputRef: { applicationId: updated.id, jobId: updated.jobId, candidateId: updated.candidateId },
        label: { decision: input.decision === 'promote' ? 'shortlist' : 'reject', reason: input.reason ?? null },
        source: 'hr_override',
        labelerId: ctx.session.userId,
        aiPrediction: (app.scoreCard as Record<string, unknown> | null) ?? undefined,
      });

      return updated;
    }),

  moveStage: recruiterProcedure
    .input(z.object({ applicationId: z.string().uuid(), stage: applicationStageEnum }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(applications)
        .set({ stage: input.stage, lastActionAt: new Date() })
        .where(eq(applications.id, input.applicationId))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

      await audit({
        actorType: 'human',
        actorId: ctx.session.userId,
        action: 'application.move_stage',
        targetType: 'application',
        targetId: updated.id,
        payload: { newStage: input.stage },
      });
      return updated;
    }),
});
