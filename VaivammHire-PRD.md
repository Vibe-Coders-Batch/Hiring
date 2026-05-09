# VaivammHire — Product Requirements Document

**Owner:** Tarun Chintakunta
**Status:** Draft v3.0 (AWS-native, supersedes v2.0)
**Last updated:** 8 May 2026
**Reference benchmark:** [PureHire.ai](https://purehire.ai/) (functional clone, internal-only deployment)

---

## 1. Overview

**VaivammHire** is Vaivamm Capital Advisors' internal AI-powered recruitment platform. It's a public-facing branded careers site backed by an internal hiring console, deployed end-to-end on AWS at `hiring.vaivammcapital.com`. On hire, candidates sync to the Vaivamm CRM as onboarding records.

The product is built as **three parallel tracks**, all running on AWS:

- **Track A — Bedrock-powered v1 product.** Claude on AWS Bedrock + AWS Textract + AWS Comprehend handle the AI work. Ships in weeks.
- **Track B — Custom ML/NLP on SageMaker.** From day 1, every application + every HR action is captured as labeled training data. Custom models are trained on SageMaker, versioned in SageMaker Model Registry, and benchmarked against Bedrock.
- **Track C — v2 Agent.** Once Track B models match or beat Bedrock on accuracy/cost/latency, the v2 agent orchestrates *both* via a single Claude-driven tool-calling loop on Lambda.

Two surfaces:

1. **Admin app** — HR + hiring managers post jobs, get a shareable LinkedIn link, run the pipeline, approve offers.
2. **Candidate app** — public job board where any external applicant can browse and apply. Shareable URLs per job.

### 1.1 Why this structure

1. Bedrock + Claude gets us to production now. No separate Anthropic billing, all under AWS consolidated.
2. Vaivamm's own hiring data is the only data that reflects how *Vaivamm* hires. Every HR override is a high-quality label captured automatically.
3. AWS-managed services (Comprehend, Textract) cover the deterministic NLP grunt work cheaply from day 1; custom models replace them only when they pass a promotion gate.
4. Single cloud = single IAM, single billing, single observability stack, GitHub Actions deploys everything via one pipeline.

### 1.2 Core principle

> **HR is in control at every step. The AI is a copilot, not a replacement.**
> Pause auto-scheduling, override a screening decision, rewrite a draft offer letter — always one click away. **Every override is a training label.**

---

## 2. Goals & Non-Goals

### 2.1 Track A goals (Bedrock-powered v1)

- Public branded job board at `hiring.vaivammcapital.com`.
- Bedrock-powered resume parsing (Textract OCR + Claude on Bedrock for structured extraction) and JD-fit scoring with a transparent rubric.
- HR-controlled auto-shortlist threshold per role.
- Bedrock-drafted candidate emails (acknowledgement, screening result, scheduling, rejection, offer).
- Interview scheduling: agent proposes 3 slots from HR/hiring-manager Google Calendar.
- AI audio + AI video interview support via AWS Polly/Transcribe/Connect (Phase 3).
- Bedrock-drafted offer letters for roles with pre-approved comp bands.
- Visual kanban pipeline per role.
- Unified comms hub (email via SES + WhatsApp via Meta Cloud API + LinkedIn DM).
- Job-share link generator: every published job exposes a clean `https://hiring.vaivammcapital.com/jobs/[slug]` URL plus one-click LinkedIn share + direct post-to-LinkedIn-page option.
- Sync hired candidate (full record) to the Vaivamm CRM.
- 6-month retention with India DPDP-compliant delete-my-data flow.

### 2.2 Track B goals (Custom ML/NLP on SageMaker)

- Capture every application + every HR action as structured labeled data, day 1.
- A labeling workbench where HR can review and correct AI outputs in batches.
- Train and version 5 models on a rolling cadence: skill NER (M1), JD-fit classifier (M2), skill embeddings (M3), candidate dedup (M4), spam/quality classifier (M5).
- SageMaker Experiments for tracking; SageMaker Model Registry for versioning; S3 for data versioning via DVC.
- Eval harness comparing each custom model against Bedrock and Comprehend on (accuracy, cost-per-1000, latency).
- Model promotion gate: a custom model only goes into production traffic if it beats the incumbent (Bedrock or Comprehend) on at least 2 of 3 metrics without losing the third by more than 10%.
- First production-ready custom model (M1 NER) live by week 12.

### 2.3 Track C goals (v2 Agent — later)

- Single orchestrator agent (Claude on Bedrock) running on Lambda + Step Functions, routing each task to whichever backend wins on cost/latency/quality.
- Tool-calling architecture: every Track A action and every Track B model is exposed as a tool.
- Autonomy levels (suggest-only / low-stakes auto / full-autonomy-except-offers) carried over and per-tool tunable.

### 2.4 Non-Goals (all tracks, v1)

- Background verification integrations.
- Multi-tenancy / SaaS productisation. Single-tenant for Vaivamm Capital.
- Payroll, leave, attendance, post-onboarding HRMS functionality.
- Mobile native apps. Responsive web only.
- Cold sourcing via LinkedIn/Naukri scraping.
- Internal-mobility flow for Vaivamm employees (treated as external applicants in v1).

---

## 3. Users & Roles

| Role | Who | Capabilities |
|---|---|---|
| **Admin** | HR lead, founder | Full access. Manage users, comp bands, agent settings, integrations, model promotion gates. |
| **Recruiter / HR** | HR team | Create jobs, share links, review pipeline, override AI, approve offers, communicate, label data. |
| **Hiring Manager** | Internal employee owning a requisition | View open roles, see shortlists, schedule/conduct interviews, leave structured feedback. |
| **Interviewer** | Internal employee on a panel | View assigned candidate, leave structured feedback. |
| **ML Engineer (Tarun)** | You | Access to SageMaker Studio, model registry, training pipelines, eval dashboards. |
| **Candidate (external)** | Public applicant | Browse jobs, apply, track status, schedule interviews, complete assessments. |

---

## 4. Information Architecture

### 4.1 Public site (`hiring.vaivammcapital.com`)

```
/                          → Landing + featured roles
/jobs                      → All open jobs (filter: department, location, type)
/jobs/[slug]               → Job detail + Apply (this URL is what gets shared on LinkedIn)
/apply/[jobId]             → Application form (resume + screening Qs)
/track/[applicationId]     → Candidate self-serve status portal (magic-link)
/privacy                   → DPDP privacy policy
/delete-my-data            → DPDP self-serve deletion request
```

### 4.2 Internal app (`hiring.vaivammcapital.com/admin`)

```
/admin/dashboard           → KPIs (open roles, candidates in pipeline, time-to-hire, model quality)
/admin/jobs                → Job CRUD, AI JD generator, share-link panel
/admin/jobs/[id]/pipeline  → Kanban board for that role
/admin/candidates          → Global candidate search across roles
/admin/candidates/[id]     → Candidate 360 (resume, scores, comms, interviews, notes)
/admin/interviews          → Calendar of scheduled interviews
/admin/assessments         → Assessment templates (coding, MCQ, case study)
/admin/comp-bands          → Compensation bands per role/level
/admin/offers              → Offer letter queue (draft, pending approval, sent, signed)
/admin/communications      → Unified inbox (email + WhatsApp + LinkedIn)
/admin/agent               → Agent settings (autonomy level, model routing)
/admin/labeling            → Labeling workbench (Track B)
/admin/models              → Model registry, eval dashboards, promotion controls (Track B)
/admin/settings            → Users, integrations, retention, branding
```

---

## 5. Architecture Overview (AWS-native)

```
                       Internet (candidates + Vaivamm staff)
                                       │
                                       ▼
                         ┌──────────────────────────────┐
                         │  CloudFront (global CDN)     │
                         │  + AWS WAF + Turnstile       │
                         └──────────────┬───────────────┘
                                        │
                ┌───────────────────────┼──────────────────────┐
                │                       │                      │
                ▼                       ▼                      ▼
       ┌────────────────┐      ┌──────────────────┐   ┌──────────────────┐
       │ S3 (Next.js    │      │ Lambda@Edge /    │   │ API Gateway      │
       │ static assets) │      │ Lambda (Next.js  │   │ (HTTP API for    │
       │                │      │ SSR via OpenNext)│   │ webhooks)        │
       └────────────────┘      └────────┬─────────┘   └────────┬─────────┘
                                        │                      │
                                        ▼                      ▼
                              ┌──────────────────────────────────────┐
                              │  Lambda functions (tRPC handlers,    │
                              │  agent orchestration, jobs)          │
                              └─┬──────────┬──────────┬──────────┬───┘
                                │          │          │          │
                ┌───────────────┘          │          │          └──────────────┐
                ▼                          ▼          ▼                         ▼
       ┌──────────────────┐       ┌──────────────┐  ┌──────────────┐    ┌─────────────────┐
       │ RDS Aurora       │       │ S3           │  │ Secrets      │    │ EventBridge +   │
       │ Postgres         │       │ (resumes,    │  │ Manager      │    │ SQS + Step      │
       │ Serverless v2    │       │ offers,      │  │              │    │ Functions       │
       └──────────────────┘       │ training)    │  └──────────────┘    └────────┬────────┘
                                  └──────────────┘                                │
                                                                                  ▼
                                                                       ┌────────────────────┐
                                                                       │ Background workers │
                                                                       │ (Lambda)           │
                                                                       └─┬───────┬──────────┘
                                                                         │       │
                ┌────────────────────────────────────────────────────────┘       │
                │                                                                │
                ▼                                                                ▼
       ┌────────────────────────────────────────────┐         ┌─────────────────────────────────┐
       │  AWS Bedrock                               │         │  AWS Textract + Comprehend      │
       │  (Claude Sonnet/Opus, latest available)    │         │  (OCR + managed NER baseline)   │
       │                                            │         │                                 │
       │  Track A: parses, scores, drafts emails,   │         │  Track A: PDF→text, baseline    │
       │  drafts offers, generates JDs              │         │  entity extraction              │
       └────────────────────────────────────────────┘         └─────────────────────────────────┘
                                                                                  ▲
                                                                                  │
       ┌────────────────────────────────────────────┐                            │
       │  AWS SageMaker                             │  ← swaps in for Bedrock /  │
       │  (custom ML/NLP — Track B)                 │    Comprehend per task     │
       │                                            │    once promotion gate     │
       │  - SageMaker Training Jobs                 │    passes                  │
       │  - SageMaker Experiments (tracking)        │                            │
       │  - SageMaker Model Registry (versioning)   │                            │
       │  - SageMaker Endpoints OR Lambda+ONNX      │                            │
       │    (inference)                             │                            │
       └────────────────────────────────────────────┘
```

### 5.1 Two repos

```
vaivammhire-app/          ← Next.js 15 + tRPC + Drizzle (admin + candidate apps)
vaivammhire-ml/           ← Python + SageMaker training pipelines + inference Lambdas
```

They communicate over HTTP (private API Gateway). The app calls Bedrock/Textract/Comprehend or the ML inference Lambdas (or both) per task. The agent in v2 is the dispatcher.

### 5.2 Infra-as-code

A third folder, `vaivammhire-infra/`, holds **AWS CDK** (TypeScript) stacks that provision everything: VPC, RDS, S3, CloudFront, Lambda, IAM, Bedrock access policies, SageMaker resources. GitHub Actions deploys via `cdk deploy`.

---

## 6. Track A — Bedrock-Powered v1 Product

### 6.1 Jobs Management

| Feature | Behaviour |
|---|---|
| AI JD generation | HR enters role title + key responsibilities + level. Claude on Bedrock drafts a full JD using Vaivamm's tone-of-voice prompt. HR edits inline, then publishes. |
| **Shareable link** | Every published job exposes `https://hiring.vaivammcapital.com/jobs/[slug]`. Admin sees a "Share" panel with: Copy URL, Copy LinkedIn share intent (`linkedin.com/sharing/share-offsite?url=...`), Copy WhatsApp share, Copy as email signature. |
| **Direct LinkedIn post** | One-click "Post to Vaivamm LinkedIn page" via LinkedIn Marketing API. Generates a polished post with role title, summary, and the share URL. Requires Vaivamm's LinkedIn OAuth set up by Admin. |
| Status | Draft → Open → Paused → Closed. Closing auto-sends rejections to non-shortlisted candidates if HR opts in. |
| Screening questions | Up to 5 custom questions per job (Yes/No, short text, multi-select). |
| Hard filters | HR sets must-haves: min years experience, location, work-auth, must-have skills. Failing candidates auto-marked **Not a fit**. |

### 6.2 Candidate Application Flow

1. Candidate lands on `/jobs/[slug]` (often via LinkedIn).
2. Clicks **Apply** → `/apply/[jobId]`.
3. Single-page form: name, email, phone, LinkedIn (optional), resume upload (PDF/DOCX, max 5 MB → S3 via signed POST), screening Qs, DPDP consent checkbox.
4. On submit: confirmation page + magic-link email (SES) to `/track/[applicationId]`.
5. Background Lambda (triggered by S3 ObjectCreated event) fires the resume-parsing pipeline.

### 6.3 AI Resume Screening (Bedrock + Textract + Comprehend in v1)

Pipeline:

```
Resume in S3 → Textract (extract text, tables) → Comprehend (baseline NER)
            → Bedrock Claude (structured extraction + scoring against JD)
            → Scorecard saved to RDS + emitted as training_label event
```

Returned scorecard:

```json
{
  "overall_fit_score": 0-100,
  "breakdown": {
    "skills_match": { "score": 0-100, "reasoning": "..." },
    "experience_match": { "score": 0-100, "reasoning": "..." },
    "education_match": { "score": 0-100, "reasoning": "..." },
    "domain_alignment": { "score": 0-100, "reasoning": "..." }
  },
  "extracted": {
    "years_experience": "number",
    "skills": ["..."],
    "education": [{ "degree": "...", "institution": "...", "year": 2024 }],
    "current_role": "...",
    "current_company": "...",
    "location": "...",
    "salary_expectation": "if mentioned"
  },
  "red_flags": ["short tenures", "gaps", "skills mismatch"],
  "agent_recommendation": "shortlist | review | reject",
  "rationale": "2-3 sentence summary visible to HR"
}
```

**LLM:** Claude on Bedrock — use the latest available model (currently Claude Sonnet/Opus 4.x, verified at deploy time via `aws bedrock list-foundation-models --by-provider anthropic`).

**Auto-shortlist:** HR sets per-role threshold (default: 75). Above → auto-promoted to **Shortlisted** + scheduling email triggered. Below → sits in **AI Screened** for HR review.

HR can override on any candidate with one-click **Promote** or **Reject** + reason. **Every override is logged as a training label** (see §7.4).

### 6.4 Pipeline Stages (default)

```
Applied → AI Screened → HR Review → Shortlisted → Interview 1 (HR/Phone) →
Assignment (optional) → Interview 2 (Hiring Manager) → Interview 3 (Founder, optional) →
Reference Check → Offer → Hired
                              ↘ Rejected / On-hold
```

Stages are drag-and-drop reorderable per job. Each stage transition emits an event to EventBridge for the audit/labeling pipeline.

### 6.5 Interview Module

| Feature | Behaviour |
|---|---|
| Scheduling | Agent reads HR/hiring-manager Google Calendar (via stored OAuth refresh tokens in Secrets Manager), proposes 3 free 45-min slots, emails candidate via SES. Candidate clicks → event on both calendars + Meet link. |
| Reminders | Auto SMS (SNS) + email (SES) 24h and 1h before. |
| AI question bank | Per role, Bedrock generates behavioural + technical questions from the JD, shown to interviewer 5 minutes before. |
| Structured feedback | Post-interview, interviewer fills 5-criterion rubric (Skills, Communication, Domain, Culture, Recommendation). Free text optional. |
| AI Audio Interview | **AWS Connect** places the call. **AWS Polly** speaks Bedrock-generated questions. **AWS Transcribe** captures responses. Bedrock scores. **Phase 3.** |
| AI Video Interview | Async: candidate records video answers on a branded page (MediaRecorder → S3). Transcribe handles audio. Bedrock scores. **Phase 3.** |

### 6.6 Assessments

- HR creates templates: MCQ, coding (hidden test cases run in a Lambda sandbox), case study (long-form upload to S3).
- Auto-sent when candidate enters **Assignment** stage.
- MCQ + coding auto-graded; case studies AI-summarised by Bedrock for HR.

### 6.7 Compensation Bands

Built-from-scratch admin screen:

| Field | Type |
|---|---|
| Role family | enum (Engineering, Wealth Advisory, Operations, Marketing, Finance, etc.) |
| Level | enum (Intern, L1, L2, L3, L4, Lead, Manager) |
| Location | enum (Hyderabad, Remote India, UAE) |
| Fixed CTC (min, max) | INR or AED |
| Variable / Bonus | percentage of fixed |
| ESOPs | optional, INR equivalent |
| Approval status | Draft / Approved by founder |

The agent only auto-drafts offers for **role + level + location** combinations marked **Approved**.

### 6.8 Offer Letters

| Step | Behaviour |
|---|---|
| Trigger | Candidate moves to **Offer** stage. |
| Draft | Bedrock fills a Vaivamm-branded letter template; rendered to PDF via headless Chromium on Lambda; stored in S3. |
| Approval | Draft enters HR's queue. One-click **Approve & Send** or **Edit**. |
| Send | Candidate receives PDF + e-signature link via Documenso (self-hosted on ECS Fargate) or DocuSign. |
| Tracking | Sent / Viewed / Signed / Declined statuses on candidate record. |
| On signature | Candidate auto-promoted to **Hired**. CRM sync triggers via EventBridge. |

### 6.9 Communication Hub

Unified inbox: email (SES inbound + outbound), WhatsApp (Meta Cloud API), LinkedIn (DM API, Phase 3).

Outbound messages are Bedrock-drafted with HR's tone preferences (formal, wealth-management appropriate). HR edits before sending or enables **Auto-send** for low-stakes templates.

### 6.10 Visual Pipeline (Kanban)

Per-role board. Columns are pipeline stages. Cards show: name, AI score badge, days-in-stage, last action. Drag a card → agent triggers the corresponding action (e.g., dragging to **Rejected** opens an editable rejection email modal).

### 6.11 Candidate Self-Serve Portal

Magic-link page at `/track/[applicationId]`: see stage, ETA, pick interview slots, upload assessments, request data deletion (DPDP).

---

## 7. Track B — Custom ML/NLP on SageMaker

### 7.1 The five models

| # | Model | Purpose | Algorithm | Beats incumbent on |
|---|---|---|---|---|
| **M1** | **Resume NER** | Extract skills, companies, titles, dates, education, certifications | spaCy v3 + fine-tuned `distilbert-base-cased`, trained on SageMaker | cost vs Bedrock (10-50× cheaper); accuracy vs Comprehend |
| **M2** | **JD-Fit Classifier** | Predict overall_fit_score (0-100) and shortlist/reject decision | LightGBM on engineered features + cross-encoder embeddings | latency, cost vs Bedrock; accuracy parity once data > 2k apps |
| **M3** | **Skill Embeddings** | Map any skill string to a 384-d vector ("React.js" ≈ "ReactJS" ≈ "React") | `sentence-transformers/all-MiniLM-L6-v2` fine-tuned on O*NET + ESCO + Vaivamm pairs | cost, latency vs Bedrock embeddings |
| **M4** | **Candidate Dedup** | Detect same person applying multiple times | MinHash + LSH on resume text + exact match on (email, phone). No training needed for v1. | always (deterministic, no API call) |
| **M5** | **Spam/Quality Classifier** | Filter bot applications, gibberish resumes, off-topic CVs | XGBoost on engineered features (length, formatting, domain reputation, skill density) | cost — runs at the edge before Bedrock is called |

**Deferred to v2 (need more data):**
- Interview-to-hire predictor
- Offer-acceptance predictor
- Attrition risk predictor (post-hire, lives in CRM)
- Salary expectation predictor (sensitive, low signal)

### 7.2 Training data sources

| Source | Volume | Use |
|---|---|---|
| **Vaivamm proprietary** | 0 day 1, growing daily | Gold-standard labels. HR overrides + structured feedback drive most training signal. |
| **Public datasets** | Bootstrap: ~5k labeled resumes | Cold start. Kaggle resume dataset, HuggingFace `bhadresh-savani/resume-classification`, etc. |
| **O*NET + ESCO** | ~30k skills, ~1k occupations | Skill taxonomy + embedding training pairs. |
| **Synthetic (Bedrock-generated)** | As needed | Generate (resume, JD, fit_score) triples for cold start. HR spot-checks 5%. |
| **Test fixtures (provided by Tarun)** | 20-50 sample resumes | Bundled into `tests/fixtures/resumes/` for end-to-end tests + initial QA. |

### 7.3 Data labeling — passive capture from HR actions

Every HR action becomes a structured label without HR doing extra work:

| HR action | Label generated | Trains which model |
|---|---|---|
| Override AI shortlist (Promote/Reject) | (resume, jd, decision) → binary fit label | M2 |
| Edit AI-extracted skill | (resume_span, skill_tag) → NER label | M1 |
| Edit AI-extracted company/title/date | (resume_span, entity_tag) → NER label | M1 |
| Mark candidate as duplicate | (cand_a, cand_b, is_dup) → dedup label | M4 |
| Final hire decision | (resume, jd, hired) → strong fit label | M2 (high weight) |
| Interview feedback rating | (resume, jd, interview_score) → ranking label | M2 |
| Mark resume as spam/bot | (resume, is_spam) → binary label | M5 |
| Drag card to a stage | (resume, jd, stage_reached) → ordinal label | M2 |

Every label is written to a `training_labels` table with full provenance. Nightly Lambda exports anonymised snapshots to S3 (DVC-tracked).

### 7.4 Labeling workbench (`/admin/labeling`)

- **Active queue:** the 20 candidates the model is least confident about. HR labels in batch.
- **Disagreement queue:** the 20 candidates where Bedrock and the custom model disagree most. HR adjudicates — the most informative labels.
- **Random sample queue:** 5 random candidates per week for unbiased eval.
- **Bulk label upload:** HR uploads a CSV of (resume_id, decision) pairs for historical resumes.

### 7.5 Training pipeline (SageMaker)

```
S3 (raw + labeled data, DVC-tracked)
        │
        ▼
SageMaker Pipeline (defined in vaivammhire-ml/pipelines/)
        │
        ├── Preprocess step (Processing Job)
        ├── Train step (Training Job, GPU on demand)
        ├── Evaluate step (against frozen golden set)
        └── Register step (SageMaker Model Registry, status = "PendingManualApproval")
        │
        ▼
Eval report → posted to /admin/models
        │
        ▼
HR clicks "Approve" → status = "Approved" → deploy step (Lambda updates inference endpoint)
```

**Cadence:** GitHub Actions runs the SageMaker Pipeline nightly when `training_labels` has > 50 new labels since the last run.

**Compute:**
- Training: SageMaker Training Jobs on `ml.g5.xlarge` (~$1.21/hr for fine-tuning small transformers).
- Inference: Lambda + ONNX Runtime for cheap CPU inference. SageMaker Endpoints only if a model needs GPU at inference time.

### 7.6 Experiment tracking + versioning

| Concern | Tool |
|---|---|
| Experiment tracking | **SageMaker Experiments** (params, metrics, artifacts per run) |
| Model versioning | **SageMaker Model Registry** (semver, lineage, approval status) |
| Data versioning | **DVC** with S3 remote (training data + checkpoints) |
| Code | Git (training scripts, configs, eval harness) |
| Reproducible envs | SageMaker pre-built containers + custom Docker images in ECR |

### 7.7 Eval harness

A frozen golden set of 200 HR-labeled examples lives in `eval/golden_set.jsonl` (S3-hosted). Every nightly training run computes:

| Metric | Incumbent (Bedrock or Comprehend) | Custom (SageMaker) | Winner |
|---|---|---|---|
| Accuracy / F1 / precision / recall | measured | measured | higher |
| Cost per 1000 inferences | measured (AWS Cost Explorer tag) | measured (Lambda/SageMaker billing) | lower |
| p50 latency | measured | measured | lower |
| p95 latency | measured | measured | lower |
| HR-agreement rate (rolling 30-day) | measured | measured | higher |

**Promotion gate (custom model → prod):**
- Must beat the incumbent on **at least 2 of 3** of (accuracy, cost, p95 latency).
- Must not lose on the 3rd by more than **10%**.
- HR-agreement rate must be within 5 points of the incumbent.
- Fairness eval (§12.2) must pass.

Until a custom model passes the gate, the incumbent handles 100% of that task in production. After passing, traffic shifts to custom, with the incumbent kept as a shadow runner for ongoing eval.

### 7.8 Production serving

ML inference Lambdas behind a private API Gateway:

```
POST /v1/parse-resume       → M1 — returns structured fields
POST /v1/score-fit          → M2 — returns 0-100 + breakdown
POST /v1/embed-skill        → M3 — returns 384-d vector
POST /v1/dedup-check        → M4 — returns list of likely duplicates
POST /v1/spam-check         → M5 — returns 0-1 spam probability
GET  /v1/health             → liveness + currently-deployed model versions
GET  /v1/models             → list of (model, version, deployed_at, eval_metrics)
```

Each endpoint is a Lambda function with the model artifact loaded from EFS (mounted) or S3 (cached on cold start). ONNX Runtime for CPU inference. p95 latency target: <500ms.

---

## 8. Track C — v2 AI Agent (later)

Once at least M1 (NER) and M2 (JD-Fit) are in prod, build the orchestrator.

**Pattern:** single Claude-on-Bedrock agent loop using Bedrock Converse API's tool-calling. Hosted on Lambda (synchronous, short-running) + Step Functions (long-running multi-step workflows).

```python
tools = [
    # Track B (cheap, fast, narrow) — Lambda calls
    parse_resume_local,        # M1
    score_fit_local,           # M2
    embed_skill_local,         # M3
    dedup_check_local,         # M4
    spam_check_local,          # M5

    # Track A (Bedrock — for reasoning, drafting, edge cases)
    draft_email,
    draft_offer_letter,
    generate_jd,
    explain_rejection,

    # Tools (deterministic actions)
    propose_interview_slots,
    schedule_interview,
    move_stage,
    send_email,
    flag_for_human,
]
```

**Routing logic:** the agent's system prompt describes when to use each. For high-volume tasks (parsing, scoring, dedup), prefer local models. For language-quality tasks (drafting, explanation), use Bedrock.

**Autonomy levels** (per role, set by HR):

1. **Suggest only** — agent drafts; HR approves every action.
2. **Auto for low-stakes** — agent auto-sends acknowledgements, scheduling, reminders. HR approves shortlists, offers, rejections.
3. **Full autonomy except offers** — agent runs the pipeline. HR approves only offers.

Default at v2 launch: **Level 2**. HR can dial up per-role.

---

## 9. Data Model

```ts
// Drizzle schema sketch (TypeScript app side, RDS Postgres)

users        { id, email, name, role: enum, cognitoSub, createdAt }
jobs         { id, slug, title, department, level, location, type, status, jdMarkdown,
               screeningQuestions: jsonb, hardFilters: jsonb, autoShortlistThreshold,
               agentAutonomy: enum, shareLinks: jsonb, linkedinPostId, createdBy, createdAt }
candidates   { id, name, email, phone, linkedin, resumeS3Key, parsedData: jsonb,
               consentDpdp: boolean, dedupKeys: text[], createdAt }
applications { id, jobId, candidateId, stage: enum, scoreCard: jsonb,
               agentRecommendation: enum, hrOverride: jsonb, lastActionAt }
interviews   { id, applicationId, panelIds: text[], scheduledAt, type: enum,
               meetLink, status: enum, feedback: jsonb }
assessments  { id, type: enum, templateBlob: jsonb, jobId }
submissions  { id, applicationId, assessmentId, content, score, gradedAt }
offers       { id, applicationId, draftPdfS3Key, approvedBy, signedAt, signedPdfS3Key }
comp_bands   { id, roleFamily, level, location, fixedMin, fixedMax,
               variablePct, esopsInr, approved: boolean }
communications { id, applicationId, channel: enum, direction: enum,
                 subject, body, sentAt, openedAt, repliedAt }
audit_log    { id, actorType: enum (human|agent|model), actorId, action,
               targetType, targetId, payload: jsonb, at }

// Track B-specific tables — the dataset
training_labels {
  id, modelTarget: enum (M1-M5), inputRef: jsonb, label: jsonb,
  source: enum (hr_override, hr_explicit, hire_outcome, synthetic, public),
  labeler: id (user) | null, aiPrediction: jsonb, createdAt
}

model_runs {
  id, modelName, version, trainedAt, trainingDataSnapshotId,
  hyperparams: jsonb, evalMetrics: jsonb,
  status: enum (training, staging, prod, archived),
  sageMakerModelArn, promotedAt, promotedBy
}
```

**Critical:** `audit_log` and `training_labels` are append-only. Archive to S3 Glacier after 18 months.

---

## 10. Tech Stack (AWS-native)

### 10.1 Compute & frontend

| Layer | Choice | Notes |
|---|---|---|
| Frontend framework | Next.js 15 (App Router) + React 19 | Same codebase serves public + admin |
| Deployment | **OpenNext on AWS Lambda + CloudFront** | Full SSR/ISR support |
| IaC framework | **AWS CDK** (TypeScript) | Single language as the app |
| Static assets | **S3 + CloudFront** | Versioned, immutable cache headers |
| API | tRPC (admin) + API Gateway HTTP API (public webhooks) | tRPC handlers run on Lambda |
| Background jobs | **EventBridge + SQS + Step Functions + Lambda** | Replaces Inngest |

### 10.2 Data

| Layer | Choice | Notes |
|---|---|---|
| Primary DB | **RDS Aurora Postgres Serverless v2** | Scales to zero overnight; pgvector enabled |
| ORM | **Drizzle** | Same as CRM |
| File storage | **S3** | Resumes, offer PDFs, training data, model artifacts |
| Caching | **ElastiCache (Redis)** | Optional v1.5 for hot job listings |
| Search | Postgres full-text initially; OpenSearch in v2 if needed | |

### 10.3 AI services (AWS-native)

| Service | Purpose |
|---|---|
| **Bedrock — Claude (Sonnet/Opus, latest)** | All LLM tasks: resume scoring, JD generation, email/offer drafting, agent reasoning |
| **Bedrock — Titan Embeddings G1** | Default embedding model (replaceable by M3 once promoted) |
| **Textract** | OCR + structure extraction from resume PDFs/DOCXs |
| **Comprehend** | Baseline NER for skills/orgs/locations/dates |
| **SageMaker** | Training, model registry, experiments — for Track B custom models |
| **Polly** | TTS for AI audio interviews (Phase 3) |
| **Transcribe** | STT for AI audio + video interviews (Phase 3) |
| **Connect** | Outbound calling for AI audio interviews (Phase 3) |

### 10.4 Auth, identity, security

| Layer | Choice |
|---|---|
| Admin auth | **AWS Cognito** (User Pool, Hosted UI, MFA mandatory) |
| Candidate auth | **Cognito with passwordless email magic-link** |
| Service-to-service auth | **IAM roles + SigV4 signed requests** |
| Secrets | **AWS Secrets Manager** (Google OAuth tokens, LinkedIn OAuth, Documenso API keys, etc.) |
| WAF | **AWS WAF** in front of CloudFront with managed rule sets |
| Captcha | **Cloudflare Turnstile** (free, runs at the edge) |

### 10.5 Comms & integrations

| Channel | Service |
|---|---|
| Transactional email | **AWS SES** (replaces Resend) |
| SMS | **AWS SNS** |
| WhatsApp | **Meta Cloud API** (no AWS-native equivalent) |
| LinkedIn DMs | **LinkedIn API** (Phase 3) |
| Calendar | **Google Calendar API** + **Google Meet** |
| E-signature | **Documenso** (self-hosted on ECS Fargate) or **DocuSign** |

### 10.6 Observability

| Concern | Tool |
|---|---|
| Logs | **CloudWatch Logs** with metric filters |
| Metrics | **CloudWatch Metrics** + custom dashboards |
| Traces | **AWS X-Ray** |
| Errors | **CloudWatch + AWS Chatbot** posting to a Slack channel |
| Cost monitoring | **AWS Cost Explorer** with per-component tags + budget alerts |
| Uptime monitoring | **CloudWatch Synthetics** canaries hitting `/jobs` and `/admin/dashboard` |

---

## 11. Repo Structure

```
vaivammhire-app/                          ← Track A (TypeScript / Next.js)
├── app/
│   ├── (public)/                         ← Public site routes
│   ├── (admin)/                          ← Admin app routes
│   └── api/                              ← Webhooks, public form submit
├── components/
│   ├── ui/                               ← shadcn/ui primitives + custom
│   ├── admin/
│   └── public/
├── server/
│   ├── trpc/
│   ├── db/                               ← Drizzle schema + migrations
│   ├── services/
│   │   ├── bedrock.ts                    ← Bedrock SDK wrapper
│   │   ├── textract.ts
│   │   ├── comprehend.ts
│   │   ├── ml-api.ts                     ← Calls Track B inference Lambdas
│   │   ├── router.ts                     ← Picks Bedrock vs Comprehend vs custom per task
│   │   └── ...
│   ├── agents/                           ← Track C lives here in v2
│   └── jobs/                             ← Step Functions workflows + Lambda handlers
├── styles/
│   └── tokens.css                        ← Design tokens (colors, type, motion)
├── tests/
│   ├── unit/                             ← Vitest
│   ├── e2e/                              ← Playwright
│   └── fixtures/
│       └── resumes/                      ← Test PDFs/DOCXs (Tarun-provided)

vaivammhire-ml/                           ← Track B (Python / SageMaker)
├── data/                                 ← DVC-tracked, S3 remote
├── models/
│   ├── ner/                              ← M1
│   ├── fit_classifier/                   ← M2
│   ├── embeddings/                       ← M3
│   ├── dedup/                            ← M4
│   └── spam/                             ← M5
├── eval/
│   ├── golden_set.jsonl
│   └── run_eval.py
├── pipelines/                            ← SageMaker Pipeline definitions
├── inference/                            ← Lambda handlers (one per model)
├── containers/                           ← Custom Docker images for SageMaker (push to ECR)
├── notebooks/                            ← Exploration only
├── pyproject.toml
└── README.md

vaivammhire-infra/                        ← AWS CDK
├── bin/
│   └── vaivammhire.ts                    ← CDK app entrypoint
├── lib/
│   ├── network-stack.ts                  ← VPC, subnets
│   ├── data-stack.ts                     ← RDS, S3, Secrets
│   ├── compute-stack.ts                  ← Lambda, API Gateway, Step Functions
│   ├── frontend-stack.ts                 ← OpenNext deployment, CloudFront
│   ├── ai-stack.ts                       ← Bedrock IAM, SageMaker resources
│   ├── auth-stack.ts                     ← Cognito User Pools
│   └── observability-stack.ts            ← CloudWatch dashboards, alarms
├── cdk.json
└── package.json
```

---

## 12. Privacy, Security, Compliance

### 12.1 India DPDP Act compliance

- Explicit consent checkbox: "I consent to Vaivamm Capital processing this data for recruitment purposes, including AI-based screening, **and to use of anonymised data for model training**."
- Privacy policy at `/privacy`.
- Self-serve deletion at `/delete-my-data` (magic-link verified). Cascades resume blob (S3 delete), parsed data (RDS), communications, scorecards. Audit log kept (anonymised) for 12 months for legal defence.
- 6-month auto-purge of rejected-candidate records via scheduled Lambda. HR can extend per candidate with one click.

### 12.2 Training data ethics

- Resumes used for training are **anonymised** before they enter `data/`: name, email, phone, address, LinkedIn URL stripped via Comprehend PII detection. Skills, experience, education preserved.
- Nightly Lambda exports anonymised label snapshots to S3 (DVC-tracked).
- Models never train on data from a candidate who has invoked `/delete-my-data`.
- No protected-attribute features in any model: no inference on gender, caste, religion, age.
- Quarterly fairness eval: M2 (JD-Fit) tested for disparate impact across inferred gender (from name, via Comprehend) and education tier. **Failing models cannot be promoted.**

### 12.3 Security

- S3 resume URLs are signed, short-TTL (15-min) with `s3:GetObject` only.
- Admin app behind Cognito; MFA mandatory for Admin role.
- All PII encrypted at rest (RDS encryption + S3 SSE-KMS).
- ML API behind private API Gateway, IAM-authenticated. No public access.
- Rate-limit application form (10/IP/hour via WAF) + Cloudflare Turnstile captcha.
- Secrets Manager for all third-party tokens; rotated quarterly via Lambda.

### 12.4 Audit

Every agent action, every HR override, every model prediction is in `audit_log` with full payload. HR can export per-candidate audit log as a PDF for defence in disputed rejections.

---

## 13. CRM Integration (on-hire sync)

**Trigger:** candidate signs the offer (Documenso/DocuSign webhook → application stage = `Hired`) → EventBridge event → CRM sync Lambda.

**Push to Vaivamm CRM:**

```json
{
  "name": "...", "email": "...", "phone": "...",
  "role": "...", "department": "...", "level": "...", "location": "...",
  "joining_date": "...",
  "ctc": { "fixed": "...", "variable": "...", "esops": "..." },
  "reporting_manager_id": "...",
  "vaivammhire_application_id": "...",
  "documents": {
    "resume_url": "...",
    "signed_offer_letter_url": "...",
    "interview_scorecards": [ ... ],
    "ai_screening_scorecard": { ... },
    "communications_thread": [ ... ]
  }
}
```

REST webhook to `POST https://crm.vaivammcapital.com/api/onboarding`, authenticated with HMAC. Idempotent on `vaivammhire_application_id`. Retried via SQS DLQ on failure.

---

## 14. Success Metrics

### 14.1 Product (Track A)

| Metric | Target after 90 days |
|---|---|
| Time-to-hire (apply → offer accepted) | Down 50% vs current baseline |
| HR hours per hire | Down 60% (target: < 4 hours human time per hire) |
| Resume-to-shortlist conversion accuracy (HR agreement with AI) | > 85% |
| Candidate NPS (single-question post-process) | > 40 |
| Offer acceptance rate | Maintained or improved |
| Agent autonomy adopted by HR after 30 days | ≥ Level 2 on at least 70% of roles |

### 14.2 ML (Track B)

| Metric | Target |
|---|---|
| First model in prod (M1 NER) | Week 12 |
| All 5 models trained at v0.1 | Week 16 |
| Models passing promotion gate vs incumbent | At least 2 by week 20 |
| Labeled examples in `training_labels` | 1000+ by week 12; 5000+ by week 24 |
| Cost per 1000 resume parses (after M1 prod) | < 25% of Bedrock-only baseline |
| HR-agreement rate of M2 (JD-Fit) | within 5 pts of Bedrock by week 20 |

### 14.3 Agent (Track C)

| Metric | Target |
|---|---|
| Agent v2 launch | Week 24 |
| Tasks routed to local models | > 70% of high-volume tasks (parsing, scoring) |
| End-to-end cost per hire (LLM + ML) | < 50% of Track A-only baseline |

---

## 15. Phased Rollout

```
Week        Track A (product)              Track B (ML)              Track C (agent)
─────       ──────────────────             ──────────────             ────────────────
1-2         CDK infra: VPC, RDS, S3,       ML repo scaffolded,
            Cognito, CloudFront.           SageMaker Studio set up,
            Public job board scaffold.     public datasets ingested

3-4         Apply form, Textract+          Synthetic data gen via
            Bedrock resume screening,      Bedrock (5k pairs),
            basic kanban, HR override.     M5 spam baseline trained.
            Job share-link panel +
            LinkedIn share intent.

5-6         Auto-scheduling, Google        M1 NER trained on
            Cal integration, SES email     public + synthetic,
            comms, AI JD generator.        held-out eval established.
            Migrate GH Actions to
            OIDC.

7-8         Comp bands admin,              M3 skill embeddings
            Documenso e-sign,              trained, deployed
            Bedrock offer drafts.          behind feature flag.

9-10        WhatsApp channel, CRM          Labeling workbench live,
            sync on hire, assessments.     HR labels first batches.

11-12       AI question bank,              M1 → prod (passes gate),
            interview feedback             M2 baseline trained on
            rubric.                        real Vaivamm data.

13-16       AI audio interviews via        M2 v0.2 with HR labels,
            Polly+Transcribe+Connect,      M4 dedup deployed.
            AI video interviews (async).

17-20       Polish, comms hub UI,          M2 promotion gate
            comms automations.             evaluation ongoing.            v2 agent design.

21-24       —                              Quarterly fairness eval.       v2 agent build
                                                                          + launch on Lambda.
```

**Hard milestone gates:**
- End of week 4: HR can hire someone end-to-end through the system (Track A only).
- End of week 12: First custom model (M1 NER) live in prod.
- End of week 24: v2 agent live, custom models handle majority of high-volume tasks.

---

## 16. Open Questions / Risks

1. **Cold-start data shortage.** Synthetic data (5k from Bedrock) + active learning to maximise label efficiency.
2. **Bedrock model availability per region.** Verify Mumbai (`ap-south-1`) supports Claude before committing; if not, fall back to Singapore (`ap-southeast-1`) for AI calls only and keep data layer in Mumbai for DPDP locality.
3. **SageMaker training cost overrun.** Set a hard monthly budget alarm at $300; nightly training only fires if labels > 50 new.
4. **AI audio interview UX.** Indian candidates may be uncomfortable with AI voice. Recommend opt-in only; pilot on tech roles.
5. **LinkedIn DM API access.** Gated. If blocked, drop the LinkedIn channel and rely on email + WhatsApp.
6. **Comp band coverage.** Founder must approve bands before Phase 2 ships, otherwise auto-offer is partial.
7. **Hallucinated extractions in v1.** Surface raw Textract output alongside Bedrock extraction in candidate 360 so HR can spot-check (and produce labels for M1).
8. **Calendar conflicts.** Always propose 3 slots, never auto-book a single one.
9. **WhatsApp Cloud API approval.** Meta requires business verification + pre-approved templates. Add 1-2 weeks for approval.
10. **Model promotion overconfidence.** Shadow incumbent alongside in-prod custom models for 2 weeks before fully switching.
11. **Fairness regressions.** Hard gate, not soft.
12. **Regulatory drift (DPDP rules).** Subscribe to MeitY updates; review consent + retention quarterly.

---

## 17. Deployment & CI/CD

### 17.1 GitHub Actions secrets

Two phases:

**Phase 1 — Quick start (long-lived keys, weeks 1-5):**
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- IAM user attached to a `VaivammHireDeployer` policy with least-privilege scope.

**Phase 2 — Production-grade (OIDC, week 6 onwards):**
- Configure GitHub OIDC provider in AWS IAM.
- Create role `VaivammHireGithubDeployer` trusted by `repo:vaivammcapital/*:*`.
- GitHub Actions assumes the role per workflow run; no static keys.
- Recommended; the access-key approach above stays as the documented fallback.

Other secrets in GitHub Actions (or Secrets Manager, mirrored via SSM):
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`
- `WHATSAPP_BUSINESS_TOKEN`
- `DOCUMENSO_API_KEY`
- `TURNSTILE_SECRET_KEY`

### 17.2 Workflows

```
.github/workflows/
├── ci.yml                    ← Lint, type-check, unit tests, on every PR
├── e2e.yml                   ← Playwright E2E on PR + main
├── deploy-staging.yml        ← Deploy to staging on push to main
├── deploy-prod.yml           ← Deploy to prod on tagged release
├── ml-train.yml              ← Nightly SageMaker pipeline kickoff (cron)
├── ml-eval.yml               ← Eval custom models vs incumbent (post-train)
└── rotate-secrets.yml        ← Quarterly rotation of third-party tokens
```

**`deploy-prod.yml` (sketch):**

```yaml
name: Deploy Production
on:
  release:
    types: [published]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write   # for OIDC (Phase 2)
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::ACCOUNT:role/VaivammHireGithubDeployer
          aws-region: ap-south-1
          # OR for Phase 1:
          # aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          # aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit
      - run: pnpm build
      - run: pnpm cdk deploy --all --require-approval never
      - run: aws cloudfront create-invalidation --distribution-id $CF_DIST_ID --paths "/*"
```

### 17.3 Environments

- `dev` — Tarun's machine, points to a personal AWS account or a dev sub-account.
- `staging` — Auto-deploy on push to `main`. Domain: `staging.hiring.vaivammcapital.com`.
- `prod` — Deploy on tagged release. Domain: `hiring.vaivammcapital.com`.

Each environment is a separate CDK app context with isolated resources.

---

## 18. Design System

### 18.1 Color tokens

**Primary (Indigo)**

| Token | Hex |
|---|---|
| `primary-50` | `#EEF2FF` |
| `primary-100` | `#E0E7FF` |
| `primary-200` | `#C7D2FE` |
| `primary-300` | `#A5B4FC` |
| `primary-400` | `#818CF8` |
| `primary-500` (main) | `#6366F1` |
| `primary-600` | `#4F46E5` |
| `primary-700` | `#4338CA` |
| `primary-800` | `#3730A3` |
| `primary-900` | `#312E81` |

**Neutrals (Slate)**

| Token | Hex |
|---|---|
| `neutral-50` | `#F8FAFC` |
| `neutral-100` | `#F1F5F9` |
| `neutral-200` | `#E2E8F0` |
| `neutral-300` | `#CBD5E1` |
| `neutral-400` | `#94A3B8` |
| `neutral-500` | `#64748B` |
| `neutral-600` | `#475569` |
| `neutral-700` | `#334155` |
| `neutral-800` | `#1E293B` |
| `neutral-900` | `#0F172A` |

**Semantic**

| Family | 50 | 500 | 600 | 700 |
|---|---|---|---|---|
| Success (Green) | `#ECFDF5` | `#10B981` | `#059669` | `#047857` |
| Warning (Amber) | `#FFFBEB` | `#F59E0B` | `#D97706` | `#B45309` |
| Error (Red) | `#FEF2F2` | `#EF4444` | `#DC2626` | `#B91C1C` |
| Info (Sky) | `#F0F9FF` | `#0EA5E9` | `#0284C7` | `#0369A1` |

### 18.2 Quick UI tokens

| Use | Token |
|---|---|
| Background | `#F8FAFC` (`neutral-50`) |
| Surface (cards) | `#FFFFFF` |
| Border | `#E2E8F0` (`neutral-200`) |
| Text primary | `#0F172A` (`neutral-900`) |
| Text secondary | `#475569` (`neutral-600`) |
| Primary button bg | `#4F46E5` (`primary-600`) |
| Primary button hover | `#4338CA` (`primary-700`) |
| Link | `#4F46E5` (`primary-600`) |

### 18.3 Typography

- **Font family:** `Inter` (variable). Fallback: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Loaded via `next/font/google` for self-hosting + zero CLS.
- **Base size:** 16px / 1rem. Line-height: 1.5.
- **Headings weight:** 600. Body weight: 400. Emphasis: 500. Display: 700 (rare).
- **Type scale:**

| Class | Size | Line-height | Use |
|---|---|---|---|
| `text-display` | 48px / 3rem | 1.1 | Landing hero |
| `text-h1` | 36px / 2.25rem | 1.2 | Page titles |
| `text-h2` | 30px / 1.875rem | 1.25 | Section titles |
| `text-h3` | 24px / 1.5rem | 1.3 | Card titles |
| `text-h4` | 20px / 1.25rem | 1.4 | Subsections |
| `text-body` | 16px / 1rem | 1.5 | Default |
| `text-small` | 14px / 0.875rem | 1.5 | Metadata |
| `text-tiny` | 12px / 0.75rem | 1.4 | Captions, badges |

### 18.4 Spacing & layout

- 4px base unit. Scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96.
- Container widths: `max-w-7xl` (1280px) admin; `max-w-5xl` (1024px) public marketing pages.
- Border radius: `4px` (inputs), `8px` (buttons, cards), `12px` (modals), `16px` (large surfaces). Round avatars only.
- Shadows: subtle and consistent.
  - `shadow-sm`: `0 1px 2px rgba(15, 23, 42, 0.04)`
  - `shadow-md`: `0 4px 12px rgba(15, 23, 42, 0.06)`
  - `shadow-lg`: `0 12px 32px rgba(15, 23, 42, 0.08)`

### 18.5 Component library

- **shadcn/ui** as primitives (Radix under the hood — accessible by default, A11y-compliant).
- All components themed via the tokens above. Every primitive customised once; never use raw Radix without the Vaivamm theme wrapper.
- Build a `components/ui/` folder; nothing in `app/` reaches into Radix directly.
- Storybook for visual review (optional v1, recommended v1.5).

### 18.6 Motion (Framer Motion)

| Use | Spec |
|---|---|
| Page transition | Fade + 8px slide-up, 220ms `cubic-bezier(0.16, 1, 0.3, 1)` |
| Card hover | Lift 2px + shadow `sm → md`, 150ms `ease-out` |
| Button hover | Bg shift, 120ms `ease-out`. No scale transforms — feels gimmicky |
| Modal enter | Backdrop fade 180ms; modal scale 0.96 → 1, fade, 220ms `cubic-bezier(0.16, 1, 0.3, 1)` |
| Modal exit | Reverse, 160ms `ease-in` |
| Toast | Slide-in from top 250ms `cubic-bezier(0.22, 1, 0.36, 1)`; auto-dismiss 4s; exit 180ms |
| Drawer (sheet) | Slide-in from right 280ms `cubic-bezier(0.22, 1, 0.36, 1)` |
| Skeleton loaders | 1.5s linear infinite shimmer with `neutral-100 → neutral-200 → neutral-100` |
| Kanban card drag | `dnd-kit` defaults; drop animation 200ms |
| Stage transitions in pipeline | Stagger 30ms between cards on filter change |
| Number counters (dashboard) | Tween from 0, 800ms `ease-out`, only on first viewport entry |

**Reduced-motion:** All animations honour `prefers-reduced-motion`. When set, durations drop to 0ms, transforms become opacity-only.

### 18.7 Accessibility

- WCAG 2.1 AA across both apps. All interactive elements keyboard-operable.
- Focus rings always visible: 2px `primary-500` outline + 2px offset.
- Contrast ratios verified in CI (Storybook a11y addon or axe-core in Playwright).
- All form fields have associated `<label>`. Errors announced via `aria-live="polite"`.

### 18.8 Tone of voice (UI copy)

- Confident, concise, professional. Wealth-management appropriate.
- Never patronising or whimsical. No exclamation marks except on success toasts.
- Empty states have a single sentence + a single primary action.
- Error messages name the thing: "Resume upload failed: file is over 5 MB" not "Something went wrong."

### 18.9 Implementation notes

- Tailwind v4 with the design tokens piped into CSS variables in `styles/tokens.css`.
- A `tailwind.config.ts` references the variables — no hardcoded hex anywhere in component files.
- Inter loaded via `next/font/google` with `display: swap` and only the weights actually used (400, 500, 600, 700).
- A single `motion.tsx` file exports pre-tuned `AnimatePresence` + `motion.div` variants — components import these instead of defining transitions ad-hoc. Consistency over freedom.

---

## 19. Testing Strategy

### 19.1 Test pyramid

- **Unit (Vitest):** all pure logic, all service-layer functions with mocked AWS clients. Target: 70%+ line coverage on `server/`.
- **Integration:** tRPC procedures tested against a Postgres test container; AWS SDK calls mocked with `aws-sdk-client-mock`.
- **E2E (Playwright):** the critical user journeys, run on every PR against staging:
  1. Admin creates a job → publishes → copies LinkedIn share link.
  2. Candidate (anonymous) browses jobs → applies → uploads sample resume → receives confirmation email (SES sandbox).
  3. AI parses → scorecard appears in admin → HR overrides → label captured in `training_labels`.
  4. HR moves to Offer → Bedrock drafts → HR approves → candidate receives signature link → signs → CRM webhook fires.
- **Visual regression:** Storybook + Chromatic on changed components (optional v1, mandatory v1.5).
- **Accessibility:** axe-core assertions inside Playwright on every key page.

### 19.2 AI output testing

The hard one. Approach:

- Tarun-provided **20-50 sample resumes** in `tests/fixtures/resumes/` covering diverse roles (RM, analyst, ops, tech, intern), languages (English, Hinglish names), and quality levels (strong/medium/weak).
- For each fixture, a `tests/fixtures/expected/` JSON file with HR-validated expected fields (years, top skills, education, fit decision against a reference JD).
- Eval test: parses each fixture via the prod pipeline (Textract → Bedrock or Comprehend → custom). Asserts:
  - Years experience within ±1.
  - At least 80% recall on top skills.
  - Education degree+institution matched.
  - Final fit decision matches HR's.
- Run on every PR touching `server/services/bedrock.ts`, the resume pipeline, or any model. Block merge if regression > 5%.

### 19.3 ML model testing

- Pre-train: dataset schema validation (every label has required fields).
- Post-train: must beat held-out eval on the golden set; CI fails the pipeline otherwise.
- Pre-deploy: shadow run against last 200 prod predictions; no >10% disagreement with current prod model.

---

## 20. Appendix

### 20.1 PureHire feature parity checklist

| PureHire feature | VaivammHire equivalent | Track | Phase |
|---|---|---|---|
| AI job description generation | §6.1 (Bedrock) | A | 1 |
| Multi-source candidate sourcing | Public form + manual upload + LinkedIn share | A | 1 |
| AI resume screening with scorecards | §6.3 (Textract+Bedrock) | A → B | 1 → 12 (M1+M2) |
| AI audio interviews | §6.5 (Polly+Transcribe+Connect) | A | 3 |
| AI video interviews | §6.5 (MediaRecorder+Transcribe+Bedrock) | A | 3 |
| Automated assessments | §6.6 | A | 2 |
| Visual hiring pipeline | §6.10 | A | 1 |
| Multi-channel comms | §6.9 (SES + WhatsApp + LinkedIn) | A | 1-3 |
| Job board | §4.1 | A | 1 |
| Skill matching | §6.3 + §7.1 (M3 embeddings) | A → B | 1 (Bedrock) → 12 (M3) |
| Spam filter on inbound apps | §7.1 (M5) | B | 4 |

### 20.2 Glossary

- **Application** = a candidate's submission against a specific job. One candidate can have multiple applications.
- **Scorecard** = the AI-generated structured evaluation per application.
- **Autonomy level** = how much the agent can act without HR approval, set per job.
- **Comp band** = an approved CTC range tied to (role family, level, location).
- **DPDP** = India's Digital Personal Data Protection Act, 2023.
- **Promotion gate** = the eval criteria a custom model must pass to replace the incumbent in production.
- **Shadow run** = a model runs alongside the incumbent in prod, predictions logged but not used, for ongoing real-world eval.
- **Incumbent** = whatever currently handles the task in prod (Bedrock, Comprehend, or a previous custom model version).
- **Track A** = Bedrock-powered product surface (v1).
- **Track B** = custom ML/NLP models on SageMaker, trained on Vaivamm's data.
- **Track C** = v2 agent that orchestrates Track A and Track B.
- **OIDC** = OpenID Connect, the auth pattern that lets GitHub Actions assume an AWS IAM role without long-lived keys.

### 20.3 Build-time note

Development workflow is intentionally linear: plan against this PRD, implement with passing checks (`pnpm lint:all`, `pnpm test:all`, `pnpm infra:synth` when infra changes), then merge.

### 20.4 AWS region choice

Primary: `ap-south-1` (Mumbai) for data sovereignty under DPDP.
Bedrock cross-region call: `ap-southeast-1` (Singapore) **only if** Mumbai lacks the desired Claude model. This is acceptable under DPDP because Bedrock processes ephemerally; no candidate data is persisted outside Mumbai.

Verify at deploy time:
```bash
aws bedrock list-foundation-models --by-provider anthropic --region ap-south-1
```
