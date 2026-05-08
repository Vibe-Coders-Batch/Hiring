"""M4 — Candidate dedup.

MinHash + LSH on resume text plus exact match on (email, phone). No training
needed for v1 (PRD §7.1). Lives in inference/dedup_lambda.py at runtime.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from dataclasses import dataclass

from datasketch import MinHash, MinHashLSH


@dataclass(frozen=True)
class CandidateKey:
    email: str
    phone: str | None
    resume_text: str


def _shingles(text: str, k: int = 5) -> Iterable[str]:
    cleaned = re.sub(r"\s+", " ", text.lower()).strip()
    for i in range(0, max(0, len(cleaned) - k + 1)):
        yield cleaned[i : i + k]


def _signature(text: str, num_perm: int = 128) -> MinHash:
    m = MinHash(num_perm=num_perm)
    for s in _shingles(text):
        m.update(s.encode("utf-8"))
    return m


class DedupIndex:
    def __init__(self, threshold: float = 0.85):
        self.lsh = MinHashLSH(threshold=threshold, num_perm=128)
        self.exact: dict[str, str] = {}

    def add(self, candidate_id: str, c: CandidateKey) -> None:
        self.exact[c.email.lower()] = candidate_id
        if c.phone:
            self.exact[c.phone] = candidate_id
        self.lsh.insert(candidate_id, _signature(c.resume_text))

    def query(self, c: CandidateKey) -> list[str]:
        hits = set(self.lsh.query(_signature(c.resume_text)))
        if c.email.lower() in self.exact:
            hits.add(self.exact[c.email.lower()])
        if c.phone and c.phone in self.exact:
            hits.add(self.exact[c.phone])
        return sorted(hits)
