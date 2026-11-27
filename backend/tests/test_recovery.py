from app.recovery import recover_in_background, recover_stalled_courses
from app.store import MemoryStore, course_path

BOOT = 1000.0


def _store() -> MemoryStore:
    store = MemoryStore()
    store.set(course_path("u1", "vieux"), {"status": "preparing", "processingStartedAt": BOOT - 300})
    store.set(course_path("u1", "sans-date"), {"status": "preparing"})
    store.set(course_path("u2", "recent"), {"status": "preparing", "processingStartedAt": BOOT + 5})
    store.set(course_path("u2", "pret"), {"status": "ready"})
    store.set(course_path("u2", "pret", "notions", "n1"), {"status": "preparing"})  # sous-document : ignoré
    return store


class TestRecovery:
    def test_marque_en_echec_les_cours_coupes_par_le_redemarrage(self):
        store = _store()
        assert recover_stalled_courses(store, BOOT) == 2
        for course_id, uid in (("vieux", "u1"), ("sans-date", "u1")):
            assert store.get(course_path(uid, course_id)) | {} == {
                **store.get(course_path(uid, course_id)),
                "status": "error",
                "errorReason": "failed",
            }

    def test_laisse_les_cours_prets_et_les_envois_recus_apres_le_demarrage(self):
        store = _store()
        recover_stalled_courses(store, BOOT)
        assert store.get(course_path("u2", "recent"))["status"] == "preparing"
        assert store.get(course_path("u2", "pret"))["status"] == "ready"
        assert store.get(course_path("u2", "pret", "notions", "n1"))["status"] == "preparing"

    def test_ne_plante_jamais_le_demarrage(self):
        class Broken(MemoryStore):
            def preparing_courses(self):
                raise RuntimeError("Firestore indisponible")

        recover_in_background(Broken(), BOOT)  # ne doit pas lever
