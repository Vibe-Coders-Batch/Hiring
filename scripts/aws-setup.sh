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
DB_SECRET_ARN="$(cf_output "$(stack Data)" DbSecretArn)"
DB_NAME="$(cf_output "$(stack Data)" DbName)"
RESUMES_BUCKET="$(cf_output "$(stack Data)" ResumesBucketName)"
OFFERS_BUCKET="$(cf_output "$(stack Data)" OffersBucketName)"
TRAINING_BUCKET="$(cf_output "$(stack Data)" TrainingBucketName)"
ADMIN_POOL="$(cf_output "$(stack Auth)" AdminPoolId)"
ADMIN_CLIENT="$(cf_output "$(stack Auth)" AdminClientId)"
HOSTED_UI="$(cf_output "$(stack Auth)" AdminHostedUiUrl)"
CANDIDATE_POOL="$(cf_output "$(stack Auth)" CandidatePoolId)"
CF_URL="$(cf_output "$(stack Frontend)" CloudFrontUrl)"
WEBHOOKS_URL="$(cf_output "$(stack Compute)" WebhooksUrl)"

# Fetch DB password from Secrets Manager and assemble a DATABASE_URL.
if [[ -n "$DB_SECRET_ARN" ]]; then
  info "Fetching DB credentials from Secrets Manager…"
  SECRET_JSON="$(aws secretsmanager get-secret-value --secret-id "$DB_SECRET_ARN" --query SecretString --output text)"
  DB_USER="$(echo "$SECRET_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["username"])')"
  DB_PASS="$(echo "$SECRET_JSON" | python3 -c 'import sys,json;print(json.load(sys.stdin)["password"])')"
  DB_PASS_ENCODED="$(python3 -c "import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1], safe=''))" "$DB_PASS")"
  env_set DATABASE_URL "postgres://${DB_USER}:${DB_PASS_ENCODED}@${DB_HOST}:5432/${DB_NAME:-vaivammhire}?sslmode=require"
  ok "DATABASE_URL written"
fi

[[ -n "$RESUMES_BUCKET" ]] && env_set S3_RESUMES_BUCKET "$RESUMES_BUCKET"
[[ -n "$OFFERS_BUCKET" ]] && env_set S3_OFFERS_BUCKET "$OFFERS_BUCKET"
[[ -n "$TRAINING_BUCKET" ]] && env_set S3_TRAINING_BUCKET "$TRAINING_BUCKET"
[[ -n "$ADMIN_POOL" ]] && env_set COGNITO_USER_POOL_ID "$ADMIN_POOL"
[[ -n "$ADMIN_CLIENT" ]] && env_set COGNITO_USER_POOL_CLIENT_ID "$ADMIN_CLIENT"
[[ -n "$CANDIDATE_POOL" ]] && env_set COGNITO_CANDIDATE_POOL_ID "$CANDIDATE_POOL"
[[ -n "$CF_URL" ]] && env_set NEXT_PUBLIC_APP_URL "$CF_URL"

ok "Outputs written to $ENV_FILE"

step "Allowlisting your public IP on the Aurora security group (dev/staging only)"
DB_SG_ID="$(cf_output "$(stack Data)" DbSecurityGroupId)"
if [[ "$ENV_NAME" != "prod" && -n "$DB_SG_ID" ]]; then
  MY_IP="$(curl -fsS https://checkip.amazonaws.com 2>/dev/null | tr -d '[:space:]' || true)"
  if [[ -n "$MY_IP" ]]; then
    if aws ec2 authorize-security-group-ingress \
      --group-id "$DB_SG_ID" \
      --protocol tcp --port 5432 \
      --cidr "${MY_IP}/32" \
      --tag-specifications "ResourceType=security-group-rule,Tags=[{Key=Name,Value=vaivammhire-operator-${MY_IP}}]" \
      >/dev/null 2>&1; then
      ok "Allowed Postgres ingress from ${MY_IP}/32 on $DB_SG_ID"
    else
      info "Ingress rule for ${MY_IP}/32 already exists or could not be added — continuing."
    fi
  else
    warn "Could not determine your public IP. Skip; add the rule manually if migrations fail."
  fi
fi

step "Installing app dependencies + applying schema (drizzle-kit push)"
(cd "$APP_DIR" && pnpm install) || warn "pnpm install in vaivammhire-app failed — re-run 'cd vaivammhire-app && pnpm install' before migrations."
if (cd "$APP_DIR" && pnpm exec drizzle-kit push); then
  ok "Schema applied to Aurora"
else
  warn "Schema push failed. Common fixes:"
  warn "  1. Wait 30s — Aurora may still be coming up."
  warn "  2. Check Console → RDS → security groups: ingress on 5432 from your IP."
  warn "  3. Re-run: cd vaivammhire-app && pnpm exec drizzle-kit push"
fi

step "Done"
echo
echo -e "${C_BOLD}URLs${C_RESET}"
[[ -n "$CF_URL" ]]      && echo "  App (CloudFront):  ${C_GREEN}$CF_URL${C_RESET}"
[[ -n "$HOSTED_UI" ]]   && echo "  Admin sign-in:     ${C_GREEN}$HOSTED_UI${C_RESET}"
[[ -n "$WEBHOOKS_URL" ]] && echo "  Webhooks API:      $WEBHOOKS_URL"
echo
echo -e "${C_BOLD}IDs${C_RESET}"
echo "  Account:           $ACCOUNT_ID"
echo "  Region:            $AWS_REGION"
echo "  Environment:       $ENV_NAME"
[[ -n "$ADMIN_POOL" ]]  && echo "  Admin pool:        $ADMIN_POOL"
[[ -n "$ADMIN_CLIENT" ]] && echo "  Admin client:      $ADMIN_CLIENT"
[[ -n "$DB_HOST" ]]     && echo "  DB endpoint:       $DB_HOST"
echo
echo -e "${C_BOLD}Next${C_RESET}"
echo "  1. Create your admin user:"
echo "       make seed-admin EMAIL=you@example.com"
echo "  2. Open the Admin sign-in URL above. Cognito will email a temporary password;"
echo "     set a new password + TOTP MFA, then you're in."
echo "  3. The CloudFront URL serves a placeholder until OpenNext build is wired."
echo "     Re-run 'make urls' anytime to print these again."
echo "  4. Tear down: make destroy"
