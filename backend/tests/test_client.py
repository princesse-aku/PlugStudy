"""Le vrai client RodiumClient contre un faux serveur compatible OpenAI (aucune clé réelle, aucun réseau externe)."""

import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

from app.ai import AIError, RodiumClient
from app.config import Settings


class Handler(BaseHTTPRequestHandler):
    requests: list[dict] = []
    mode = "ok"

    def log_message(self, *args):  # silence
        pass

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        Handler.requests.append({"path": self.path, "auth": self.headers.get("Authorization"), "body": body})
        if Handler.mode == "no_json_mode" and "response_format" in body:
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error": {"message": "response_format not supported", "type": "invalid_request_error"}}')
            return
        if Handler.mode == "empty_with_json" and "response_format" in body:
            raw = json.dumps({"id": "x", "object": "chat.completion", "created": 0, "model": body["model"], "choices": []}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)
            return
        if Handler.mode == "error":
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b"{}")
            return
        if self.path.endswith("/chat/completions"):
            content = "```json\n{\"summary\": \"ok\"}\n```" if Handler.mode == "fenced" else "pas du json" if Handler.mode == "text" else '{"summary": "ok"}'
            finish = "length" if Handler.mode == "length" else "stop"
            payload = {
                "id": "x", "object": "chat.completion", "created": 0, "model": body["model"],
                "choices": [{"index": 0, "finish_reason": finish, "message": {"role": "assistant", "content": content}}],
            }
        else:
            # Les vecteurs sont renvoyés dans le désordre : le client doit les remettre dans l'ordre.
            payload = {
                "object": "list", "model": body["model"], "usage": {"prompt_tokens": 1, "total_tokens": 1},
                "data": [{"object": "embedding", "index": i, "embedding": [float(i)]} for i in reversed(range(len(body["input"])))],
            }
        raw = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)


@pytest.fixture
def server():
    Handler.requests, Handler.mode = [], "ok"
    httpd = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_port}/v1"
    httpd.shutdown()


def client(base_url: str, key: str = "cle-test", **options) -> RodiumClient:
    return RodiumClient(
        Settings(rodiumai_base_url=base_url, rodiumai_api_key=key, rodium_timeout_seconds=5, _env_file=None, **options)
    )


def test_envoie_modele_et_cle_sans_mode_json_par_defaut(server):
    ai = client(server)
    assert ai.complete_json(role="strong", system="s", user="u") == {"summary": "ok"}
    ai.complete_json(role="fast", system="s", user="u")
    first, second = Handler.requests
    assert first["path"] == "/v1/chat/completions" and first["auth"] == "Bearer cle-test"
    # Le MVP utilise un seul modèle pour toutes les tâches.
    assert first["body"]["model"] == "anthropic/claude-haiku-5-5" and second["body"]["model"] == "anthropic/claude-haiku-5-5"
    assert "response_format" not in first["body"]  # la passerelle le gère mal avec ce modèle
    assert [m["role"] for m in first["body"]["messages"]] == ["system", "user"]


def test_ajoute_une_marge_de_jetons_pour_la_reflexion(server):
    client(server).complete_json(role="fast", system="s", user="u", max_tokens=300)
    assert Handler.requests[0]["body"]["max_tokens"] == 300 + 6000


def test_mode_json_optionnel(server):
    client(server, rodium_json_mode=True).complete_json(role="fast", system="s", user="u")
    assert Handler.requests[0]["body"]["response_format"] == {"type": "json_object"}


def test_reponse_tronquee_leve_une_erreur_claire(server):
    Handler.mode = "length"
    with pytest.raises(AIError, match="tronquée"):
        client(server).complete_json(role="fast", system="s", user="u")


def test_reessaie_sans_mode_json_si_la_reponse_est_vide(server):
    Handler.mode = "empty_with_json"
    assert client(server, rodium_json_mode=True).complete_json(role="fast", system="s", user="u") == {"summary": "ok"}
    assert len(Handler.requests) == 2 and "response_format" not in Handler.requests[1]["body"]


def test_accepte_une_reponse_en_bloc_de_code(server):
    Handler.mode = "fenced"
    assert client(server).complete_json(role="fast", system="s", user="u") == {"summary": "ok"}


def test_reessaie_sans_mode_json_si_le_fournisseur_le_refuse(server):
    Handler.mode = "no_json_mode"
    assert client(server, rodium_json_mode=True).complete_json(role="fast", system="s", user="u") == {"summary": "ok"}
    assert len(Handler.requests) == 2
    assert "response_format" in Handler.requests[0]["body"] and "response_format" not in Handler.requests[1]["body"]


def test_reponse_illisible_leve_une_erreur_claire(server):
    Handler.mode = "text"
    with pytest.raises(AIError):
        client(server).complete_json(role="fast", system="s", user="u")


def test_panne_du_serveur_leve_une_erreur_sans_fuite(server):
    Handler.mode = "error"
    with pytest.raises(AIError) as info:
        client(server).complete_json(role="fast", system="s", user="u")
    assert "cle-test" not in str(info.value)


def test_embeddings_par_lots_et_dans_l_ordre(server):
    vectors = client(server).embed([f"texte {i}" for i in range(70)])
    assert vectors == [[float(i % 64)] for i in range(70)]
    assert [len(r["body"]["input"]) for r in Handler.requests] == [64, 6]
    assert Handler.requests[0]["body"]["model"] == "text-embedding-3-small"


def test_non_configure():
    with pytest.raises(AIError, match="pas configurée"):
        client("", key="").complete_json(role="fast", system="s", user="u")
    with pytest.raises(AIError, match="pas configurée"):
        client("", key="").embed(["x"])
