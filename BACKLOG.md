# VaivammHire — Phased Implementation Backlog

Source of truth: [`VaivammHire-PRD.md`](./VaivammHire-PRD.md). This backlog operationalises §15 (Phased Rollout) into actionable items, tagged by **Track** (A = Bedrock product, B = SageMaker ML, C = v2 agent) and area. Each item links back to the PRD section that justifies it.

**Legend:** 🅰️ Track A  ·  🅱️ Track B  ·  🅲 Track C  ·  🔧 Infra/CDK  ·  🔐 Security/Compliance  ·  📊 Observability  ·  🧪 Testing  ·  📝 Docs

**Hard milestone gates (PRD §15):**
- [ ] **Week 4:** HR can hire someone end-to-end through Track A.
- [ ] **Week 12:** First custom model (M1 NER) live in prod.
- [ ] **Week 24:** v2 agent live; custom models handle majority of high-volume tasks.

---

## Phase 0 — Prerequisites (Week 0, before kickoff)

### Accounts & access
- [ ] AWS account + sub-accounts for `dev`, `staging`, `prod` (PRD §17.3).
- [ ] AWS Organisations + consolidated billing; tag plan: `env`, `track`, `component`, `cost-center`.
- [ ] Set monthly budget alarms: $300 SageMaker cap, separate caps for Bedrock, Textract, Comprehend (PRD §16.3).
- [ ] Verify Bedrock Claude availability in `ap-south-1`; fall back to `ap-southeast-1` only for AI inference if Mumbai lacks the model (PRD §20.4, §16.2). Run: `aws bedrock list-foundation-models --by-provider anthropic --region ap-south-1`.
- [ ] Register domain `hiring.vaivammcapital.com` in Route 53.
- [ ] Provision Vaivamm Google Workspace OAuth client (Calendar + Meet scopes) — PRD §6.5.
- [ ] Apply for Meta WhatsApp Cloud API business verification + template pre-approval (1–2 weeks lead time per PRD §16.9).
- [ ] LinkedIn Marketing API app — request Vaivamm Page admin OAuth (PRD §6.1).

### Repos & CI bootstrapping
- [ ] Create GitHub repos: `vaivammhire-app`, `vaivammhire-ml`, `vaivammhire-infra` (PRD §11). The current `Hiring` repo holds the PRD + this backlog until those land.
- [ ] 🅰️🔐 GitHub Actions Phase 1 secrets: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `LINKEDIN_*`, `GOOGLE_OAUTH_*`, `WHATSAPP_BUSINESS_TOKEN`, `DOCUMENSO_API_KEY`, `TURNSTILE_SECRET_KEY` (PRD §17.1). ✅ AWS keys already added to `Hiring` repo per provided screenshot.
- [ ] 🅰️📝 Add `CLAUDE.md` to each repo enforcing single-agent dev workflow (PRD §20.3).

---

## Phase 1 — Foundation (Weeks 1–4) — *gate: end-to-end hire works*

### 🔧 Infra (CDK in `vaivammhire-infra/`)
- [ ] `network-stack`: VPC (2 AZ), private + public subnets, NAT, VPC endpoints for S3/Bedrock/Textract (PRD §11).
- [ ] `data-stack`: RDS Aurora Postgres Serverless v2 (pgvector enabled), KMS-encrypted; S3 buckets `resumes/`, `offers/`, `training/`, `model-artifacts/` with SSE-KMS + lifecycle rules (PRD §10.2, §12.3).
- [ ] `auth-stack`: Cognito User Pool (admin, MFA mandatory) + candidate pool (passwordless email magic-link) (PRD §10.4).
- [ ] `compute-stack`: Lambda functions, API Gateway HTTP API, Step Functions skeleton, EventBridge bus, SQS queues + DLQs (PRD §10.1).
- [ ] `frontend-stack`: OpenNext + CloudFront + WAF managed rule sets + Cloudflare Turnstile binding (PRD §10.4).
- [ ] `ai-stack`: IAM policies for Bedrock invoke, Textract, Comprehend; SageMaker execution role + ECR repo (PRD §11).
- [ ] `observability-stack`: CloudWatch dashboards, alarms, X-Ray, Synthetics canary on `/jobs` and `/admin/dashboard` (PRD §10.6).

### 🅰️ App scaffold (`vaivammhire-app/`)
- [ ] Next.js 15 + React 19 + App Router; route groups `(public)`, `(admin)` (PRD §10.1, §11).
- [ ] tRPC + Drizzle wired to Aurora; migrations pipeline via GH Actions.
- [ ] Drizzle schema: `users`, `jobs`, `candidates`, `applications`, `interviews`, `assessments`, `submissions`, `offers`, `comp_bands`, `communications`, `audit_log`, `training_labels`, `model_runs` (PRD §9).
- [ ] Design tokens in `styles/tokens.css` + Tailwind v4 config; shadcn/ui themed wrapper in `components/ui/` (PRD §18).
- [ ] Inter font via `next/font/google` (weights 400/500/600/700) (PRD §18.3).
- [ ] `motion.tsx` shared variants (page fade, card lift, modal scale) honouring `prefers-reduced-motion` (PRD §18.6).

### 🅰️ Public site
- [ ] Routes `/`, `/jobs`, `/jobs/[slug]`, `/apply/[jobId]`, `/track/[applicationId]`, `/privacy`, `/delete-my-data` (PRD §4.1).
- [ ] Apply form: validated upload (PDF/DOCX, ≤5 MB) → S3 signed POST → magic-link email via SES (PRD §6.2).
- [ ] DPDP consent checkbox copy verbatim per PRD §12.1; rate-limit 10/IP/hour via WAF (PRD §12.3).
- [ ] Turnstile captcha on apply form (PRD §10.4).

### 🅰️ Admin app (minimum to hire)
- [ ] `/admin/dashboard` shell + KPIs stub.
- [ ] `/admin/jobs` CRUD + AI JD draft via Bedrock (PRD §6.1).
- [ ] Job share-link panel (Copy URL, LinkedIn share intent, WhatsApp share, email signature) (PRD §6.1).
- [ ] `/admin/jobs/[id]/pipeline` Kanban (dnd-kit) — default stages per PRD §6.4 + drag-card-triggers-action (PRD §6.10).
- [ ] `/admin/candidates/[id]` 360 view: resume preview, scorecard, communications, audit trail (PRD §4.2).
- [ ] One-click `Promote` / `Reject (with reason)` writes to `training_labels` (PRD §6.3, §7.3).

### 🅰️ AI screening pipeline (Bedrock-only v1)
- [ ] S3 ObjectCreated → Step Functions: Textract → Comprehend → Bedrock Claude (latest available) → write scorecard to RDS + emit `training_label` event (PRD §6.3).
- [ ] Scorecard JSON schema enforced (zod) per PRD §6.3 example.
- [ ] HR auto-shortlist threshold per role (default 75) (PRD §6.3).
- [ ] Hard filters (years, location, work-auth, must-have skills) auto-mark "Not a fit" (PRD §6.1).

### 🅱️ ML repo scaffold (`vaivammhire-ml/`)
- [ ] Python project (`pyproject.toml`), folders `models/{ner,fit_classifier,embeddings,dedup,spam}`, `eval/`, `pipelines/`, `inference/`, `containers/` (PRD §11).
- [ ] SageMaker Studio domain provisioned via CDK; ECR repo for custom training images.
- [ ] DVC initialised with S3 remote pointing to `training/` bucket (PRD §7.6).
- [ ] Bootstrap public datasets ingested to S3: Kaggle resume corpus, HuggingFace `bhadresh-savani/resume-classification`, O*NET, ESCO (PRD §7.2).

### 🅱️ Synthetic data + first model
- [ ] Bedrock-driven synthetic generator → 5k `(resume, JD, fit_score)` triples; HR spot-checks 5% (PRD §7.2).
- [ ] **M5 spam baseline** trained (XGBoost) — runs at edge before Bedrock invoke to cut cost (PRD §7.1).

### 🧪 Testing
- [ ] Vitest unit + tRPC integration with `aws-sdk-client-mock` and Postgres test container (PRD §19.1).
- [ ] Playwright E2E covering the four critical journeys in PRD §19.1.
- [ ] `tests/fixtures/resumes/` seeded with 20–50 sample resumes (Tarun-provided) + matching `tests/fixtures/expected/` JSON (PRD §19.2).
- [ ] Eval test: years ±1, ≥80% skill recall, education match, fit decision matches HR; fails PR on >5% regression (PRD §19.2).

### 🔐 Compliance baseline
- [ ] DPDP consent + privacy page + `/delete-my-data` magic-link self-serve cascading delete (S3+RDS+comms) keeping anonymised audit log 12 months (PRD §12.1).
- [ ] PII scrubber Lambda (Comprehend PII detection) for any data entering `training/` (PRD §12.2).
- [ ] No protected-attribute features in any model (PRD §12.2).

### 📊 Observability
- [ ] Cost tags applied to every resource; per-component cost dashboards (PRD §10.6).
- [ ] CloudWatch alarms → AWS Chatbot → Slack `#vaivammhire-alerts`.

### 🚀 CI/CD
- [ ] `ci.yml`, `e2e.yml`, `deploy-staging.yml`, `deploy-prod.yml` (PRD §17.2).
- [ ] CDK diff posted as PR comment.

---

## Phase 2 — Scheduling, Comms, Offers (Weeks 5–10)

### 🅰️ Scheduling & comms
- [ ] Google Calendar OAuth flow; refresh tokens in Secrets Manager (PRD §6.5).
- [ ] Agent proposes 3 free 45-min slots; candidate self-selects via `/track/[applicationId]`; Meet link + dual calendar event (PRD §6.5, §16.8 — *never auto-book a single slot*).
- [ ] SES outbound + inbound (MX → S3 → Lambda parser). Templates: ack, screening result, scheduling, rejection, offer (PRD §6.5, §6.9).
- [ ] SNS SMS reminders 24h + 1h pre-interview (PRD §6.5).
- [ ] WhatsApp via Meta Cloud API (templates pre-approved) (PRD §10.5).
- [ ] Migrate GH Actions from long-lived keys → **OIDC** with `VaivammHireGithubDeployer` role (PRD §17.1 Phase 2).

### 🅰️ Comp bands + offers
- [ ] `/admin/comp-bands` CRUD; founder approval flag gates auto-offer drafts (PRD §6.7).
- [ ] Bedrock-drafted offer letter → HTML template → headless Chromium Lambda → PDF in S3 (PRD §6.8).
- [ ] Documenso self-hosted on ECS Fargate (or DocuSign fallback). Webhook → application stage `Hired` (PRD §6.8, §13).
- [ ] CRM sync Lambda: HMAC-signed POST to `crm.vaivammcapital.com/api/onboarding`; idempotent on `vaivammhire_application_id`; SQS DLQ on failure (PRD §13).

### 🅰️ Assessments
- [ ] `/admin/assessments` templates (MCQ, coding, case study) (PRD §6.6).
- [ ] Coding sandbox Lambda runs hidden test cases; case study auto-summarised by Bedrock (PRD §6.6).

### 🅱️ Models
- [ ] **M1 Resume NER** v0.1 trained on public + synthetic; held-out eval established (PRD §7.1, §7.7).
- [ ] **M3 Skill Embeddings** trained on O*NET + ESCO; deployed behind feature flag (PRD §7.1).

### 🚀 LinkedIn share
- [ ] One-click "Post to Vaivamm LinkedIn page" via LinkedIn Marketing API (PRD §6.1). Drop if API access blocked (PRD §16.5).

---

## Phase 3 — AI Interviews + First Custom Model in Prod (Weeks 11–16) — *gate: M1 in prod*

### 🅰️ Interview module (advanced)
- [ ] Bedrock-generated behavioural + technical question bank per JD; shown 5 min pre-interview (PRD §6.5).
- [ ] Structured 5-criterion feedback rubric written to `interviews.feedback` (PRD §6.5).
- [ ] **AI Audio Interview**: Connect places call → Polly speaks Bedrock questions → Transcribe captures → Bedrock scores. **Opt-in** per PRD §16.4. Pilot on tech roles only.
- [ ] **AI Video Interview** (async): MediaRecorder upload to S3 → Transcribe → Bedrock scores (PRD §6.5).

### 🅱️ Labeling workbench
- [ ] `/admin/labeling`: Active queue (lowest-confidence 20), Disagreement queue (Bedrock vs custom), Random sample (5/wk), Bulk CSV upload (PRD §7.4).
- [ ] Every HR action mapped to labels per PRD §7.3 table; `training_labels` append-only with provenance.
- [ ] Nightly anonymised export to S3 + DVC commit (PRD §7.3).

### 🅱️ M1 → prod
- [ ] SageMaker Pipeline: Preprocess → Train (`ml.g5.xlarge`) → Evaluate → Register (PendingManualApproval) (PRD §7.5).
- [ ] Eval harness against `eval/golden_set.jsonl` (200 HR-labeled examples) computing accuracy/cost/latency vs Bedrock + Comprehend (PRD §7.7).
- [ ] **Promotion gate** evaluation: ≥2 of 3 wins (accuracy/cost/p95), no >10% loss on third, HR-agreement within 5pts, fairness eval pass (PRD §7.7, §12.2).
- [ ] M1 Lambda inference (ONNX Runtime, p95 <500ms) deployed; `/admin/models` shows current prod version (PRD §7.8).
- [ ] Shadow Bedrock for 2 weeks before traffic-shift (PRD §16.10).

### 🅱️ M2 baseline
- [ ] **M2 JD-Fit Classifier** trained on real Vaivamm data (LightGBM + cross-encoder embeddings) (PRD §7.1).
- [ ] **M4 Dedup** (MinHash + LSH + email/phone exact match) deployed — no training needed (PRD §7.1).

---

## Phase 4 — Hub Polish, Comms Automations, M2 Eval (Weeks 17–20)

### 🅰️ Communication hub
- [ ] `/admin/communications` unified inbox: SES + WhatsApp + LinkedIn DM (Phase 3 channels) (PRD §6.9).
- [ ] HR autonomy levels per role: Suggest only / Auto low-stakes / Full except offers (default L2 at v2 launch) (PRD §8).
- [ ] Auto-send rules for ack, scheduling, reminders (low-stakes only) (PRD §6.9).

### 🅱️ M2 promotion
- [ ] M2 v0.2 retrained with HR labels; HR-agreement vs Bedrock within 5 pts (PRD §14.2).
- [ ] Run promotion gate; if pass, traffic-shift with shadow incumbent.
- [ ] Quarterly fairness eval (disparate impact across inferred gender + education tier) — **failing models cannot be promoted** (PRD §12.2).

### 🅲 Agent design
- [ ] Tool inventory and JSON schemas for v2 agent (parse_resume_local, score_fit_local, draft_email, schedule_interview, etc.) (PRD §8).
- [ ] Routing prompt drafted: prefer local for high-volume parse/score, Bedrock for drafting/edge cases (PRD §8).

---

## Phase 5 — v2 Agent + Quarterly Eval (Weeks 21–24) — *gate: v2 live*

### 🅲 Agent build
- [ ] Bedrock Converse API tool-calling loop on Lambda (sync) + Step Functions (multi-step) (PRD §8).
- [ ] Per-tool autonomy controls + per-role override (PRD §8).
- [ ] Audit every tool call to `audit_log` with full payload (PRD §12.4).

### 🅱️ Quarterly fairness + cost
- [ ] Fairness eval rerun; results posted to `/admin/models` (PRD §12.2).
- [ ] Verify cost/hire <50% of Track A-only baseline (PRD §14.3).

### 🚀 Production hardening
- [ ] Quarterly secret rotation Lambda (`rotate-secrets.yml`) (PRD §17.2, §12.3).
- [ ] 18-month archive job to S3 Glacier for `audit_log` + `training_labels` (PRD §9).

---

## Cross-cutting (continuous)

### 🔐 Security
- [ ] All resume URLs signed, 15-min TTL, `s3:GetObject` only (PRD §12.3).
- [ ] ML API behind private API Gateway, IAM-auth only (PRD §12.3).
- [ ] Quarterly third-party token rotation (PRD §12.3).

### 📊 Cost controls
- [ ] Per-task cost dashboards: Bedrock, Textract, Comprehend, SageMaker, Lambda (PRD §10.6).
- [ ] Nightly SageMaker training fires only if `training_labels` has >50 new since last run (PRD §16.3).

### 🧪 Test pyramid maintenance
- [ ] 70%+ unit coverage on `server/` (PRD §19.1).
- [ ] AI eval test blocks merges with >5% regression on resume fixtures (PRD §19.2).
- [ ] Pre-deploy shadow run: <10% disagreement vs prod model on last 200 predictions (PRD §19.3).

### 📝 Docs
- [ ] Per-repo `CLAUDE.md` enforces plan → execute → verify single-agent loop (PRD §20.3).
- [ ] Privacy policy + DPDP retention notice maintained quarterly (PRD §12.1, §16.12).

---

## Open questions / decisions needed (PRD §16)

- [ ] Confirm Bedrock Claude availability in `ap-south-1` at deploy time.
- [ ] Founder to approve initial comp bands before Phase 2 ships (otherwise auto-offer is partial).
- [ ] WhatsApp template wording (legal review).
- [ ] LinkedIn DM API access — decide go/no-go by week 10.
- [ ] AI audio interview opt-in copy + pilot scope (which roles).
- [ ] DPDP rule updates from MeitY — quarterly review.

---

*Last updated: 2026-05-08 (mirrors PRD v3.0).*
