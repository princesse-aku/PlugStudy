"""Reprise après un redémarrage du serveur.

La préparation d'un cours tourne en arrière-plan dans le processus. Si Render le redémarre (déploiement, mise à jour,
mémoire), le travail est coupé net et le cours resterait « en préparation » pour toujours. Au démarrage, aucun
traitement ne peut être en cours dans ce nouveau processus : tout cours encore « en préparation » est donc mort,
et on le passe en échec pour que l'étudiant puisse le renvoyer.
"""

from __future__ import annotations

import logging
import time

from app.pipeline import ERROR_FAILED
from app.store import Store

log = logging.getLogger("plugstudy.recovery")


def recover_stalled_courses(store: Store, booted_at: float) -> int:
    """Passe en échec les cours restés « en préparation » avant `booted_at`. Renvoie leur nombre."""
    recovered = 0
    for path, course in store.preparing_courses():
        started = course.get("processingStartedAt")
        # Un envoi reçu par ce processus depuis son démarrage est bel et bien en cours : on n'y touche pas.
        if isinstance(started, (int, float)) and started >= booted_at:
            continue
        store.set(path, {"status": "error", "errorReason": ERROR_FAILED}, merge=True)
        recovered += 1
    if recovered:
        log.warning("%d cours interrompus par un redémarrage ont été marqués en échec", recovered)
    return recovered


def recover_in_background(store: Store, booted_at: float | None = None) -> None:
    """À lancer dans un thread : ne doit jamais empêcher le serveur de démarrer."""
    try:
        recover_stalled_courses(store, time.time() if booted_at is None else booted_at)
    except Exception:  # noqa: BLE001
        log.exception("reprise après redémarrage impossible")
