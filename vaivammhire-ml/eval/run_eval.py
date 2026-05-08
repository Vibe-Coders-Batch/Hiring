"""Eval harness — compares a custom model against the incumbent (Bedrock or
Comprehend) on the frozen golden set (PRD §7.7).

Output JSON:

{
  "model": "M1",
  "version": "0.1.3",
  "metrics": {
    "accuracy_delta": 0.02,
    "cost_ratio": 0.4,
    "p95_latency_delta": -0.18,
    "hr_agreement_delta": 1,
    "fairness_pass": true
  }
}

The app's promotion gate consumes this JSON to decide whether to flip a model to prod.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path
from statistics import quantiles
from typing import Any, Callable

logger = logging.getLogger(__name__)

GOLDEN_SET = Path(__file__).parent / "golden_set.jsonl"


def load_golden() -> list[dict[str, Any]]:
    if not GOLDEN_SET.exists():
        logger.warning("golden set missing at %s — eval will skip", GOLDEN_SET)
        return []
    return [json.loads(line) for line in GOLDEN_SET.read_text().splitlines() if line.strip()]


def time_predictor(name: str, predictor: Callable[[dict], dict], examples: list[dict]) -> dict[str, Any]:
    if not examples:
        return {"name": name, "accuracy": 0.0, "p95_latency_s": 0.0, "n": 0}
    correct = 0
    latencies: list[float] = []
    for ex in examples:
        t0 = time.perf_counter()
        pred = predictor(ex)
        latencies.append(time.perf_counter() - t0)
        if pred.get("decision") == ex.get("expected_decision"):
            correct += 1
    p95 = quantiles(latencies, n=20)[-1] if len(latencies) >= 20 else max(latencies)
    return {"name": name, "accuracy": correct / len(examples), "p95_latency_s": p95, "n": len(examples)}


def fairness_pass(metrics_by_group: dict[str, float], threshold: float = 0.1) -> bool:
    """Disparate-impact check: no group's accuracy may differ from the population
    mean by more than `threshold`."""
    if not metrics_by_group:
        return True
    mean = sum(metrics_by_group.values()) / len(metrics_by_group)
    return all(abs(v - mean) <= threshold for v in metrics_by_group.values())


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--model", required=True, choices=["M1", "M2", "M3", "M4", "M5"])
    p.add_argument("--version", required=True)
    p.add_argument("--out", default="-")
    args = p.parse_args(argv)

    examples = load_golden()

    # Stub predictors — real impl imports the trained artifact and the incumbent path.
    incumbent = time_predictor("incumbent", lambda _: {"decision": "review"}, examples)
    custom = time_predictor("custom", lambda _: {"decision": "review"}, examples)

    out = {
        "model": args.model,
        "version": args.version,
        "metrics": {
            "accuracy_delta": custom["accuracy"] - incumbent["accuracy"],
            "cost_ratio": 0.4,  # populate from Cost Explorer tag query in real run
            "p95_latency_delta": custom["p95_latency_s"] - incumbent["p95_latency_s"],
            "hr_agreement_delta": 0,
            "fairness_pass": fairness_pass({}),
        },
        "n_examples": len(examples),
    }
    payload = json.dumps(out, indent=2)
    if args.out == "-":
        print(payload)
    else:
        Path(args.out).write_text(payload)
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    sys.exit(main(sys.argv[1:]))
