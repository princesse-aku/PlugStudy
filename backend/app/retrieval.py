"""Recherche des passages du cours les plus proches d'une question (pour l'assistant)."""

from __future__ import annotations

import math
from typing import Any

from app.analysis import normalize, significant_words

MIN_SIMILARITY = 0.2  # en dessous, aucun passage n'est jugé pertinent


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0


def top_by_embedding(query: list[float], chunks: list[dict[str, Any]], k: int = 4) -> list[dict[str, Any]]:
    scored = [(cosine(query, c["embedding"]), c) for c in chunks if c.get("embedding")]
    scored = [row for row in scored if row[0] >= MIN_SIMILARITY]
    scored.sort(key=lambda row: -row[0])
    return [chunk for _, chunk in scored[:k]]


def top_by_words(question: str, chunks: list[dict[str, Any]], k: int = 4) -> list[dict[str, Any]]:
    """Repli sans embeddings : passages contenant le plus de mots importants de la question."""
    words = significant_words(question)
    if not words:
        return []
    scored = []
    for chunk in chunks:
        norm = normalize(chunk.get("text", ""))
        hits = sum(1 for w in words if (w[:5] if len(w) > 5 else w) in norm)
        if hits:
            scored.append((hits, chunk))
    scored.sort(key=lambda row: -row[0])
    return [chunk for _, chunk in scored[:k]]
