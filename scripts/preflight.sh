#!/usr/bin/env bash
# Standalone "is my machine ready?" check. Run this first if something's off.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"

step "Tooling"
install_hint() {
  case "$1" in
    aws)    echo "brew install awscli" ;;
    node)   echo "brew install node@20" ;;
    pnpm)   echo "brew install pnpm" ;;
    docker) echo "brew install --cask docker" ;;
    uv)     echo "brew install uv" ;;
    *)      echo "see https://brew.sh" ;;
  esac
}
MISSING=""
for t in aws node pnpm docker; do
  if command -v "$t" >/dev/null; then
    ok "$t: $(command -v "$t")"
  else
    warn "$t: NOT INSTALLED   →   $(install_hint "$t")"
    MISSING="$MISSING $t"
  fi
done
if command -v uv >/dev/null; then
  ok "uv: $(command -v uv)"
else
  warn "uv: NOT INSTALLED (optional, ML repo only)   →   $(install_hint uv)"
fi

step "AWS"
if aws sts get-caller-identity --profile "$AWS_PROFILE" >/dev/null 2>&1; then
  ID="$(aws sts get-caller-identity --profile "$AWS_PROFILE" --query Account --output text)"
  ok "Profile $AWS_PROFILE → account $ID"
else
  warn "AWS profile '$AWS_PROFILE' not configured. Run: aws configure --profile $AWS_PROFILE"
fi

step "Bedrock Claude in $AWS_REGION"
MODELS="$(aws bedrock list-foundation-models --by-provider anthropic --region "$AWS_REGION" \
  --query 'modelSummaries[?contains(modelId, `claude`)].modelId' --output text 2>/dev/null || echo "")"
if [[ -n "$MODELS" ]]; then
  ok "Available: $(echo "$MODELS" | tr '\t' ' ')"
else
  warn "No Claude models. Console → Bedrock → Model access → request access."
fi

step "Repo state"
[[ -f "$REPO_ROOT/pnpm-lock.yaml" ]] && ok "pnpm-lock.yaml" || warn "pnpm-lock.yaml missing — run 'pnpm install'"
[[ -f "$ENV_FILE" ]] && ok ".env.local" || warn ".env.local missing — aws-setup.sh will create it"

step "Docker (for local Postgres)"
if docker info >/dev/null 2>&1; then
  ok "docker daemon reachable"
else
  warn "docker daemon not running"
fi

echo
MISSING="$(echo "$MISSING" | xargs)"
if [[ -n "$MISSING" ]]; then
  echo -e "${C_BOLD}${C_YELLOW}Install missing tools first:${C_RESET}"
  for t in $MISSING; do
    echo "  $(install_hint "$t")"
  done
  echo
fi
echo -e "${C_DIM}When everything is green: ./scripts/aws-setup.sh${C_RESET}"
