# VaivammHire

AWS-native AI recruitment platform for Vaivamm Capital Advisors. The hosted app URL is the **CloudFront** distribution URL from CDK (`VaivammHire-Frontend-<env>` stack output `CloudFrontUrl`), not a separate marketing domain—set `NEXT_PUBLIC_APP_URL` to that URL when building the Next.js bundle for Lambda/OpenNext.

> Full requirements live in [`VaivammHire-PRD.md`](./VaivammHire-PRD.md). The phased delivery plan is in [`BACKLOG.md`](./BACKLOG.md).

## Structure

```
vaivammhire-app/      ← Next.js 15 + tRPC + Drizzle (Track A — Bedrock-powered v1)
vaivammhire-infra/    ← AWS CDK stacks (TypeScript)
vaivammhire-ml/       ← Python + SageMaker (Track B — custom ML/NLP)
.github/workflows/    ← CI/CD
```

## Prerequisites

- Node 20.11+ (`.nvmrc`)
- pnpm 9+
- Python 3.11 (`.python-version`)
- `uv` for Python deps (`pipx install uv`)
- AWS CLI v2 with profile `vaivammhire-dev`
- AWS CDK CLI: `npm i -g aws-cdk`
- Bedrock Claude model access in `ap-south-1` (verify: `aws bedrock list-foundation-models --by-provider anthropic --region ap-south-1`)

## Quick start (local dev)

```bash
pnpm install
cp vaivammhire-app/.env.example vaivammhire-app/.env.local
# fill in DATABASE_URL, AWS creds, etc.
pnpm app:dev               # http://localhost:3000
pnpm infra:synth           # validate CDK
cd vaivammhire-ml && uv sync && uv run pytest
```

## Deploy (staging)

```bash
pnpm infra:deploy -- --context env=staging
```

CI deploys automatically on push to `main` (see `.github/workflows/deploy-staging.yml`).

## Repo conventions

See [`CLAUDE.md`](./CLAUDE.md).
