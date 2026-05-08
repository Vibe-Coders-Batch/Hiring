import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db';
import { audit } from '@/server/db/audit';
import { interviews } from '@/server/db/schema';
import { proposeInterviewSlots } from '@/server/services/scheduling';
import { recruiterProcedure, router } from '../init';

export const interviewsRouter = router({
  proposeSlots: recruiterProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        panelEmails: z.array(z.string().email()).min(1).max(5),
        durationMinutes: z.number().int().min(15).max(120).default(45),
      }),
    )
    .mutation(async ({ input }) => proposeInterviewSlots(input)),

  schedule: recruiterProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        panelIds: z.array(z.string()).min(1),
        scheduledAt: z.coerce.date(),
        type: z.enum(['phone', 'video', 'onsite', 'ai_audio', 'ai_video']),
        meetLink: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [iv] = await db
        .insert(interviews)
        .values({
          applicationId: input.applicationId,
          panelIds: input.panelIds,
          scheduledAt: input.scheduledAt,
          type: input.type,
          meetLink: input.meetLink ?? null,
        })
        .returning();
      if (!iv) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      await audit({
        actorType: 'human',
        actorId: ctx.session.userId,
        action: 'interview.schedule',
        targetType: 'interview',
        targetId: iv.id,
        payload: { applicationId: input.applicationId, scheduledAt: iv.scheduledAt },
      });
      return iv;
    }),

  feedback: recruiterProcedure
    .input(
      z.object({
        interviewId: z.string().uuid(),
        rubric: z.object({
          skills: z.number().int().min(1).max(5),
          communication: z.number().int().min(1).max(5),
          domain: z.number().int().min(1).max(5),
          culture: z.number().int().min(1).max(5),
          recommendation: z.enum(['strong_yes', 'yes', 'no', 'strong_no']),
        }),
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(interviews)
        .set({
          status: 'completed',
          feedback: { rubric: input.rubric, notes: input.notes ?? null, by: ctx.session.userId } as never,
        })
        .where(eq(interviews.id, input.interviewId))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

      await audit({
        actorType: 'human',
        actorId: ctx.session.userId,
        action: 'interview.feedback',
        targetType: 'interview',
        targetId: updated.id,
        payload: input.rubric,
      });
      return updated;
    }),
});
