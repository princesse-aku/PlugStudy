from fastapi.testclient import TestClient

from app.auth import current_uid, get_store
from app.config import get_settings
from app.main import app
from app.store import MemoryStore, course_path
from tests.conftest import COURSE_ID, UID


def _client(store, uid=UID):
    app.dependency_overrides[current_uid] = lambda: uid
    app.dependency_overrides[get_store] = lambda: store
    return TestClient(app)


class TestSuppressionDuCompte:
    def teardown_method(self):
        app.dependency_overrides.clear()

    def test_supprime_tout_ce_que_l_etudiant_possede_et_rien_d_autre(self, store):
        store.set(("users", UID), {"niveau": "Licence 1"})
        store.set(course_path(UID, COURSE_ID, "notions", "n1"), {"title": "Boucles"})
        store.set(("users", UID, "attempts", "t1"), {"score": 3})
        store.set(("users", "autre"), {"niveau": "Master"})
        store.set(course_path("autre", "c9"), {"name": "Intact"})

        reply = _client(store).delete("/account")

        assert reply.status_code == 204
        assert not [path for path in store.docs if path[:2] == ("users", UID)]
        assert store.deleted_users == [UID]
        assert store.get(course_path("autre", "c9")) == {"name": "Intact"}
        assert store.get(("users", "autre")) == {"niveau": "Master"}

    def test_demande_une_connexion(self, store):
        app.dependency_overrides[get_store] = lambda: store
        assert TestClient(app).delete("/account").status_code == 401

    def test_dit_quand_la_suppression_echoue(self):
        class Broken(MemoryStore):
            def delete_user(self, uid):
                raise RuntimeError("Firestore indisponible")

        assert _client(Broken()).delete("/account").status_code == 503

    def test_le_navigateur_peut_envoyer_delete(self, store):
        app.dependency_overrides[get_settings] = lambda: get_settings()
        reply = TestClient(app).options(
            "/account",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "DELETE",
                "Access-Control-Request-Headers": "authorization",
            },
        )
        assert "DELETE" in reply.headers.get("access-control-allow-methods", "")
