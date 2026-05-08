import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db';
import { audit } from '@/server/db/audit';
import { compBands } from '@/server/db/schema';
import { adminProcedure, recruiterProcedure, router } from '../init';

const roleFamilyEnum = z.enum([
  'engineering',
  'wealth_advisory',
  'operations',
  'marketing',
  'finance',
  'legal',
  'data_ml',
]);
const levelEnum = z.enum(['intern', 'l1', 'l2', 'l3', 'l4', 'lead', 'manager']);
const locationEnum = z.enum(['hyderabad', 'remote_india', 'uae']);

export const compBandsRouter = router({
  list: recruiterProcedure.query(async () =>
    db.select().from(compBands).orderBy(desc(compBands.createdAt)),
  ),

  upsert: adminProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        roleFamily: roleFamilyEnum,
        level: levelEnum,
        location: locationEnum,
        fixedMin: z.number().int().nonnegative(),
        fixedMax: z.number().int().nonnegative(),
        variablePct: z.number().int().min(0).max(100).default(0),
        esopsInr: z.number().int().nonnegative().default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.fixedMax < input.fixedMin) {
        throw new Error('fixedMax must be >= fixedMin');
      }
      const values = {
        roleFamily: input.roleFamily,
        level: input.level,
        location: input.location,
        fixedMin: input.fixedMin,
        fixedMax: input.fixedMax,
        variablePct: input.variablePct,
        esopsInr: input.esopsInr,
      };
      const [row] = input.id
        ? await db.update(compBands).set(values).where(eq(compBands.id, input.id)).returning()
        : await db.insert(compBands).values(values).returning();
      if (!row) throw new Error('Upsert failed');

      await audit({
        actorType: 'human',
        actorId: ctx.session.userId,
        action: 'comp_band.upsert',
        targetType: 'comp_band',
        targetId: row.id,
        payload: values,
      });
      return row;
    }),

  approve: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(compBands)
        .set({ approved: true, approvedBy: ctx.session.userId })
        .where(eq(compBands.id, input.id))
        .returning();
      if (!updated) throw new Error('Not found');

      await audit({
        actorType: 'human',
        actorId: ctx.session.userId,
        action: 'comp_band.approve',
        targetType: 'comp_band',
        targetId: updated.id,
      });
      return updated;
    }),
});
