# CLAUDE.md — vaivammhire-app

Track A app (Next.js 15, App Router, tRPC, Drizzle). Single-agent dev workflow.

## Hard rules

- **All AWS calls go through `server/services/*.ts`.** Never `new BedrockRuntimeClient()` in a route or component. The router (`server/services/router.ts`) decides Bedrock vs Comprehend vs custom per task.
- **All AI prompts live in `server/services/prompts/`.** Never inline a system prompt in a router or service.
- **Every HR override writes a `training_labels` row** in the same tRPC mutation that performs the override. See `server/db/audit.ts` → `captureTrainingLabel`.
- **`audit_log` and `training_labels` are append-only.** Never UPDATE/DELETE.
- **Design tokens only.** No hex literals in components — reach into `styles/tokens.css` via Tailwind classes or `var(--color-...)`.
- **Resumes never enter `training/` raw.** PII scrub via Comprehend (`server/services/comprehend.ts` → `scrubPii`) before any export Lambda touches them.

## Repo layout

```
app/                              # Next.js App Router
  (public)/                       # Public site routes (PRD §4.1)
  (admin)/                        # Admin app routes (PRD §4.2)
  api/                            # Webhooks, form submits, tRPC handler
components/
  ui/                             # shadcn/ui primitives + theme wrapper
  motion.tsx                      # framer-motion variants (PRD §18.6)
server/
  db/                             # Drizzle schema + migrations + audit helpers
  services/                       # AWS + AI services. One file per concern.
  trpc/                           # init + context + routers/_app.ts
lib/                              # Pure utilities (cn, env, slugify)
styles/                           # tokens.css + globals.css (Tailwind v4)
tests/
  unit/                           # Vitest
  e2e/                            # Playwright
  fixtures/                       # Test resumes (HR-validated)
```

## Adding a tRPC procedure

1. Pick the existing router or add a new one under `server/trpc/routers/<area>.ts`.
2. Use `recruiterProcedure` for HR-facing actions, `adminProcedure` for irreversible/destructive ones, `publicProcedure` only for the candidate-facing job board.
3. If the procedure represents an HR decision (promote/reject/override), call `audit()` AND `captureTrainingLabel()` before returning.
4. Add the router to `routers/_app.ts`.
5. Use the procedure from the client via `trpc.<area>.<proc>.useMutation()` / `useQuery()`.

## Don't

- Don't bypass `getServerEnv()` — it validates required env vars.
- Don't add Cognito client-side. Auth flows route through Cognito Hosted UI (PRD §10.4).
- Don't write protected-attribute features into any model context (PRD §12.2).
- Don't commit a real candidate resume to `tests/fixtures/`. Synthetic / consented samples only.
