import { TRPCError, initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import type { AuthSession } from './auth';

export interface Context {
  session: AuthSession | null;
  reqIp: string | null;
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const middleware = t.middleware;

const requireUser = middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sign-in required' });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});

export const protectedProcedure = publicProcedure.use(requireUser);

const requireRole = (roles: AuthSession['role'][]) =>
  middleware(({ ctx, next }) => {
    if (!ctx.session) {
      throw new TRPCError({ code: 'UNAUTHORIZED' });
    }
    if (!roles.includes(ctx.session.role)) {
      throw new TRPCError({ code: 'FORBIDDEN', message: `Requires role: ${roles.join('|')}` });
    }
    return next({ ctx: { ...ctx, session: ctx.session } });
  });

export const adminProcedure = publicProcedure.use(requireRole(['admin']));
export const recruiterProcedure = publicProcedure.use(
  requireRole(['admin', 'recruiter', 'hiring_manager']),
);

/** Admin + recruiters + hiring managers + interviewers (internal “member” roles). */
export const staffProcedure = publicProcedure.use(
  requireRole(['admin', 'recruiter', 'hiring_manager', 'interviewer']),
);
