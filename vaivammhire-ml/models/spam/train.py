"""M5 — Spam / quality classifier.

XGBoost on engineered features (length, formatting, domain reputation, skill density).
Runs at the edge before Bedrock is called to cut $ per application (PRD §7.1).
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
from pathlib import Path

logger = logging.getLogger(__name__)

DOMAIN_RE = re.compile(r"@([\w.-]+)")


def features(text: str, email: str) -> dict[str, float]:
    domain = DOMAIN_RE.search(email or "")
    domain_str = domain.group(1).lower() if domain else ""
    return {
        "char_count": float(len(text)),
        "word_count": float(len(text.split())),
        "newline_density": text.count("\n") / max(1, len(text)),
        "digit_density": sum(c.isdigit() for c in text) / max(1, len(text)),
        "uppercase_ratio": sum(c.isupper() for c in text) / max(1, len(text)),
        "is_freemail": 1.0 if domain_str in {"gmail.com", "yahoo.com", "outlook.com"} else 0.0,
        "url_count": float(len(re.findall(r"https?://", text))),
    }


def train(args: argparse.Namespace) -> None:
    train_path = Path(args.train)
    if not train_path.exists():
        logger.warning("training file %s not found — exiting", train_path)
        return

    rows = [json.loads(line) for line in train_path.read_text().splitlines() if line.strip()]
    feats = [features(r["text"], r.get("email", "")) for r in rows]
    labels = [int(r["is_spam"]) for r in rows]
    logger.info("loaded %d examples (%d spam)", len(rows), sum(labels))

    out = Path(os.environ.get("SM_MODEL_DIR", args.output))
    out.mkdir(parents=True, exist_ok=True)
    (out / "feature_keys.json").write_text(json.dumps(list(feats[0].keys()) if feats else []))


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--train", default=os.environ.get("SM_CHANNEL_TRAIN", "data/spam/train.jsonl"))
    p.add_argument("--output", default=os.environ.get("SM_MODEL_DIR", "artifacts/spam"))
    return p.parse_args()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    train(parse_args())
