# CLAUDE.md — vaivammhire-infra

CDK in TypeScript. Single source of truth for AWS resources (PRD §5.2, §11).

## Order of operations

When adding resources:
1. Add to the right stack (network / data / auth / compute / frontend / ai / observability).
2. `pnpm synth` must pass without warnings.
3. `pnpm diff` against the target env shows the change cleanly.
4. Always tag: `project=vaivammhire`, `env=<env>`, `owner=tarun`. Cost Explorer relies on this.

## Conventions

- Stack names: `VaivammHire-<Layer>-<env>`.
- Dev/staging buckets get `removalPolicy: DESTROY` + `autoDeleteObjects`. Prod buckets retain.
- `cdk-nag` should run in CI before deploy.
- IAM follows least-privilege; never use `*` resources without justification in a comment.

## Don't

- Don't merge stacks. Layer separation gives us blast-radius isolation.
- Don't `cdk deploy` from a laptop to prod. Tagged release → GitHub Actions.
- Don't put secrets in env/context — use Secrets Manager.
