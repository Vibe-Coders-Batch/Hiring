#!/usr/bin/env bash
# Create an admin user in the Cognito pool deployed by the Auth stack
# and add them to the 'admin' group.
#
# Usage: ./scripts/seed-admin.sh <email>

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

EMAIL="${1:-}"
[[ -n "$EMAIL" ]] || fail "Usage: $0 <email>"

step "Looking up admin Cognito pool"
POOL_ID="$(cf_output "$(stack Auth)" AdminPoolId)"
[[ -n "$POOL_ID" ]] || fail "Auth stack outputs not found. Did $(stack Auth) deploy?"
ok "Pool: $POOL_ID"

step "Creating user $EMAIL"
if aws cognito-idp admin-get-user --user-pool-id "$POOL_ID" --username "$EMAIL" >/dev/null 2>&1; then
  ok "User already exists — skipping create."
else
  aws cognito-idp admin-create-user \
    --user-pool-id "$POOL_ID" \
    --username "$EMAIL" \
    --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
    --desired-delivery-mediums EMAIL >/dev/null
  ok "User created — Cognito sent a temporary password to $EMAIL."
fi

step "Adding to admin group"
aws cognito-idp admin-add-user-to-group \
  --user-pool-id "$POOL_ID" \
  --username "$EMAIL" \
  --group-name admin
ok "Added to 'admin' group."

CF_URL="$(cf_output "$(stack Frontend)" CloudFrontUrl)"
[[ -n "$CF_URL" ]] && info "Sign in at: $CF_URL/admin/dashboard"
