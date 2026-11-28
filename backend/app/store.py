"""Accès aux données : Firestore en production, mémoire dans les tests.

Tout est rangé sous users/{uid}, comme le frontend et firestore.rules. Le backend écrit avec le SDK Admin
(il contourne les règles) : il ne touche donc qu'au chemin de l'étudiant identifié par son jeton.
"""

from __future__ import annotations

import json
from typing import Any, Protocol

Path = tuple[str, ...]


class Store(Protocol):
    def get(self, path: Path) -> dict[str, Any] | None: ...

    def set(self, path: Path, data: dict[str, Any], merge: bool = False) -> None: ...

    def set_many(self, items: list[tuple[Path, dict[str, Any]]]) -> None: ...

    def list(self, path: Path) -> list[dict[str, Any]]: ...

    def preparing_courses(self) -> list[tuple[Path, dict[str, Any]]]: ...

    def delete_user(self, uid: str) -> None: ...


def course_path(uid: str, course_id: str, *rest: str) -> Path:
    return ("users", uid, "courses", course_id, *rest)


class MemoryStore:
    """Version en mémoire, pour les tests."""

    def __init__(self) -> None:
        self.docs: dict[Path, dict[str, Any]] = {}
        self.deleted_users: list[str] = []  # comptes supprimés (les tests le lisent)

    def get(self, path: Path) -> dict[str, Any] | None:
        doc = self.docs.get(path)
        return None if doc is None else json.loads(json.dumps(doc))

    def set(self, path: Path, data: dict[str, Any], merge: bool = False) -> None:
        clean = json.loads(json.dumps(data))
        self.docs[path] = {**self.docs.get(path, {}), **clean} if merge else clean

    def set_many(self, items: list[tuple[Path, dict[str, Any]]]) -> None:
        for path, data in items:
            self.set(path, data)

    def list(self, path: Path) -> list[dict[str, Any]]:
        depth = len(path) + 1
        return [
            {**json.loads(json.dumps(doc)), "id": doc_path[-1]}
            for doc_path, doc in self.docs.items()
            if len(doc_path) == depth and doc_path[: len(path)] == path
        ]

    def preparing_courses(self) -> list[tuple[Path, dict[str, Any]]]:
        return [
            (path, json.loads(json.dumps(doc)))
            for path, doc in self.docs.items()
            if len(path) == 4 and path[0] == "users" and path[2] == "courses" and doc.get("status") == "preparing"
        ]

    def delete_user(self, uid: str) -> None:
        for path in [path for path in self.docs if path[:2] == ("users", uid)]:
            del self.docs[path]
        self.deleted_users.append(uid)


class FirestoreStore:
    """Firestore via le SDK Admin."""

    def __init__(self, client: Any) -> None:
        self._client = client

    def _ref(self, path: Path) -> Any:
        return self._client.document("/".join(path))

    def get(self, path: Path) -> dict[str, Any] | None:
        snapshot = self._ref(path).get()
        return snapshot.to_dict() if snapshot.exists else None

    def set(self, path: Path, data: dict[str, Any], merge: bool = False) -> None:
        self._ref(path).set(data, merge=merge)

    def set_many(self, items: list[tuple[Path, dict[str, Any]]]) -> None:
        # Un lot Firestore accepte au plus 500 écritures.
        for start in range(0, len(items), 400):
            batch = self._client.batch()
            for path, data in items[start : start + 400]:
                batch.set(self._ref(path), data)
            batch.commit()

    def list(self, path: Path) -> list[dict[str, Any]]:
        collection = self._client.collection("/".join(path))
        return [{**doc.to_dict(), "id": doc.id} for doc in collection.stream()]

    def preparing_courses(self) -> list[tuple[Path, dict[str, Any]]]:
        # Parcours par étudiant (une requête par étudiant) : évite d'exiger un index de groupe de collections.
        found: list[tuple[Path, dict[str, Any]]] = []
        for user in self._client.collection("users").list_documents():
            query = user.collection("courses").where("status", "==", "preparing")
            for doc in query.stream():
                found.append((("users", user.id, "courses", doc.id), doc.to_dict() or {}))
        return found

    def delete_user(self, uid: str) -> None:
        """Supprime tout ce que l'étudiant a dans Firestore (users/{uid} et tout ce qu'il contient), puis son compte de connexion."""
        from firebase_admin import auth

        self._client.recursive_delete(self._client.document(f"users/{uid}"))
        try:
            auth.delete_user(uid)
        except auth.UserNotFoundError:
            pass  # déjà supprimé : le résultat voulu
