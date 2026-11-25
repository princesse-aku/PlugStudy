"""Traitement d'un cours : lecture du fichier, fiche résumée, notions, quiz, plan de révision.

Le document du cours (users/{uid}/courses/{id}) est mis à jour à chaque étape (`prepStep` de 0 à 4), ce qui
alimente l'écran « On prépare ton cours » du frontend en temps réel. Le fichier lui-même n'est jamais gardé :
il est lu en mémoire puis oublié. Les journaux ne contiennent jamais le contenu du cours.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any

from app.ai import AIClient, AIError
from app.analysis import chunk_document, page_infos, source_label
from app.config import Settings
from app.extract import UnsupportedFile, extract_document
from app.generate import build_notions, extract_raw_notions, generate_questions, outline, summarize
from app.store import Store, course_path

log = logging.getLogger("plugstudy.pipeline")
QUIZ_ATTEMPTS = 3

# Raisons d'échec écrites dans errorReason (le frontend affiche le message correspondant).
ERROR_FORMAT = "format"  # format non pris en charge ou fichier corrompu
ERROR_UNREADABLE = "unreadable"  # pas de texte lisible (PDF scanné, photo)
ERROR_EMPTY = "empty"  # texte lisible mais aucune notion exploitable
ERROR_AI = "ai"  # IA momentanément indisponible
ERROR_FAILED = "failed"  # autre erreur


def _fail(store: Store, uid: str, course_id: str, reason: str) -> None:
    store.set(course_path(uid, course_id), {"status": "error", "errorReason": reason}, merge=True)


def process_course(
    store: Store,
    ai: AIClient,
    settings: Settings,
    uid: str,
    course_id: str,
    filename: str,
    data: bytes,
    language: str = "fr",
) -> None:
    """`language` : langue de l'étudiant (« fr » ou « en ») ; résumé, notions et quiz sont écrits dans cette langue."""
    language = "en" if language == "en" else "fr"
    path = course_path(uid, course_id)
    course = store.get(path) or {}
    name = str(course.get("name") or "Cours")

    def step(count: int, **fields: Any) -> None:
        store.set(path, {"prepStep": count, **fields}, merge=True)

    try:
        store.set(path, {"status": "preparing", "prepStep": 0, "errorReason": None, "language": language}, merge=True)

        # 1. Lecture du fichier.
        try:
            doc = extract_document(filename, data)
        except UnsupportedFile:
            _fail(store, uid, course_id, ERROR_FORMAT)
            return
        if doc.total_chars < settings.min_text_chars:
            _fail(store, uid, course_id, ERROR_UNREADABLE)
            return
        infos = page_infos(doc)
        chunks = chunk_document(doc, infos)
        step(1)

        # 2. Fiche résumée : résumé + notions (importance par l'IA, fréquence et position calculées).
        with ThreadPoolExecutor(max_workers=2) as pool:  # indépendants : on les lance ensemble
            summary_job = pool.submit(summarize, ai, doc, settings, language)
            notions_job = pool.submit(extract_raw_notions, ai, doc, settings, language)
            summary, raw = summary_job.result(), notions_job.result()
        notions = build_notions(raw, doc, infos, name, settings, language)
        if not notions:
            _fail(store, uid, course_id, ERROR_EMPTY)
            return
        store.set_many([(course_path(uid, course_id, "notions", n.id), n.data) for n in notions])
        step(2, summary=summary)

        # 3. Quiz + passages pour l'assistant (embeddings : sans eux, l'assistant cherche par mots).
        # Le quiz est au cœur du produit : l'IA répond parfois dans un format inattendu, on réessaie jusqu'à 3 fois.
        wanted = min(len(notions), settings.max_questions, 3)
        questions: list = []
        for attempt in range(QUIZ_ATTEMPTS):
            try:
                found = generate_questions(ai, notions, doc, settings, language)
            except AIError:
                if attempt == QUIZ_ATTEMPTS - 1 and not questions:
                    raise
                continue
            if len(found) > len(questions):
                questions = found
            if len(questions) >= wanted:
                break
        if not questions:
            log.warning("aucune question valide après %d tentatives", QUIZ_ATTEMPTS)
        store.set_many([(course_path(uid, course_id, "questions", qid), q) for qid, q in questions])

        vectors: list[list[float]] = []
        if settings.rodium_embeddings_enabled:
            try:
                vectors = ai.embed([chunk.text for chunk in chunks])
            except AIError:
                log.warning("embeddings indisponibles : l'assistant utilisera la recherche par mots")
        items = []
        for index, chunk in enumerate(chunks):
            record: dict[str, Any] = {
                "text": chunk.text,
                "page": chunk.page,
                "source": source_label(name, doc, infos, chunk.page, language),
            }
            if chunk.chapter:
                record["chapter"] = chunk.chapter
            if index < len(vectors):
                record["embedding"] = vectors[index]
            items.append((course_path(uid, course_id, "chunks", chunk.id), record))
        store.set_many(items)
        step(3)

        # 4. Plan de révision : le plan du cours sert de base au Planning (dates d'examen et sessions).
        step(4, outline=outline(doc, infos), status="ready")
        log.info("cours prêt : %d notions, %d questions, %d passages", len(notions), len(questions), len(chunks))
    except AIError as error:
        log.error("échec IA : %s", error)
        _fail(store, uid, course_id, ERROR_AI)
    except Exception as error:  # ne jamais laisser un cours bloqué sur « Préparation en cours »
        log.exception("échec du traitement (%s)", type(error).__name__)
        _fail(store, uid, course_id, ERROR_FAILED)
