import { TRPCError } from '@trpc/server';
import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db';
import { audit } from '@/server/db/audit';
import { jobs } from '@/server/db/schema';
import { generateJobDescription } from '@/server/services/bedrock';
import { buildShareLinks } from '@/server/services/share-links';
import { slugify } from '@/lib/slugify';
import { publicProcedure, recruiterProcedure, router } from '../init';

const screeningQuestionSchema = z.object({
  prompt: z.string().min(3),
  type: z.enum(['yes_no', 'short_text', 'multi_select']),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(true),
});

const hardFiltersSchema = z.object({
  minYearsExperience: z.number().int().min(0).optional(),
  location: z.string().optional(),
  workAuth: z.array(z.string()).optional(),
  mustHaveSkills: z.array(z.string()).optional(),
});

export const jobsRouter = router({
  // Public: list open jobs for the candidate-facing job board.
  listPublic: publicProcedure
    .input(
      z
        .object({
          department: z.string().optional(),
          location: z.string().optional(),
          type: z.enum(['full_time', 'contract', 'intern']).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const conditions = [eq(jobs.status, 'open')];
      if (input?.department) conditions.push(eq(jobs.department, input.department));
      if (input?.type) conditions.push(eq(jobs.type, input.type));

      return db
        .select({
          id: jobs.id,
          slug: jobs.slug,
          title: jobs.title,
          department: jobs.department,
          level: jobs.level,
          location: jobs.location,
          type: jobs.type,
          createdAt: jobs.createdAt,
        })
        .from(jobs)
        .where(and(...conditions))
        .orderBy(desc(jobs.createdAt));
    }),

  getBySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
    const [job] = await db.select().from(jobs).where(eq(jobs.slug, input.slug)).limit(1);
    if (!job || job.status !== 'open') {
      throw new TRPCError({ code: 'NOT_FOUND' });
    }
    return job;
  }),

  // Admin
  listAll: recruiterProcedure.query(async () => {
    return db.select().from(jobs).orderBy(asc(jobs.title));
  }),

  getById: recruiterProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [job] = await db.select().from(jobs).where(eq(jobs.id, input.id)).limit(1);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND' });
      return job;
    }),

  generateDescription: recruiterProcedure
    .input(
      z.object({
        title: z.string().min(2),
        responsibilities: z.string().min(10),
        level: z.enum(['intern', 'l1', 'l2', 'l3', 'l4', 'lead', 'manager']),
      }),
    )
    .mutation(({ input }) => generateJobDescription(input)),

  create: recruiterProcedure
    .input(
      z.object({
        title: z.string().min(2),
        department: z.string().min(2),
        level: z.enum(['intern', 'l1', 'l2', 'l3', 'l4', 'lead', 'manager']),
        location: z.enum(['hyderabad', 'remote_india', 'uae']),
        type: z.enum(['full_time', 'contract', 'intern']).default('full_time'),
        jdMarkdown: z.string().min(50),
        screeningQuestions: z.array(screeningQuestionSchema).max(5).default([]),
        hardFilters: hardFiltersSchema.default({}),
        autoShortlistThreshold: z.number().int().min(0).max(100).default(75),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slug = await uniqueSlug(input.title);
      const shareLinks = buildShareLinks(slug, input.title);

      const [job] = await db
        .insert(jobs)
        .values({
          slug,
          title: input.title,
          department: input.department,
          level: input.level,
          location: input.location,
          type: input.type,
          status: 'draft',
          jdMarkdown: input.jdMarkdown,
          screeningQuestions: input.screeningQuestions as never,
          hardFilters: input.hardFilters as never,
          autoShortlistThreshold: input.autoShortlistThreshold,
          shareLinks: shareLinks as never,
          createdBy: ctx.session.userId,
        })
        .returning();

      if (!job) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      await audit({
        actorType: 'human',
        actorId: ctx.session.userId,
        action: 'job.create',
        targetType: 'job',
        targetId: job.id,
        payload: { title: job.title, slug: job.slug },
      });

      return job;
    }),

  publish: recruiterProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(jobs)
        .set({ status: 'open', updatedAt: new Date() })
        .where(eq(jobs.id, input.id))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

      await audit({
        actorType: 'human',
        actorId: ctx.session.userId,
        action: 'job.publish',
        targetType: 'job',
        targetId: updated.id,
      });
      return updated;
    }),

  setAutonomy: recruiterProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        autonomy: z.enum(['suggest_only', 'auto_low_stakes', 'full_except_offers']),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(jobs)
        .set({ agentAutonomy: input.autonomy, updatedAt: new Date() })
        .where(eq(jobs.id, input.id))
        .returning();
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND' });

      await audit({
        actorType: 'human',
        actorId: ctx.session.userId,
        action: 'job.set_autonomy',
        targetType: 'job',
        targetId: updated.id,
        payload: { autonomy: input.autonomy },
      });
      return updated;
    }),
});

async function uniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const [existing] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.slug, candidate)).limit(1);
    if (!existing) return candidate;
  }
  return `${base}-${Date.now()}`;
}
