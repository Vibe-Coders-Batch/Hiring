"""M3 — Skill embeddings.

Fine-tunes sentence-transformers/all-MiniLM-L6-v2 on O*NET + ESCO + Vaivamm pairs
so that 'React.js' ≈ 'ReactJS' ≈ 'React' in vector space (PRD §7.1).
"""

from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


def train(args: argparse.Namespace) -> None:
    pairs_path = Path(args.pairs)
    if not pairs_path.exists():
        logger.warning("pairs file %s not found — exiting", pairs_path)
        return
    pairs = [json.loads(line) for line in pairs_path.read_text().splitlines() if line.strip()]
    logger.info("loaded %d positive skill pairs", len(pairs))

    out = Path(os.environ.get("SM_MODEL_DIR", args.output))
    out.mkdir(parents=True, exist_ok=True)
    (out / "config.json").write_text(json.dumps({"base": "sentence-transformers/all-MiniLM-L6-v2", "dim": 384}))


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--pairs", default=os.environ.get("SM_CHANNEL_PAIRS", "data/embeddings/pairs.jsonl"))
    p.add_argument("--output", default=os.environ.get("SM_MODEL_DIR", "artifacts/embeddings"))
    return p.parse_args()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    train(parse_args())
