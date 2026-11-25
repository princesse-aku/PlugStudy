from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Réglages lus dans l'environnement (ou dans backend/.env en local). Aucune clé n'est écrite dans le code."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Firebase : le même projet que le frontend. Les identifiants viennent d'un compte de service.
    firebase_project_id: str = ""
    firebase_credentials_json: str = ""  # contenu JSON du compte de service (variable secrète sur Render)

    # API RodiumAI (compatible OpenAI : /chat/completions et /embeddings).
    rodiumai_base_url: str = ""
    rodiumai_api_key: str = ""
    rodium_model_strong: str = "google/gemini-3.8-flash"  # extraction des notions, génération du quiz
    rodium_model_fast: str = "google/gemini-3.8-flash"  # résumés et réponses de l'assistant
    rodium_model_embedding: str = "text-embedding-3-small"
    # Les embeddings ne servent qu'à l'assistant (caché dans le MVP) : désactivés pour gagner du temps et de l'argent.
    rodium_embeddings_enabled: bool = False
    rodium_timeout_seconds: float = 120.0
    # google/gemini-3.8-flash est un modèle « à réflexion » : les jetons de réflexion comptent dans la limite de sortie.
    # Sans marge, il s'arrête avant d'écrire sa réponse. Cette marge s'ajoute à la limite demandée par chaque appel.
    rodium_reasoning_budget: int = 6000
    # « Mode JSON » de l'API : désactivé, car la passerelle renvoie une réponse vide avec ce modèle. Le prompt demande
    # déjà du JSON et parse_json sait lire une réponse entourée de ```json … ```.
    rodium_json_mode: bool = False

    # Sécurité et limites.
    allowed_origins: str = "http://localhost:3000"  # séparées par des virgules
    max_upload_mb: int = 20
    min_text_chars: int = 200  # en dessous, le fichier est considéré comme illisible (PDF scanné, photo…)
    rate_limit_per_minute: int = 20

    # Pipeline.
    max_notions: int = 18
    max_questions: int = 8
    window_chars: int = 12000
    max_windows: int = 8

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()

