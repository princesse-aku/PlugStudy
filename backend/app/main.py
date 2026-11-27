"""API PlugStudy (FastAPI).

POST /courses/{id}/process     envoie le fichier d'un cours ; la préparation se fait en arrière-plan
POST /courses/{id}/assistant   répond à une question avec les seuls passages du cours
GET  /health                   vérification de santé (Render)

Toutes les routes de cours demandent le jeton Firebase de l'étudiant (en-tête Authorization: Bearer …).
"""

from __future__ import annotations

import logging
import re
import threading
import time
from functools import lru_cache

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.ai import AIClient, AIError, RodiumClient
from app.auth import current_uid, get_store
from app.config import Settings, get_settings
from app.extract import ALLOWED_EXTENSIONS, extension_of
from app.generate import answer_question, not_found_message
from app.pipeline import process_course
from app.recovery import recover_in_background
from app.retrieval import top_by_embedding, top_by_words
from app.store import Store, course_path

COURSE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
PROCESSING_LOCK_SECONDS = 600  # un cours en cours de traitement ne peut pas être renvoyé avant 10 minutes


@lru_cache
def _ai_client() -> RodiumClient:
    return RodiumClient(get_settings())


def get_ai() -> AIClient:
    return _ai_client()


class AssistantRequest(BaseModel):
    question: str = Field(min_length=2, max_length=500)


class AssistantReply(BaseModel):
    text: str
    source: str | None = None


app = FastAPI(title="PlugStudy API", version="0.1.0", docs_url=None, redoc_url=None)
BOOTED_AT = time.time()


@app.on_event("startup")
def _recover_interrupted_courses() -> None:
    """Les cours coupés par un redémarrage sont marqués en échec (voir app/recovery.py)."""
    settings = get_settings()
    if not settings.firebase_credentials_json and not settings.firebase_project_id:
        return  # pas de Firebase configuré (développement) : rien à reprendre

    def run() -> None:
        try:
            recover_in_background(get_store(settings), BOOTED_AT)
        except Exception:  # noqa: BLE001
            logging.getLogger("plugstudy.recovery").exception("reprise après redémarrage impossible")

    threading.Thread(target=run, daemon=True).start()

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=600,
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def _valid_course_id(course_id: str) -> str:
    if not COURSE_ID.match(course_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cours introuvable.")
    return course_id


@app.post("/courses/{course_id}/process", status_code=status.HTTP_202_ACCEPTED)
async def process(
    course_id: str,
    background: BackgroundTasks,
    file: UploadFile = File(...),
    language: str = Form("fr"),
    uid: str = Depends(current_uid),
    store: Store = Depends(get_store),
    ai: AIClient = Depends(get_ai),
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    course_id = _valid_course_id(course_id)
    course = store.get(course_path(uid, course_id))
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cours introuvable.")
    if course.get("status") == "ready":
        raise HTTPException(status.HTTP_409_CONFLICT, "Ce cours est déjà prêt.")
    started = course.get("processingStartedAt")
    if course.get("status") == "preparing" and isinstance(started, (int, float)) and time.time() - started < PROCESSING_LOCK_SECONDS:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ce cours est déjà en préparation.")

    filename = (file.filename or "").strip()
    if extension_of(filename) not in ALLOWED_EXTENSIONS:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Format non pris en charge. Choisis un PDF, DOCX, PPTX ou TXT.")
    data = await file.read(settings.max_upload_bytes + 1)
    if not data:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Le fichier est vide.")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(413, f"Le fichier dépasse {settings.max_upload_mb} Mo.")

    store.set(course_path(uid, course_id), {"processingStartedAt": time.time()}, merge=True)
    background.add_task(process_course, store, ai, settings, uid, course_id, filename, data, "en" if language == "en" else "fr")
    return {"status": "processing"}


@app.post("/courses/{course_id}/assistant", response_model=AssistantReply)
def assistant(
    course_id: str,
    body: AssistantRequest,
    uid: str = Depends(current_uid),
    store: Store = Depends(get_store),
    ai: AIClient = Depends(get_ai),
) -> AssistantReply:
    course_id = _valid_course_id(course_id)
    course = store.get(course_path(uid, course_id))
    if course is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cours introuvable.")
    if course.get("status") != "ready":
        raise HTTPException(status.HTTP_409_CONFLICT, "Ce cours n'est pas encore prêt.")
    name = str(course.get("name") or "Cours")
    chunks = store.list(course_path(uid, course_id, "chunks"))
    question = body.question.strip()

    passages: list[dict] = []
    try:
        if any(chunk.get("embedding") for chunk in chunks):
            query = ai.embed([question])[0]
            passages = top_by_embedding(query, chunks)
        if not passages:
            passages = top_by_words(question, chunks)
        if not passages:
            return AssistantReply(text=not_found_message(name, "en" if course.get("language") == "en" else "fr"))
        language = "en" if course.get("language") == "en" else "fr"
        reply = answer_question(ai, question, passages, name, language)
    except AIError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "L'assistant est momentanément indisponible.") from None
    return AssistantReply(**reply)
