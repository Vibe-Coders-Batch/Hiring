#!/usr/bin/env bash
# Print all the URLs + IDs from the deployed VaivammHire stacks.
# Run anytime after `make setup` completes.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

CF_URL="$(cf_output "$(stack Frontend)" CloudFrontUrl)"
HOSTED_UI="$(cf_output "$(stack Auth)" AdminHostedUiUrl)"
ADMIN_POOL="$(cf_output "$(stack Auth)" AdminPoolId)"
ADMIN_CLIENT="$(cf_output "$(stack Auth)" AdminClientId)"
WEBHOOKS_URL="$(cf_output "$(stack Compute)" WebhooksUrl)"
DB_HOST="$(cf_output "$(stack Data)" DbEndpoint)"
DB_SECRET_ARN="$(cf_output "$(stack Data)" DbSecretArn)"

if [[ -z "$CF_URL" && -z "$ADMIN_POOL" ]]; then
  fail "No outputs found — has 'make setup' completed for env=$ENV_NAME?"
fi

echo
echo -e "${C_BOLD}URLs${C_RESET}"
[[ -n "$CF_URL" ]]      && echo "  App (CloudFront):  ${C_GREEN}$CF_URL${C_RESET}"
[[ -n "$HOSTED_UI" ]]   && echo "  Admin sign-in:     ${C_GREEN}$HOSTED_UI${C_RESET}"
[[ -n "$WEBHOOKS_URL" ]] && echo "  Webhooks API:      $WEBHOOKS_URL"
echo
echo -e "${C_BOLD}IDs${C_RESET}"
echo "  Account:           $(aws_account_id)"
echo "  Region:            $AWS_REGION"
echo "  Environment:       $ENV_NAME"
[[ -n "$ADMIN_POOL" ]]   && echo "  Admin pool:        $ADMIN_POOL"
[[ -n "$ADMIN_CLIENT" ]] && echo "  Admin client:      $ADMIN_CLIENT"
[[ -n "$DB_HOST" ]]      && echo "  DB endpoint:       $DB_HOST"
[[ -n "$DB_SECRET_ARN" ]] && echo "  DB secret ARN:     $DB_SECRET_ARN"
echo
