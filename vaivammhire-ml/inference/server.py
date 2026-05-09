"""Local / Docker HTTP API for Track B ML routes consumed by vaivammhire-app (`ML_API_BASE_URL`)."""

from __future__ import annotations

import hashlib
import uuid
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel

from inference.ner_lambda import predict as ner_predict
from models.dedup.dedup import CandidateKey, DedupIndex
from models.spam.train import features as spam_features

app = FastAPI(title="VaivammHire ML API", version="0.1.0")

_dedup_index = DedupIndex(threshold=0.85)


class ParseResumeBody(BaseModel):
    text: str = ""


class ScoreFitBody(BaseModel):
    resumeText: str = ""
    jdMarkdown: str = ""


class EmbedSkillBody(BaseModel):
    skill: str = ""


class DedupCheckBody(BaseModel):
    resumeText: str = ""
    email: str = ""
    phone: str | None = None


class SpamCheckBody(BaseModel):
    text: str = ""
    email: str = ""


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "vaivammhire-ml"}


@app.post("/parse-resume")
def parse_resume(body: ParseResumeBody) -> dict[str, Any]:
    if not body.text.strip():
        return {"skills": [], "companies": [], "titles": [], "educations": []}
    return ner_predict(body.text)


@app.post("/score-fit")
def score_fit(body: ScoreFitBody) -> dict[str, Any]:
    """Lightweight overlap heuristic until the fit classifier ONNX is wired."""
    r = set(body.resumeText.lower().split())
    j = set(body.jdMarkdown.lower().split())
    overlap = len(r & j)
    score = min(1.0, overlap / 40.0)
    if score >= 0.45:
        decision: str = "shortlist"
    elif score >= 0.15:
        decision = "review"
    else:
        decision = "reject"
    return {
        "score": score,
        "decision": decision,
        "features": {"token_overlap": float(overlap)},
    }


@app.post("/embed-skill")
def embed_skill(body: EmbedSkillBody) -> dict[str, Any]:
    """Deterministic stub embedding (8-dim) for local dev."""
    skill = body.skill or ""
    h = hashlib.sha256(skill.encode()).digest()
    vec = [((h[i % len(h)] - 128) / 128.0) for i in range(8)]
    return {"vector": vec}


@app.post("/dedup-check")
def dedup_check(body: DedupCheckBody) -> dict[str, Any]:
    key = CandidateKey(
        email=body.email or "unknown@local",
        phone=body.phone,
        resume_text=body.resumeText or "",
    )
    hits = _dedup_index.query(key)
    duplicates = [{"candidateId": hid, "score": 0.92} for hid in hits]
    _dedup_index.add(str(uuid.uuid4()), key)
    return {"duplicates": duplicates}


@app.post("/spam-check")
def spam_check(body: SpamCheckBody) -> dict[str, float]:
    text = body.text or ""
    email = body.email or ""
    f = spam_features(text, email)
    score = 0.0
    if f["char_count"] < 200:
        score += 0.4
    if f["url_count"] >= 5:
        score += 0.3
    if f["digit_density"] > 0.5:
        score += 0.3
    return {"spamProbability": min(1.0, score)}
