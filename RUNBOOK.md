# RUNBOOK — VaivammHire dev environment

The Makefile + `scripts/` directory automate everything below. This document explains *what* the scripts do, *what they need first*, and *how to recover when something goes wrong* — so you can read it once and trust the automation.

## Zero → working dev env in three commands

Once your machine is set up (next section), this is the entire flow:

```bash
make preflight                        # checks: tools, AWS profile, Bedrock access, Docker
make setup                            # cdk bootstrap → deploy 7 stacks → write .env.local → migrate
make seed-admin EMAIL=you@example.com # creates a Cognito user, adds to admin group
```

Sign in to the CloudFront URL printed at the end. Done.

---

## Prerequisites (one-time, ~15 min)

### Local tooling

```bash
brew install awscli node pnpm docker
brew install astral-sh/uv/uv          # only needed for the ML repo
```

### AWS account setup

1. **IAM user.** Console → IAM → Users → create `vaivammhire-dev`. Attach `AdministratorAccess` (tighten later — see "Hardening" below). Save the access key ID + secret.

2. **Configure CLI:**
   ```bash
   aws configure --profile vaivammhire-dev
   # AWS Access Key ID: <paste>
   # AWS Secret Access Key: <paste>
   # Default region: ap-south-1
   # Default output: json
   ```

3. **Enable Bedrock Claude.** Console → Bedrock → Model access → request access for **Anthropic Claude Sonnet 4** (and Titan Embed Text). Approval is usually instant.

   If `ap-south-1` doesn't list Claude (it sometimes lags), use `ap-southeast-1`:
   ```bash
   export AWS_REGION=ap-southeast-1
   ```
   Data still lives in Mumbai per DPDP — only AI inference crosses regions (PRD §20.4).

4. **Set a budget.** Console → Billing → Budgets → $50/mo, alert at 80%. Cheap insurance against stuck Lambdas and SageMaker runs.

### Verify

```bash
make preflight
```

Everything should be ✓ or yellow `!` for genuinely-optional things (uv, Docker if you don't need local dev).

---

## What `make setup` actually does

Read [`scripts/aws-setup.sh`](./scripts/aws-setup.sh) — under 100 lines, no magic. The order:

1. **Pre-flight** — same checks as `make preflight`, but blocks on failures.
2. **Generate lockfiles** — `pnpm install` (creates `pnpm-lock.yaml`) and `uv sync` if `uv` exists.
3. **CDK bootstrap** — only runs if the `CDKToolkit` stack isn't already in your account. Idempotent.
4. **Deploy stacks** in dependency order:
   ```
   Network → Data → Auth → AI → Compute → Frontend → Observability
   ```
   `--require-approval never` because every change here is in your dev account. RDS takes ~15 min on first deploy.
5. **Write outputs** to `vaivammhire-app/.env.local` — DB endpoint, Cognito pool IDs, S3 bucket name, CloudFront URL.
6. **Run migrations** against the deployed Aurora cluster. If this fails, it's almost always an IAM auth issue — see "Recovery" below.

The script is idempotent. Re-run it after a code change and CDK only redeploys what changed.

---

## What `make seed-admin EMAIL=…` does

1. Looks up the admin Cognito pool ID from the Auth stack's CloudFormation outputs.
2. Calls `cognito-idp admin-create-user` (skips if the user already exists).
3. Adds the user to the `admin` group.
4. Cognito emails a temporary password to the address.

You'll be prompted to set a permanent password on first sign-in.

---

## Local dev (no AWS deploy)

If you want to click around without paying for cloud resources:

```bash
make local-db                         # postgres in Docker on :5432
cd vaivammhire-app
cp .env.example .env.local
# edit .env.local: set DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
make migrate
make seed-data                        # inserts 1 job + 1 candidate
make local                            # http://localhost:3000
```

In this mode, AWS calls (Bedrock, SES) will fail when triggered — auth and database calls work fine. Good for UI and DB iteration; not for testing the screening pipeline end-to-end.

---

## Recovery

### `make setup` fails on a stack deploy

CDK errors are usually self-explanatory. Common ones:

| Error | Fix |
|---|---|
| `Resource limit exceeded` (VPC/EIP) | You hit a soft limit. Console → Service Quotas → request an increase. |
| `Cannot create alias` (KMS) | Pre-existing alias from a prior failed run — delete it in Console → KMS. |
| `Bucket … already owned` | Same — delete in Console → S3 (must empty first). |
| Aurora taking forever | First Aurora cluster in a region creates a Default Cluster Parameter Group. Be patient — ~15–20 min. |

After fixing, just re-run `make setup`. Stacks that already deployed are skipped.

### Migrations fail

`pnpm db:migrate` against deployed Aurora needs IAM auth or password auth. The bootstrap script writes a passwordless `DATABASE_URL` (assumes IAM auth). If that's not how you want to authenticate:

1. Console → Secrets Manager → find the `rds!cluster-…` auto-generated secret → copy `username` + `password`.
2. Edit `vaivammhire-app/.env.local`:
   ```
   DATABASE_URL=postgres://<user>:<pass>@<host>:5432/vaivammhire?sslmode=require
   ```
3. `make migrate`.

### Sign-in to admin doesn't work

Cognito admin pool requires MFA. On first sign-in:
1. Set permanent password (8+ chars, mixed case, digit, symbol).
2. Set up TOTP (scan QR with Authy / 1Password).
3. Re-sign-in with TOTP code.

If you're locked out: Console → Cognito → User pools → admin pool → users → reset MFA on yourself.

### CloudFront serves a 5xx

The app handler is using a stub. The OpenNext build hasn't run yet — that's separate from CDK and ships next. Until then, visit specific routes that don't depend on Next.js SSR (`/admin/dashboard` etc.) and check `/aws/lambda/<AppHandler>` logs in CloudWatch.

---

## Tear-down

```bash
make destroy                          # asks for confirmation, refuses prod
```

Buckets with `RemovalPolicy.RETAIN` (prod) will block destruction. Empty them first.

---

## Hardening before staging/prod

- Replace the `AdministratorAccess` IAM user with a deploy-only role + GitHub OIDC (PRD §17.1 Phase 2).
- Switch CDK to `--require-approval broadening` so iam policy changes prompt.
- Turn on `cdk-nag` in CI.
- Move secrets out of `.env.local` into AWS Secrets Manager + SSM Parameter Store; load them via the Lambda IAM role.

---

## When in doubt

```bash
make help
```
