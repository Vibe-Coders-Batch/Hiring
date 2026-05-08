# CLAUDE.md — VaivammHire monorepo

## Single-agent dev workflow (PRD §20.3)

**One Claude Code agent at a time.** No multi-agent orchestration during development. Loop is:

1. **Plan** — read the PRD section relevant to the task; restate the acceptance criteria.
2. **Execute** — write code that compiles, types check, tests pass.
3. **Verify** — run `pnpm -r lint && pnpm -r test` (and `cdk synth` for infra changes) before declaring done.

The PRD (`VaivammHire-PRD.md`) is the single source of truth. The phased backlog (`BACKLOG.md`) tracks progress.

## Repos

- `vaivammhire-app/` — Track A (Next.js 15 + tRPC + Drizzle).
- `vaivammhire-infra/` — AWS CDK stacks (TypeScript).
- `vaivammhire-ml/` — Track B (Python + SageMaker).

Each subrepo has its own `CLAUDE.md` with track-specific guidance.

## Conventions

- **No hardcoded hex colours** in components — use design tokens (PRD §18.9).
- **No raw Radix imports** in `app/` — go through `components/ui/` wrapper (PRD §18.5).
- **All AWS calls via service wrappers** in `vaivammhire-app/server/services/` — never instantiate AWS SDK clients in route handlers.
- **Every HR override is a training label** — write to `training_labels` synchronously in the same tRPC mutation that performs the override (PRD §7.3).
- **Append-only tables:** `audit_log`, `training_labels`. Never UPDATE or DELETE rows; only INSERT (PRD §9).
- **PII at boundaries only.** Resumes uploaded raw → S3. Anything that flows into `training/` must be PII-stripped first (PRD §12.2).

## Don't

- Don't commit secrets — use `.env.example` as the canonical list, real values go in AWS Secrets Manager.
- Don't bypass the promotion gate — a custom model only gets traffic after passing PRD §7.7 criteria.
- Don't add Bedrock calls outside `server/services/bedrock.ts`.
- Don't write AI prompts inline in business logic — they live in `server/services/prompts/`.
