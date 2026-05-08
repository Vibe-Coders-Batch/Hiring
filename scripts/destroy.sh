#!/usr/bin/env bash
# Tear down a VaivammHire environment. Refuses to touch prod by default.
#
# Usage: ENV_NAME=dev ./scripts/destroy.sh

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

if [[ "$ENV_NAME" == "prod" ]]; then
  fail "Refusing to auto-destroy prod. Run 'cdk destroy' manually with explicit consent."
fi

step "About to destroy all VaivammHire-*-${ENV_NAME} stacks"
warn "This deletes the database, all S3 buckets in this env, and the CloudFront distribution."
read -r -p "    Type the env name '$ENV_NAME' to confirm: " confirm
[[ "$confirm" == "$ENV_NAME" ]] || fail "Mismatch — aborting."

cd "$INFRA_DIR"

# Reverse order: Frontend depends on Compute depends on Data + Auth + AI.
for layer in Observability Frontend Compute AI Auth Data Network; do
  info "Destroying $(stack "$layer")…"
  pnpm exec cdk destroy "$(stack "$layer")" \
    --force \
    --context env="$ENV_NAME" || warn "$(stack "$layer") destroy failed — check console."
done

ok "Done. Bootstrap stack (CDKToolkit) is left in place — it's free and account-wide."
