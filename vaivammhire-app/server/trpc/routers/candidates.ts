import { TRPCError } from '@trpc/server';
import { desc, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/server/db';
import { candidates } from '@/server/db/schema';
import { recruiterProcedure, router } from '../init';

export const candidatesRouter = router({
  search: recruiterProcedure
    .input(z.object({ query: z.string().optional(), limit: z.number().min(1).max(100).default(50) }))
    .query(async ({ input }) => {
      if (!input.query) {
        return db.select().from(candidates).orderBy(desc(candidates.createdAt)).limit(input.limit);
      }
      const q = `%${input.query}%`;
      return db
        .select()
        .from(candidates)
        .where(or(ilike(candidates.name, q), ilike(candidates.email, q)))
        .orderBy(desc(candidates.createdAt))
        .limit(input.limit);
    }),

  getById: recruiterProcedure.input(z.object({ id: z.string().uuid() })).query(async ({ input }) => {
    const [c] = await db.select().from(candidates).where(eq(candidates.id, input.id)).limit(1);
    if (!c) throw new TRPCError({ code: 'NOT_FOUND' });
    return c;
  }),
});
