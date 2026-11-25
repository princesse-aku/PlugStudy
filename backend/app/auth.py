"""Identification de l'étudiant par son jeton Firebase (envoyé par le frontend dans l'en-tête Authorization)."""

from __future__ import annotations

import json
import time
from collections import defaultdict, deque
from typing import Any

from fastapi import Depends, Header, HTTPException, status

from app.config import Settings, get_settings
from app.store import FirestoreStore, Store

_firebase_ready = False


def _init_firebase(settings: Settings) -> None:
    global _firebase_ready
    if _firebase_ready:
        return
    import firebase_admin
    from firebase_admin import credentials

    if settings.firebase_credentials_json:
        cred = credentials.Certificate(json.loads(settings.firebase_credentials_json))
    else:  # GOOGLE_APPLICATION_CREDENTIALS, ou identifiants de la plateforme
        cred = credentials.ApplicationDefault()
    options = {"projectId": settings.firebase_project_id} if settings.firebase_project_id else None
    firebase_admin.initialize_app(cred, options)
    _firebase_ready = True


def get_store(settings: Settings = Depends(get_settings)) -> Store:
    _init_firebase(settings)
    from firebase_admin import firestore

    return FirestoreStore(firestore.client())


def verify_token(token: str, settings: Settings) -> dict[str, Any]:
    _init_firebase(settings)
    from firebase_admin import auth

    return auth.verify_id_token(token)


class RateLimiter:
    """Limite simple par étudiant (en mémoire) : protège les appels payants à l'IA."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, uid: str, limit: int) -> None:
        now = time.monotonic()
        hits = self._hits[uid]
        while hits and now - hits[0] > 60:
            hits.popleft()
        if len(hits) >= limit:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Trop de demandes. Réessaie dans une minute.")
        hits.append(now)


_limiter = RateLimiter()


def current_uid(
    authorization: str | None = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> str:
    """UID de l'étudiant connecté, ou 401."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Connexion requise.")
    token = authorization[7:].strip()
    try:
        claims = verify_token(token, settings)
    except Exception:  # jeton invalide, expiré ou service Firebase indisponible
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Connexion expirée. Reconnecte-toi.") from None
    uid = claims.get("uid") or claims.get("sub")
    if not uid:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Connexion requise.")
    _limiter.check(str(uid), settings.rate_limit_per_minute)
    return str(uid)
