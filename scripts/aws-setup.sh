#!/usr/bin/env bash
# VaivammHire — one-command AWS bootstrap for the dev environment.
#
# Usage:
#   AWS_PROFILE=my-profile AWS_REGION=ap-south-1 ./scripts/aws-setup.sh
#
# Idempotent — re-running is safe. Pass ENV_NAME=staging to deploy a different env.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

step "Pre-flight: checking required tools"
need aws
need node
need pnpm
need docker
ok "aws $(aws --version 2>&1 | awk '{print $1}' | cut -d/ -f2)"
ok "node $(node --version)"
ok "pnpm $(pnpm --version)"

step "Pre-flight: checking AWS credentials (profile=$AWS_PROFILE, region=$AWS_REGION)"
if ! aws sts get-caller-identity >/dev/null 2>&1; then
  fail "AWS profile '$AWS_PROFILE' is not configured. Run: aws configure --profile $AWS_PROFILE"
fi
ACCOUNT_ID="$(aws_account_id)"
ok "Authenticated as account $ACCOUNT_ID"

step "Pre-flight: checking Bedrock Claude access in $AWS_REGION"
CLAUDE_AVAILABLE="$(aws bedrock list-foundation-models \
  --by-provider anthropic --region "$AWS_REGION" \
  --query 'modelSummaries[?contains(modelId, `claude`)].modelId' \
  --output text 2>/dev/null || echo "")"

if [[ -z "$CLAUDE_AVAILABLE" ]]; then
  warn "No Claude models accessible in $AWS_REGION."
  warn "Open Console → Bedrock → Model access → request 'Anthropic Claude Sonnet'."
  warn "If $AWS_REGION doesn't have it, set AWS_REGION=ap-southeast-1 and retry."
  read -r -p "    Proceed anyway? [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]] || exit 1
else
  ok "Claude available: $(echo "$CLAUDE_AVAILABLE" | tr '\t' '\n' | head -1)"
fi

step "Pre-flight: generating lockfiles if missing"
if [[ ! -f "$REPO_ROOT/pnpm-lock.yaml" ]]; then
  info "pnpm install (this can take a minute)…"
  (cd "$REPO_ROOT" && pnpm install)
  ok "pnpm-lock.yaml created"
else
  ok "pnpm-lock.yaml present"
fi

if [[ -d "$ML_DIR" ]] && command -v uv >/dev/null && [[ ! -f "$ML_DIR/uv.lock" ]]; then
  info "uv sync for vaivammhire-ml…"
  (cd "$ML_DIR" && uv sync) || warn "uv sync failed (Python deps optional for AWS path)"
fi

step "CDK bootstrap (idempotent)"
if ! aws cloudformation describe-stacks --stack-name CDKToolkit --region "$AWS_REGION" >/dev/null 2>&1; then
  info "Running cdk bootstrap…"
  (cd "$INFRA_DIR" && pnpm exec cdk bootstrap "aws://$ACCOUNT_ID/$AWS_REGION")
  ok "CDK bootstrapped"
else
  ok "CDKToolkit stack already exists"
fi

step "Deploying stacks (order: Network → Data → Auth → AI → Compute → Frontend → Observability)"
info "Each stack runs cdk deploy --require-approval never. RDS takes ~15 min on first run."
cd "$INFRA_DIR"

for layer in Network Data Auth AI Compute Frontend Observability; do
  info "Deploying $(stack "$layer")…"
  pnpm exec cdk deploy "$(stack "$layer")" \
    --require-approval never \
    --context env="$ENV_NAME"
  ok "$(stack "$layer") deployed"
done

step "Capturing CloudFormation outputs into $ENV_FILE"
mkdir -p "$(dirname "$ENV_FILE")"
[[ -f "$ENV_FILE" ]] || cp "$APP_DIR/.env.example" "$ENV_FILE"

env_set AWS_REGION "$AWS_REGION"
env_set AWS_ACCOUNT_ID "$ACCOUNT_ID"

DB_HOST="$(cf_output "$(stack Data)" DbEndpoint)"
RESUMES_BUCKET="$(cf_output "$(stack Data)" ResumesBucketName)"
ADMIN_POOL="$(cf_output "$(stack Auth)" AdminPoolId)"
ADMIN_CLIENT="$(cf_output "$(stack Auth)" AdminClientId)"
CANDIDATE_POOL="$(cf_output "$(stack Auth)" CandidatePoolId)"
CF_URL="$(cf_output "$(stack Frontend)" CloudFrontUrl)"

[[ -n "$DB_HOST" ]] && env_set DATABASE_URL "postgres://postgres@${DB_HOST}:5432/vaivammhire?sslmode=require"
[[ -n "$RESUMES_BUCKET" ]] && env_set S3_RESUMES_BUCKET "$RESUMES_BUCKET"
[[ -n "$ADMIN_POOL" ]] && env_set COGNITO_USER_POOL_ID "$ADMIN_POOL"
[[ -n "$ADMIN_CLIENT" ]] && env_set COGNITO_USER_POOL_CLIENT_ID "$ADMIN_CLIENT"
[[ -n "$CANDIDATE_POOL" ]] && env_set COGNITO_CANDIDATE_POOL_ID "$CANDIDATE_POOL"
[[ -n "$CF_URL" ]] && env_set NEXT_PUBLIC_APP_URL "$CF_URL"

ok "Outputs written to $ENV_FILE"

step "Running database migrations against the deployed Aurora cluster"
warn "Aurora uses IAM auth — make sure your local IAM user has rds-db:connect on the cluster."
warn "If this step fails, run it manually with the right DATABASE_URL: cd vaivammhire-app && pnpm db:migrate"
(cd "$APP_DIR" && pnpm db:migrate) || warn "Migrations failed — fix DATABASE_URL and re-run 'pnpm db:migrate'."

step "Done"
echo
echo -e "${C_BOLD}Summary${C_RESET}"
echo "  Account:        $ACCOUNT_ID"
echo "  Region:         $AWS_REGION"
echo "  Environment:    $ENV_NAME"
[[ -n "$CF_URL" ]] && echo "  App URL:        $CF_URL"
[[ -n "$ADMIN_POOL" ]] && echo "  Admin pool:     $ADMIN_POOL"
echo
echo -e "${C_BOLD}Next${C_RESET}"
echo "  1. Create your admin user:"
echo "       ./scripts/seed-admin.sh you@example.com"
echo "  2. Open the app URL above and sign in (Cognito emails a temp password)."
echo "  3. /admin/jobs/new → AI-draft a JD → publish → test the apply flow."
echo "  4. To tear it all down later: ./scripts/destroy.sh"
