# CLAUDE.md — vaivammhire-ml

Python repo for Track B (PRD §7). Single-agent dev workflow per root `CLAUDE.md`.

## Hard rules

- **Promotion gate is non-negotiable.** A model only ships if it beats the incumbent on
  ≥2 of (accuracy, cost, p95 latency), doesn't lose the third by >10%, HR-agreement is
  within 5 pts, and the fairness eval passes (PRD §7.7, §12.2).
- **No protected-attribute features.** Don't infer gender, caste, religion, age in any
  feature pipeline. The fairness eval will fail noisily if you try.
- **Anonymise before train.** Anything that hits `data/` must have name/email/phone/
  address/LinkedIn stripped via Comprehend PII (PRD §12.2). The nightly export Lambda
  enforces this; don't bypass it.
- **Models train on consented data only.** Filter out candidates who set `consent_training=false`
  or who invoked `/delete-my-data`.

## Conventions

- Each model has its own folder with the same layout: `train.py`, `eval.py`,
  `Dockerfile`, `README.md`. Don't share entry points across models.
- SageMaker Experiment names: `m{1-5}-<purpose>`. Run names: `<git-sha>-<timestamp>`.
- Model registry status flow: `training → staging → prod → archived`. Use the
  app's `/admin/models` UI to promote, not boto3 directly — it audits.
- Inference: ONNX Runtime CPU on Lambda whenever possible (cheap). SageMaker Endpoints
  only when GPU is required at inference time.
