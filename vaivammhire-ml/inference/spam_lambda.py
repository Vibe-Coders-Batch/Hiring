"""Lambda handler for M5 spam check. Cheap CPU (PRD §7.8)."""

from __future__ import annotations

import json
from typing import Any

from models.spam import features


def predict(text: str, email: str) -> float:
    f = features(text, email)
    # Skeleton heuristic until xgboost ONNX artifact is wired in.
    score = 0.0
    if f["char_count"] < 200:
        score += 0.4
    if f["url_count"] >= 5:
        score += 0.3
    if f["digit_density"] > 0.5:
        score += 0.3
    return min(1.0, score)


def handler(event: dict[str, Any], _context: object) -> dict[str, Any]:
    body = json.loads(event.get("body") or "{}")
    text = body.get("text") or ""
    email = body.get("email") or ""
    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": json.dumps({"spamProbability": predict(text, email)}),
    }
