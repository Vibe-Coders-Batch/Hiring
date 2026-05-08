# VaivammHire — operator entry points.
#
# Defaults (override on the command line):
#   ENV_NAME=dev
#   AWS_PROFILE=vaivammhire-dev
#   AWS_REGION=ap-south-1

ENV_NAME    ?= dev
AWS_PROFILE ?= vaivammhire-dev
AWS_REGION  ?= ap-south-1

export ENV_NAME AWS_PROFILE AWS_REGION

.PHONY: help preflight setup urls seed-admin seed-data destroy local local-db migrate push test clean

help:
	@echo "VaivammHire — common tasks"
	@echo
	@echo "  make preflight         Check tools / AWS / Bedrock are ready"
	@echo "  make setup             Full bootstrap: cdk bootstrap + deploy all stacks + write .env.local"
	@echo "  make urls              Print URLs + IDs from the deployed stacks (re-runnable)"
	@echo "  make seed-admin EMAIL=you@example.com"
	@echo "                         Create your Cognito admin user + add to 'admin' group"
	@echo "  make seed-data         Insert sample job + candidate (uses .env.local DATABASE_URL)"
	@echo "  make local             Start local dev server (http://localhost:3000)"
	@echo "  make local-db          Start a local Postgres in Docker for offline dev"
	@echo "  make push              Apply schema directly via drizzle-kit push (use during initial setup)"
	@echo "  make migrate           Run drizzle migrations (after you've generated migration files)"
	@echo "  make test              Run all unit + cdk synth + python tests"
	@echo "  make destroy           Tear down the dev/staging environment (refuses prod)"
	@echo
	@echo "Environment: ENV_NAME=$(ENV_NAME) AWS_PROFILE=$(AWS_PROFILE) AWS_REGION=$(AWS_REGION)"

preflight:
	@./scripts/preflight.sh

setup:
	@./scripts/aws-setup.sh

urls:
	@./scripts/print-urls.sh

seed-admin:
	@if [ -z "$(EMAIL)" ]; then echo "Usage: make seed-admin EMAIL=you@example.com"; exit 1; fi
	@./scripts/seed-admin.sh "$(EMAIL)"

seed-data:
	@cd vaivammhire-app && pnpm exec tsx scripts/seed-dev.ts

local-db:
	@docker run --name vaivammhire-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgres:16 \
		|| docker start vaivammhire-pg

local:
	@cd vaivammhire-app && pnpm dev

migrate:
	@cd vaivammhire-app && pnpm db:migrate

push:
	@cd vaivammhire-app && pnpm exec drizzle-kit push

test:
	@pnpm -r test
	@cd vaivammhire-infra && pnpm synth >/dev/null
	@cd vaivammhire-ml && uv run pytest -q

destroy:
	@./scripts/destroy.sh

clean:
	@rm -rf vaivammhire-app/.next vaivammhire-app/coverage vaivammhire-infra/cdk.out
