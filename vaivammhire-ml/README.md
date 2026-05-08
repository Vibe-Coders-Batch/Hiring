# vaivammhire-ml

Track B custom models trained on Vaivamm's proprietary hiring data (PRD §7).

## Models

| ID | Purpose | Algorithm |
|---|---|---|
| **M1** | Resume NER | spaCy + fine-tuned `distilbert-base-cased` |
| **M2** | JD-Fit classifier | LightGBM on engineered features + cross-encoder embeddings |
| **M3** | Skill embeddings | `sentence-transformers/all-MiniLM-L6-v2` fine-tuned on O*NET + ESCO |
| **M4** | Candidate dedup | MinHash + LSH + email/phone exact match |
| **M5** | Spam/quality classifier | XGBoost on engineered features |

Each model lives in `models/<id>/` with its own `train.py`, `eval.py`, and README.

## Layout

```
data/                  # DVC-tracked, S3 remote (vaivammhire-training-<env>)
models/<m>/
  train.py             # SageMaker Training Job entry point
  eval.py              # Golden-set eval, used by promotion gate
  Dockerfile           # Pushed to ECR, used by SageMaker
  README.md            # Model spec
eval/
  golden_set.jsonl     # 200 HR-labeled examples (PRD §7.7)
  run_eval.py          # Compares custom vs incumbent (Bedrock or Comprehend)
pipelines/
  <m>_pipeline.py      # SageMaker Pipeline definition (preprocess → train → eval → register)
inference/
  <m>_lambda.py        # Lambda handler with ONNX runtime (CPU)
containers/
  train.Dockerfile     # Custom container for SageMaker
```

## Getting started

```bash
uv sync
uv run pytest
uv run python pipelines/ner_pipeline.py --execute  # kicks off a SageMaker run
```

## Promotion gate (PRD §7.7)

Run `uv run python eval/run_eval.py --model M1 --version <semver>` to compare a candidate model
against the current incumbent. The script writes results to `eval_metrics` JSON which
the app's `/admin/models` page consumes to gate promotion.

## DVC

```bash
dvc remote add -d s3 s3://vaivammhire-training-dev
dvc push
```
