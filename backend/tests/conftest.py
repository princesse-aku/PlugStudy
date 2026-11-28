"""Outils de test : un cours d'exemple, une fausse IA et un Firestore en mémoire. Aucun appel réseau."""

from __future__ import annotations

import io
import re
import zlib
from typing import Any

import pytest

from app.ai import AIError
from app.config import Settings
from app.store import MemoryStore, course_path

UID = "u1"
COURSE_ID = "c1"

COURSE_TEXT = (
    "CHAPITRE 1 INTRODUCTION\n"
    "Un algorithme est une suite d'instructions qui résout un problème. La complexité algorithmique décrit comment "
    "le temps d'exécution d'un algorithme augmente quand la taille des données augmente. "
    "La complexité algorithmique permet de comparer deux solutions.\n"
    "1. Variables et types\n"
    "Une variable est un nom qui désigne une valeur en mémoire. Son type dit quelles valeurs elle peut contenir. "
    "Une variable peut changer de valeur pendant l'exécution.\n"
    "CHAPITRE 2 BOUCLES\n"
    "Une boucle répète des instructions tant qu'une condition est vraie. La boucle pour répète un nombre fixé de fois. "
    "Chaque boucle doit se terminer, sinon le programme ne finit jamais.\n"
    "Exercices\n"
    "Écrire une boucle qui affiche les nombres de 1 à 10. Calculer la complexité algorithmique de cette boucle.\n"
)

QUOTE_COMPLEXITE = (
    "La complexité algorithmique décrit comment le temps d'exécution d'un algorithme augmente quand la taille des données augmente."
)
QUOTE_VARIABLE = "Une variable est un nom qui désigne une valeur en mémoire."
QUOTE_BOUCLE = "Une boucle répète des instructions tant qu'une condition est vraie."

NOTIONS = [
    {"title": "Complexité algorithmique", "quote": QUOTE_COMPLEXITE, "simple": "Plus il y a de données, plus ça prend du temps.", "importance": 1.0},
    {"title": "Variables et types", "quote": QUOTE_VARIABLE, "simple": "Une boîte étiquetée où l'on range une valeur.", "importance": 0.7},
    {"title": "Boucles", "quote": QUOTE_BOUCLE, "simple": "On refait la même action tant que nécessaire.", "importance": 0.6},
]


class FakeAI:
    """Fausse IA déterministe. `notions` et `fail` règlent son comportement."""

    def __init__(self, notions: list[dict[str, Any]] | None = None, fail: bool = False, no_embeddings: bool = False) -> None:
        self.notions = NOTIONS if notions is None else notions
        self.fail = fail
        self.no_embeddings = no_embeddings
        self.questions_per_notion = 3  # comme la consigne réelle : 3 questions par notion
        self.calls: list[tuple[str, str]] = []
        self.prompts: list[str] = []  # les consignes système complètes, pour vérifier la langue demandée

    def complete_json(self, *, role: str, system: str, user: str, max_tokens: int = 2000) -> dict[str, Any]:
        self.calls.append((role, system[:30]))
        self.prompts.append(system)
        if self.fail:
            raise AIError("panne")
        if system.startswith("Tu résumes") or system.startswith("Tu fusionnes"):
            return {"summary": "Ce cours présente les algorithmes."}
        if system.startswith("Tu extrais"):
            return {"notions": self.notions}
        if system.startswith("Tu écris des questions"):
            ids = re.findall(r"Notion (n\d+) : ([^\n]+)", user)
            return {
                "questions": [
                    {
                        "notion": notion_id,
                        "text": f"Que dit le cours sur {title} ? (aspect {aspect})",
                        "choices": ["Bonne réponse", "Mauvaise A", "Mauvaise B", "Mauvaise C"],
                        "correct": 0,
                        "explanation": "La bonne réponse reprend le cours ; les autres sont des confusions fréquentes.",
                    }
                    for notion_id, title in ids
                    for aspect in range(1, self.questions_per_notion + 1)
                ]
            }
        if system.startswith("Tu corriges"):
            right = "bonne idee" in user
            return {"correct": right, "feedback": "Idée juste." if right else "Il manque l'idée principale."}
        if system.startswith("Tu reformules"):
            lines = re.findall(r"^(\d+)\. (.+)$", user, flags=re.M)
            return {"questions": [{"id": int(n), "text": f"Autrement dit : {text}"} for n, text in lines]}
        if system.startswith("Tu es l'assistant"):
            return {"answer": "Une boucle répète des instructions.", "passage": 1}
        raise AssertionError("appel inattendu")

    def embed(self, texts: list[str]) -> list[list[float]]:
        if self.fail or self.no_embeddings:
            raise AIError("pas d'embeddings")
        return [self._vector(text) for text in texts]

    @staticmethod
    def _vector(text: str) -> list[float]:
        vector = [0.0] * 64
        for word in re.findall(r"[a-zé]{4,}", text.lower()):
            vector[zlib.crc32(word.encode()) % 64] += 1.0
        return vector


@pytest.fixture
def settings() -> Settings:
    return Settings(
        firebase_project_id="demo",
        rodiumai_base_url="http://ai.test",
        rodiumai_api_key="test",
        min_text_chars=100,
        max_upload_mb=1,
        rate_limit_per_minute=1000,
        rodium_embeddings_enabled=True,  # les tests de l'assistant en ont besoin ; le défaut du MVP est « non »
        _env_file=None,
    )


@pytest.fixture
def store() -> MemoryStore:
    memory = MemoryStore()
    memory.set(course_path(UID, COURSE_ID), {"name": "Algorithmique", "status": "preparing", "progress": 0})
    return memory


def make_pdf(text: str | None) -> bytes:
    """PDF d'une page ; `text=None` donne une page sans texte (comme un scan)."""
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    if text is None:
        pdf.rect(50, 50, 200, 200, fill=1)  # une image de page, aucun texte extractible
    else:
        y = 800
        for line in text.splitlines():
            pdf.drawString(40, y, line[:110])
            y -= 16
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


def make_docx(text: str) -> bytes:
    from docx import Document

    document = Document()
    for line in text.splitlines():
        if line.startswith("CHAPITRE"):
            document.add_heading(line, level=1)
        else:
            document.add_paragraph(line)
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def make_pptx(slides: list[tuple[str, str]]) -> bytes:
    from pptx import Presentation

    presentation = Presentation()
    for title, body in slides:
        slide = presentation.slides.add_slide(presentation.slide_layouts[1])
        slide.shapes.title.text = title
        slide.placeholders[1].text = body
    buffer = io.BytesIO()
    presentation.save(buffer)
    return buffer.getvalue()
