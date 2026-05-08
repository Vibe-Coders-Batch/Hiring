#!/usr/bin/env bash
# Shared helpers for VaivammHire bootstrap scripts.

set -euo pipefail

# ─── colour + logging ────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  C_RESET='\033[0m'; C_BOLD='\033[1m'; C_RED='\033[31m'; C_GREEN='\033[32m'
  C_YELLOW='\033[33m'; C_BLUE='\033[34m'; C_DIM='\033[2m'
else
  C_RESET=''; C_BOLD=''; C_RED=''; C_GREEN=''; C_YELLOW=''; C_BLUE=''; C_DIM=''
fi

step()    { echo -e "\n${C_BOLD}${C_BLUE}==>${C_RESET} ${C_BOLD}$*${C_RESET}"; }
info()    { echo -e "    ${C_DIM}$*${C_RESET}"; }
ok()      { echo -e "    ${C_GREEN}✓${C_RESET} $*"; }
warn()    { echo -e "    ${C_YELLOW}!${C_RESET} $*"; }
fail()    { echo -e "    ${C_RED}✗${C_RESET} $*" >&2; exit 1; }

# ─── env defaults ────────────────────────────────────────────────────────────
: "${AWS_PROFILE:=vaivammhire-dev}"
: "${AWS_REGION:=ap-south-1}"
: "${ENV_NAME:=dev}"
export AWS_PROFILE AWS_REGION ENV_NAME

# ─── tool check ──────────────────────────────────────────────────────────────
need() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required tool: $1. Install it and retry."
}

# ─── repo paths ──────────────────────────────────────────────────────────────
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$REPO_ROOT/vaivammhire-app"
INFRA_DIR="$REPO_ROOT/vaivammhire-infra"
ML_DIR="$REPO_ROOT/vaivammhire-ml"
ENV_FILE="$APP_DIR/.env.local"

# ─── stack names ─────────────────────────────────────────────────────────────
stack() { echo "VaivammHire-$1-${ENV_NAME}"; }

# ─── AWS helpers ─────────────────────────────────────────────────────────────
aws_account_id() { aws sts get-caller-identity --query Account --output text; }

cf_output() {
  local stack_name="$1" key="$2"
  aws cloudformation describe-stacks \
    --stack-name "$stack_name" \
    --query "Stacks[0].Outputs[?OutputKey=='$key'].OutputValue" \
    --output text 2>/dev/null || echo ""
}

env_set() {
  local key="$1" value="$2"
  touch "$ENV_FILE"
  if grep -q "^${key}=" "$ENV_FILE"; then
    # macOS sed needs '' after -i
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}
