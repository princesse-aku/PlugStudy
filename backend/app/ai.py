"""Client de l'API RodiumAI (compatible OpenAI : /chat/completions et /embeddings).

Les clés restent ici, dans le backend : le frontend n'en voit jamais. Le modèle et l'adresse viennent de
l'environnement (voir config.py).
"""

from __future__ import annotations

import json
import re
from typing import Any, Literal, Protocol

from app.config import Settings

Role = Literal["strong", "fast"]


class AIError(Exception):
    """L'IA est indisponible, mal configurée ou a répondu autre chose que du JSON utilisable."""


class AIClient(Protocol):
    def complete_json(self, *, role: Role, system: str, user: str, max_tokens: int = 2000) -> dict[str, Any]: ...

    def embed(self, texts: list[str]) -> list[list[float]]: ...


def parse_json(text: str) -> dict[str, Any]:
    """JSON d'une réponse de modèle, même entourée de ```json … ```."""
    cleaned = text.strip()
    fenced = re.match(r"^```(?:json)?\s*(.*?)\s*```$", cleaned, re.DOTALL)
    if fenced:
        cleaned = fenced.group(1)
    try:
        value = json.loads(cleaned)
    except json.JSONDecodeError as error:
        raise AIError("Réponse de l'IA illisible.") from error
    if not isinstance(value, dict):
        raise AIError("Réponse de l'IA inattendue.")
    return value


class RodiumClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._client: Any = None

    def _api(self) -> Any:
        if self._client is None:
            if not self._settings.rodiumai_base_url or not self._settings.rodiumai_api_key:
                raise AIError("L'API RodiumAI n'est pas configurée.")
            from openai import OpenAI

            self._client = OpenAI(
                base_url=self._settings.rodiumai_base_url,
                api_key=self._settings.rodiumai_api_key,
                timeout=self._settings.rodium_timeout_seconds,
                max_retries=2,
            )
        return self._client

    def _create(self, params: dict[str, Any], json_mode: bool) -> Any:
        extra = {"response_format": {"type": "json_object"}} if json_mode else {}
        response = self._api().chat.completions.create(**params, **extra)
        if not getattr(response, "choices", None):
            raise AIError("Réponse de l'IA vide.")
        return response

    def complete_json(self, *, role: Role, system: str, user: str, max_tokens: int = 2000) -> dict[str, Any]:
        model = self._settings.rodium_model_strong if role == "strong" else self._settings.rodium_model_fast
        params: dict[str, Any] = {
            "model": model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "temperature": 0.2,
            # Les jetons de réflexion comptent dans la limite : sans marge, le modèle s'arrête avant sa réponse.
            "max_tokens": max_tokens + self._settings.rodium_reasoning_budget,
        }
        try:
            try:
                response = self._create(params, self._settings.rodium_json_mode)
            except Exception as error:
                # Fournisseur qui refuse le « mode JSON » (erreur 400) ou répond vide avec : on réessaie sans.
                refused = type(error).__name__ == "BadRequestError" or isinstance(error, AIError)
                if not (self._settings.rodium_json_mode and refused):
                    raise
                response = self._create(params, False)
        except AIError:
            raise
        except Exception as error:  # réseau, quota, modèle inconnu…
            raise AIError(f"Appel à l'IA impossible ({type(error).__name__}).") from error
        choice = response.choices[0]
        if choice.finish_reason == "length":
            raise AIError("Réponse de l'IA tronquée (limite de jetons atteinte).")
        return parse_json(choice.message.content or "")

    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors: list[list[float]] = []
        for start in range(0, len(texts), 64):
            batch = texts[start : start + 64]
            try:
                response = self._api().embeddings.create(model=self._settings.rodium_model_embedding, input=batch)
            except AIError:
                raise
            except Exception as error:
                raise AIError(f"Calcul des embeddings impossible ({type(error).__name__}).") from error
            vectors.extend(item.embedding for item in sorted(response.data, key=lambda item: item.index))
        return vectors
