"""Lambda handler for M1 inference. ONNX Runtime CPU (PRD §7.8).

Endpoint: POST /v1/parse-resume
Input: { "text": str }
Output: { "skills": [...], "companies": [...], "titles": [...], "educations": [...] }

Bundled into the deployment artifact with the model.onnx checkpoint loaded
from `/opt/model/` (Lambda layer or container image).
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger()
logger.setLevel(logging.INFO)

MODEL_PATH = os.environ.get("MODEL_PATH", "/opt/model/ner.onnx")


def predict(text: str) -> dict[str, Any]:
    # Real impl: tokenize → ONNX session.run → align tokens to spans.
    # For now, return an empty structured response so the endpoint shape is stable.
    return {"skills": [], "companies": [], "titles": [], "educations": []}


def handler(event: dict[str, Any], _context: object) -> dict[str, Any]:
    body = json.loads(event.get("body") or "{}")
    text = body.get("text") or ""
    if not text:
        return {"statusCode": 400, "body": json.dumps({"error": "text required"})}
    out = predict(text)
    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": json.dumps(out),
    }
