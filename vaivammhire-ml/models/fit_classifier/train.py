"""M2 — JD-Fit classifier.

LightGBM on engineered features (years, skill overlap, education tier, location match)
plus cross-encoder embeddings of (resume, JD) pairs.

PRD §7.1: target latency, cost vs Bedrock; accuracy parity once data > 2k apps.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


def engineered_features(example: dict) -> dict:
    """Pure feature transform — easy to test, easy to inspect."""
    skills = set(s.lower() for s in example.get("resume_skills", []))
    jd_skills = set(s.lower() for s in example.get("jd_skills", []))
    overlap = len(skills & jd_skills)
    return {
        "years_experience": float(example.get("years_experience") or 0),
        "skills_overlap": overlap,
        "skills_overlap_ratio": overlap / max(1, len(jd_skills)),
        "location_match": 1.0 if example.get("location_match") else 0.0,
        "education_tier": float(example.get("education_tier") or 0),
    }


def train(args: argparse.Namespace) -> None:
    train_path = Path(args.train)
    if not train_path.exists():
        logger.warning("training file %s not found — exiting (smoke run)", train_path)
        return

    rows = [json.loads(line) for line in train_path.read_text().splitlines() if line.strip()]
    feats = [engineered_features(r) for r in rows]
    labels = [int(bool(r.get("hired"))) for r in rows]
    logger.info("loaded %d examples", len(rows))

    # Real impl: lightgbm.LGBMClassifier(...).fit(X, y).
    # Skeleton writes the feature definition + a placeholder model artifact.
    out = Path(os.environ.get("SM_MODEL_DIR", args.output))
    out.mkdir(parents=True, exist_ok=True)
    (out / "feature_keys.json").write_text(json.dumps(list(feats[0].keys()) if feats else []))
    (out / "label_balance.json").write_text(
        json.dumps({"positives": sum(labels), "negatives": len(labels) - sum(labels)})
    )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--train", default=os.environ.get("SM_CHANNEL_TRAIN", "data/fit/train.jsonl"))
    p.add_argument("--output", default=os.environ.get("SM_MODEL_DIR", "artifacts/fit"))
    return p.parse_args()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    train(parse_args())
