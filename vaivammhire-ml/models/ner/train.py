"""M1 — Resume NER.

Fine-tunes distilbert-base-cased on the labeled span dataset built from
HR edits to AI-extracted skills/companies/titles/dates (PRD §7.3 row 2-3).

Run as a SageMaker Training Job (entry point in pipelines/ner_pipeline.py)
or locally for smoke tests:

    uv run python -m models.ner.train --epochs 1 --train data/ner/train.jsonl
"""

from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

LABELS = ["O", "B-SKILL", "I-SKILL", "B-ORG", "I-ORG", "B-TITLE", "I-TITLE", "B-EDU", "I-EDU"]


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def train(args: argparse.Namespace) -> None:
    train_path = Path(args.train)
    if not train_path.exists():
        logger.warning("training file %s not found — exiting (smoke run)", train_path)
        return

    examples = load_jsonl(train_path)
    logger.info("loaded %d training examples", len(examples))

    # Real implementation: HuggingFace Trainer + token-classification head on
    # distilbert-base-cased. We keep this skeleton minimal so SageMaker can
    # invoke it as a Training Job entry point without extra plumbing.
    # See https://huggingface.co/docs/transformers/tasks/token_classification.

    output_dir = Path(os.environ.get("SM_MODEL_DIR", args.output))
    output_dir.mkdir(parents=True, exist_ok=True)

    # Persist a stub artifact so downstream steps in the SageMaker Pipeline
    # have something to register.
    (output_dir / "labels.json").write_text(json.dumps(LABELS), encoding="utf-8")
    (output_dir / "model_card.json").write_text(
        json.dumps(
            {
                "name": "M1-resume-ner",
                "framework": "transformers",
                "base_model": "distilbert-base-cased",
                "labels": LABELS,
                "n_train_examples": len(examples),
            }
        ),
        encoding="utf-8",
    )
    logger.info("wrote stub artifacts to %s", output_dir)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--train", default=os.environ.get("SM_CHANNEL_TRAIN", "data/ner/train.jsonl"))
    p.add_argument("--output", default=os.environ.get("SM_MODEL_DIR", "artifacts/ner"))
    p.add_argument("--epochs", type=int, default=3)
    p.add_argument("--batch-size", type=int, default=16)
    p.add_argument("--lr", type=float, default=2e-5)
    return p.parse_args()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    train(parse_args())
