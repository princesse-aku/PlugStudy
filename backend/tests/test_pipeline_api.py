import pytest
from fastapi.testclient import TestClient

from app.ai import AIError, parse_json
from app.analysis import page_infos
from app.extract import extract_document
from app.generate import build_notions, extract_raw_notions, generate_questions, not_found_message
from app.main import app, get_ai
from app.auth import current_uid, get_store
from app.config import get_settings
from app.pipeline import process_course
from app.store import MemoryStore, course_path
from tests.conftest import COURSE_ID, COURSE_TEXT, NOTIONS, UID, FakeAI, make_docx, make_pdf


def run(store, settings, ai=None, name="cours.txt", data=None):
    process_course(store, ai or FakeAI(), settings, UID, COURSE_ID, name, data if data is not None else COURSE_TEXT.encode())
    return store.get(course_path(UID, COURSE_ID))


class TestPipeline:
    def test_prepare_le_cours_de_bout_en_bout(self, store, settings):
        course = run(store, settings)
        assert course["status"] == "ready" and course["prepStep"] == 4
        assert course["summary"] == "Ce cours présente les algorithmes."
        assert course["outline"] and course["outline"][0]["title"].startswith("CHAPITRE 1")

        notions = {n["id"]: n for n in store.list(course_path(UID, COURSE_ID, "notions"))}
        assert set(notions) == {"n01", "n02", "n03"}
        scores = [0.4 * n["importance"] + 0.3 * n["frequency"] + 0.3 * n["position"] for _, n in sorted(notions.items())]
        assert scores == sorted(scores, reverse=True)  # classées de la plus à la moins prioritaire
        complexite = next(n for n in notions.values() if n["title"] == "Complexité algorithmique")
        assert complexite["source"] == "Algorithmique, chap. 1, partie 1"
        assert complexite["mastery"] == 0 and 0 <= complexite["frequency"] <= 1
        assert complexite["position"] == 0.7  # citée dans la zone d'exercices
        assert complexite["excerpt"].startswith("La complexité algorithmique décrit")
        boucles = next(n for n in notions.values() if n["title"] == "Boucles")
        assert boucles["source"] == "Algorithmique, chap. 2, partie 1" or boucles["source"].startswith("Algorithmique, chap.")

    def test_ecrit_quiz_et_passages(self, store, settings):
        run(store, settings)
        questions = store.list(course_path(UID, COURSE_ID, "questions"))
        assert len(questions) == 9  # 3 notions × 3 questions : chaque notion a son quiz
        for notion_id in ("n01", "n02", "n03"):
            assert len([q for q in questions if q["notionId"] == notion_id]) == 3
        for q in questions:
            assert len(q["choices"]) == 4 and q["choices"][q["correctIndex"]] == "Bonne réponse"
            assert q["source"].startswith("Algorithmique")
        chunks = store.list(course_path(UID, COURSE_ID, "chunks"))
        assert chunks and all(len(c["embedding"]) == 64 for c in chunks)

    def test_marque_chaque_etape(self, store, settings):
        steps = []
        original = store.set

        def spy(path, data, merge=False):
            if "prepStep" in data:
                steps.append(data["prepStep"])
            original(path, data, merge)

        store.set = spy  # type: ignore[method-assign]
        run(store, settings)
        assert steps == [0, 1, 2, 3, 4]

    def test_pdf_et_docx(self, store, settings):
        assert run(store, settings, name="c.pdf", data=make_pdf(COURSE_TEXT))["status"] == "ready"
        store.set(course_path(UID, COURSE_ID), {"status": "preparing"}, merge=True)
        assert run(store, settings, name="c.docx", data=make_docx(COURSE_TEXT))["status"] == "ready"

    def test_pdf_scanne_donne_une_erreur_claire(self, store, settings):
        course = run(store, settings, name="scan.pdf", data=make_pdf(None))
        assert (course["status"], course["errorReason"]) == ("error", "unreadable")
        assert store.list(course_path(UID, COURSE_ID, "notions")) == []

    def test_format_non_pris_en_charge(self, store, settings):
        course = run(store, settings, name="cours.ppt", data=b"x")
        assert (course["status"], course["errorReason"]) == ("error", "format")

    def test_panne_de_l_ia(self, store, settings):
        course = run(store, settings, ai=FakeAI(fail=True))
        assert (course["status"], course["errorReason"]) == ("error", "ai")

    def test_aucune_notion_exploitable(self, store, settings):
        invented = [{"title": "Notion inventée", "quote": "Une phrase que le cours ne contient absolument pas du tout.", "simple": "Explication quelconque.", "importance": 1}]
        course = run(store, settings, ai=FakeAI(notions=invented))
        assert (course["status"], course["errorReason"]) == ("error", "empty")

    def test_embeddings_desactives_par_defaut_dans_le_mvp(self, store, settings):
        from app.config import Settings

        assert Settings(_env_file=None).rodium_embeddings_enabled is False
        assert Settings(_env_file=None).rodium_model_strong == "anthropic/claude-haiku-5-5"
        calls = []

        class Spy(FakeAI):
            def embed(self, texts):
                calls.append(texts)
                return super().embed(texts)

        no_embed = settings.model_copy(update={"rodium_embeddings_enabled": False})
        course = run(store, no_embed, ai=Spy())
        assert course["status"] == "ready" and calls == []
        assert all("embedding" not in c for c in store.list(course_path(UID, COURSE_ID, "chunks")))

    def test_sans_embeddings_le_cours_est_quand_meme_pret(self, store, settings):
        course = run(store, settings, ai=FakeAI(no_embeddings=True))
        assert course["status"] == "ready"
        assert all("embedding" not in c for c in store.list(course_path(UID, COURSE_ID, "chunks")))

    def test_erreur_inattendue_ne_bloque_pas_le_cours(self, store, settings):
        class Broken(FakeAI):
            def complete_json(self, **kwargs):
                raise RuntimeError("bug")

        course = run(store, settings, ai=Broken())
        assert (course["status"], course["errorReason"]) == ("error", "failed")

    def test_ne_touche_pas_aux_autres_etudiants(self, store, settings):
        store.set(course_path("autre", "c9"), {"name": "Secret", "status": "preparing"})
        run(store, settings)
        assert store.get(course_path("autre", "c9")) == {"name": "Secret", "status": "preparing"}


class TestGeneration:
    def doc(self):
        return extract_document("c.txt", COURSE_TEXT.encode())

    def test_une_notion_sans_preuve_est_ecartee(self, settings):
        doc = self.doc()
        raw = extract_raw_notions(
            FakeAI(notions=NOTIONS + [{"title": "Fantôme", "quote": "Cette phrase n'existe dans aucun cours de la planète.", "simple": "Rien.", "importance": 1}]),
            doc,
            settings,
        )
        built = build_notions(raw, doc, page_infos(doc), "Algorithmique", settings)
        assert sorted(n.data["title"] for n in built) == ["Boucles", "Complexité algorithmique", "Variables et types"]

    def test_notion_mal_formee_ecartee_sans_perdre_le_reste(self, settings):
        doc = self.doc()
        raw = extract_raw_notions(FakeAI(notions=NOTIONS + [{"title": "x"}, "n'importe quoi", {"title": "Ok ok", "quote": "court"}]), doc, settings)
        assert len(raw) == 3

    def test_importance_hors_bornes_ramenee_entre_0_et_1(self, settings):
        doc = self.doc()
        notions = [{**NOTIONS[0], "importance": 7}, {**NOTIONS[1], "importance": "0.5"}]
        raw = extract_raw_notions(FakeAI(notions=notions), doc, settings)
        assert sorted(n.importance for n in raw) == [0.5, 1.0]

    def test_doublons_fusionnes_en_gardant_la_meilleure_importance(self, settings):
        doc = self.doc()
        notions = [{**NOTIONS[0], "importance": 0.4}, {**NOTIONS[0], "title": "complexité algorithmique", "importance": 0.9}]
        raw = extract_raw_notions(FakeAI(notions=notions), doc, settings)
        assert len(raw) == 1 and raw[0].importance == 0.9

    def test_score_s(self, settings):
        doc = self.doc()
        raw = extract_raw_notions(FakeAI(), doc, settings)
        built = build_notions(raw, doc, page_infos(doc), "Algorithmique", settings)
        by_title = {n.data["title"]: n.data for n in built}
        complexite = by_title["Complexité algorithmique"]
        assert complexite["importance"] == 1.0 and complexite["position"] == 0.7
        assert 0 < complexite["frequency"] <= 1
        scores = [0.4 * n.data["importance"] + 0.3 * n.data["frequency"] + 0.3 * n.data["position"] for n in built]
        assert scores == sorted(scores, reverse=True)
        assert [n.id for n in built] == ["n01", "n02", "n03"]

    def test_questions_invalides_ecartees(self, settings):
        doc = self.doc()
        raw = extract_raw_notions(FakeAI(), doc, settings)
        built = build_notions(raw, doc, page_infos(doc), "Algorithmique", settings)

        class Bad(FakeAI):
            def complete_json(self, **kw):
                if kw["system"].startswith("Tu écris des questions"):
                    return {
                        "questions": [
                            {"notion": "n01", "text": "Question valide pour la notion ?", "choices": ["a1", "b2", "c3", "d4"], "correct": 2, "explanation": "Parce que c3 est la bonne réponse du cours."},
                            {"notion": "n02", "text": "Choix en double dans cette question ?", "choices": ["x", "x", "y", "z"], "correct": 0, "explanation": "Une explication suffisamment longue."},
                            {"notion": "n03", "text": "Index de réponse hors limites ici ?", "choices": ["a", "b", "c", "d"], "correct": 9, "explanation": "Une explication suffisamment longue."},
                            {"notion": "n99", "text": "Notion qui n'existe pas du tout ?", "choices": ["a", "b", "c", "d"], "correct": 1, "explanation": "Une explication suffisamment longue."},
                        ]
                    }
                return super().complete_json(**kw)

        result = generate_questions(Bad(), built, doc, settings)
        assert [qid for qid, _ in result] == ["q-n01-1"]
        data = result[0][1]
        assert data["choices"][data["correctIndex"]] == "c3"  # le mélange garde la bonne réponse

    def test_parse_json_accepte_les_blocs_de_code(self):
        assert parse_json('```json\n{"a": 1}\n```') == {"a": 1}
        with pytest.raises(AIError):
            parse_json("pas du json")
        with pytest.raises(AIError):
            parse_json("[1, 2]")


@pytest.fixture
def client(store, settings):
    ai = FakeAI()
    app.dependency_overrides[current_uid] = lambda: UID
    app.dependency_overrides[get_store] = lambda: store
    app.dependency_overrides[get_ai] = lambda: ai
    app.dependency_overrides[get_settings] = lambda: settings
    yield TestClient(app)
    app.dependency_overrides.clear()


def upload(client, name="cours.txt", data=None, course_id=COURSE_ID, language=None):
    return client.post(
        f"/courses/{course_id}/process",
        files={"file": (name, data if data is not None else COURSE_TEXT.encode(), "application/octet-stream")},
        data={"language": language} if language else None,
    )


class TestApi:
    def test_health(self, client):
        assert client.get("/health").json() == {"status": "ok"}

    def test_sans_jeton_401(self):
        plain = TestClient(app)
        assert plain.post("/courses/c1/assistant", json={"question": "Bonjour ?"}).status_code == 401
        assert plain.post("/courses/c1/process", files={"file": ("a.txt", b"x")}).status_code == 401

    def test_jeton_invalide_401(self):
        plain = TestClient(app)
        response = plain.post("/courses/c1/assistant", json={"question": "Bonjour ?"}, headers={"Authorization": "Bearer faux"})
        assert response.status_code == 401

    def test_envoi_du_fichier_prepare_le_cours(self, client, store):
        response = upload(client)
        assert response.status_code == 202 and response.json() == {"status": "processing"}
        course = store.get(course_path(UID, COURSE_ID))
        assert course["status"] == "ready" and course["prepStep"] == 4

    def test_format_refuse_415(self, client):
        assert upload(client, "photo.png", b"x").status_code == 415

    def test_fichier_vide_400(self, client):
        assert upload(client, "vide.txt", b"").status_code == 400

    def test_fichier_trop_gros_413(self, client):
        assert upload(client, "gros.txt", b"a" * (1024 * 1024 + 1)).status_code == 413

    def test_cours_inconnu_404(self, client):
        assert upload(client, course_id="nope").status_code == 404

    def test_identifiant_de_cours_invalide_404(self, client):
        assert upload(client, course_id="a..b").status_code == 404

    def test_cours_deja_pret_409(self, client, store):
        store.set(course_path(UID, COURSE_ID), {"status": "ready"}, merge=True)
        assert upload(client).status_code == 409

    def test_double_envoi_pendant_le_traitement_409(self, client, store):
        import time

        store.set(course_path(UID, COURSE_ID), {"status": "preparing", "processingStartedAt": time.time()}, merge=True)
        assert upload(client).status_code == 409

    def test_un_cours_en_erreur_peut_etre_renvoye(self, client, store):
        store.set(course_path(UID, COURSE_ID), {"status": "error", "errorReason": "unreadable"}, merge=True)
        assert upload(client).status_code == 202
        assert store.get(course_path(UID, COURSE_ID))["status"] == "ready"

    def test_un_etudiant_ne_voit_pas_le_cours_d_un_autre(self, client, store):
        store.set(course_path("autre", "c2"), {"name": "Secret", "status": "preparing"})
        assert upload(client, course_id="c2").status_code == 404


class TestAssistantApi:
    def ready(self, client, store):
        assert upload(client).status_code == 202

    def ask(self, client, question):
        return client.post(f"/courses/{COURSE_ID}/assistant", json={"question": question})

    def test_repond_avec_la_source(self, client, store):
        self.ready(client, store)
        body = self.ask(client, "C'est quoi une boucle ?").json()
        assert body["text"] == "Une boucle répète des instructions."
        assert body["source"].startswith("Algorithmique, chap.")

    def test_repond_par_mots_si_pas_d_embeddings(self, store, settings):
        ai = FakeAI(no_embeddings=True)
        app.dependency_overrides[current_uid] = lambda: UID
        app.dependency_overrides[get_store] = lambda: store
        app.dependency_overrides[get_ai] = lambda: ai
        app.dependency_overrides[get_settings] = lambda: settings
        try:
            c = TestClient(app)
            assert upload(c).status_code == 202
            assert self.ask(c, "C'est quoi une boucle ?").json()["source"]
        finally:
            app.dependency_overrides.clear()

    def test_dit_quand_ce_n_est_pas_dans_le_cours(self, client, store):
        self.ready(client, store)
        body = self.ask(client, "Qui a gagné la coupe du monde de football ?").json()
        assert body == {"text": not_found_message("Algorithmique"), "source": None}

    def test_le_modele_peut_dire_qu_il_ne_sait_pas(self, client, store):
        self.ready(client, store)

        class NoPassage(FakeAI):
            def complete_json(self, **kw):
                if kw["system"].startswith("Tu es l'assistant"):
                    return {"answer": "Je ne sais pas.", "passage": None}
                return super().complete_json(**kw)

        app.dependency_overrides[get_ai] = lambda: NoPassage()
        body = self.ask(client, "C'est quoi une boucle ?").json()
        assert body["source"] is None and "Je ne trouve pas ça" in body["text"]

    def test_cours_pas_pret_409(self, client):
        assert self.ask(client, "Une question ?").status_code == 409

    def test_question_trop_courte_ou_trop_longue_422(self, client):
        assert self.ask(client, "?").status_code == 422
        assert self.ask(client, "a" * 501).status_code == 422

    def test_panne_de_l_ia_503(self, client, store):
        self.ready(client, store)
        app.dependency_overrides[get_ai] = lambda: FakeAI(fail=True)
        assert self.ask(client, "C'est quoi une boucle ?").status_code == 503

    def test_cours_inconnu_404(self, client):
        assert client.post("/courses/nope/assistant", json={"question": "Bonjour ?"}).status_code == 404


class TestLongCourse:
    def test_les_tranches_sont_traitees_ensemble_dans_l_ordre(self, settings):
        import threading
        import time

        from app.extract import Document, Page

        doc = Document([Page(i, f"Page {i}. " + "texte du cours " * 60) for i in range(1, 25)], "p.")
        small = settings.model_copy(update={"window_chars": 1200, "max_windows": 6})
        active, peak, order = 0, 0, []
        lock = threading.Lock()

        class Slow(FakeAI):
            def complete_json(self, **kw):
                nonlocal active, peak
                with lock:
                    active += 1
                    peak = max(peak, active)
                time.sleep(0.05)
                with lock:
                    active -= 1
                    order.append(kw["user"][:12])
                return {"summary": "Résumé."} if kw["system"].startswith(("Tu résumes", "Tu fusionnes")) else super().complete_json(**kw)

        from app.generate import summarize

        assert summarize(Slow(), doc, small) == "Résumé."
        assert peak >= 2  # plusieurs appels en même temps


class TestQuizRetries:
    def questions_calls(self, ai):
        return [c for c in ai.calls if c[1].startswith("Tu écris des questions")]

    def test_reessaie_quand_le_quiz_sort_vide(self, store, settings):
        class Flaky(FakeAI):
            def __init__(self):
                super().__init__()
                self.asked = 0

            def complete_json(self, **kw):
                if kw["system"].startswith("Tu écris des questions"):
                    self.asked += 1
                    if self.asked == 1:
                        return {"questions": "pas une liste"}
                return super().complete_json(**kw)

        ai = Flaky()
        course = run(store, settings, ai=ai)
        assert course["status"] == "ready" and ai.asked == 2
        assert len(store.list(course_path(UID, COURSE_ID, "questions"))) == 9

    def test_abandonne_apres_trois_essais_sans_bloquer_le_cours(self, store, settings):
        class NoQuiz(FakeAI):
            def complete_json(self, **kw):
                if kw["system"].startswith("Tu écris des questions"):
                    self.asked = getattr(self, "asked", 0) + 1
                    return {"questions": []}
                return super().complete_json(**kw)

        ai = NoQuiz()
        course = run(store, settings, ai=ai)
        assert ai.asked == 3
        assert course["status"] == "ready"  # les notions et la fiche restent utilisables
        assert store.list(course_path(UID, COURSE_ID, "questions")) == []

    def test_une_seule_tentative_si_le_quiz_est_bon(self, store, settings):
        ai = FakeAI()
        run(store, settings, ai=ai)
        assert len(self.questions_calls(ai)) == 1


class TestLanguage:
    """Résumé, notions et quiz sont écrits dans la langue de l'étudiant ; le cours, lui, reste dans sa langue."""

    def test_francais_par_defaut(self, store, settings):
        ai = FakeAI()
        course = run(store, settings, ai=ai)
        assert course["language"] == "fr"
        assert all("français simple" in p for p in ai.prompts)
        assert not any("simple English" in p for p in ai.prompts)
        notion = store.list(course_path(UID, COURSE_ID, "notions"))[0]
        assert ", chap. " in notion["source"]

    def test_anglais_pour_toutes_les_generations(self, store, settings):
        ai = FakeAI()
        process_course(store, ai, settings, UID, COURSE_ID, "cours.txt", COURSE_TEXT.encode(), language="en")
        course = store.get(course_path(UID, COURSE_ID))
        assert course["status"] == "ready" and course["language"] == "en"
        # résumé, notions et quiz : chaque appel demande de l'anglais simple
        assert len(ai.prompts) >= 3 and all("simple English" in p for p in ai.prompts)
        notion = store.list(course_path(UID, COURSE_ID, "notions"))[0]
        assert ", ch. " in notion["source"] and ", chap. " not in notion["source"]
        chunk = store.list(course_path(UID, COURSE_ID, "chunks"))[0]
        assert ", ch. " in chunk["source"]

    def test_langue_inconnue_retombe_sur_le_francais(self, store, settings):
        course = run(store, settings)  # défaut
        assert course["language"] == "fr"
        process_course(store, FakeAI(), settings, UID, COURSE_ID, "cours.txt", COURSE_TEXT.encode(), language="xx")
        assert store.get(course_path(UID, COURSE_ID))["language"] == "fr"

    def test_titre_anglais_mais_calculs_sur_le_terme_du_cours(self, settings):
        doc = extract_document("c.txt", COURSE_TEXT.encode())
        infos = page_infos(doc)
        english = [{**NOTIONS[0], "title": "Algorithmic complexity", "term": "Complexité algorithmique"}]
        raw = extract_raw_notions(FakeAI(notions=english), doc, settings, "en")
        built = build_notions(raw, doc, infos, "Algorithmique", settings, "en")
        data = built[0].data
        assert data["title"] == "Algorithmic complexity"
        assert data["frequency"] == 1.0 and data["position"] == 0.7  # calculés sur « Complexité algorithmique »
        assert data["excerpt"].startswith("La complexité algorithmique")  # l'extrait reste dans la langue du cours

    def test_sans_terme_le_titre_sert_de_repli(self, settings):
        doc = extract_document("c.txt", COURSE_TEXT.encode())
        raw = extract_raw_notions(FakeAI(), doc, settings)
        assert all(n.term is None and n.key_term == n.title for n in raw)

    def test_etiquettes_de_source(self):
        from app.analysis import source_label
        from app.extract import Document, Page

        pptx = Document([Page(3, "x")], "diapo")
        txt = Document([Page(2, "x")], "partie")
        infos = {3: type("I", (), {"chapter": None})(), 2: type("I", (), {"chapter": "4"})()}
        assert source_label("Cours", pptx, infos, 3, "fr") == "Cours, diapo 3"
        assert source_label("Cours", pptx, infos, 3, "en") == "Cours, slide 3"
        assert source_label("Cours", txt, infos, 2, "fr") == "Cours, chap. 4, partie 2"
        assert source_label("Cours", txt, infos, 2, "en") == "Cours, ch. 4, part 2"

    def test_message_introuvable_en_anglais(self):
        assert "I can't find that in your Algorithmique course" in not_found_message("Algorithmique", "en")
        assert "Je ne trouve pas ça" in not_found_message("Algorithmique")


class TestLanguageApi:
    def test_le_champ_language_est_garde_sur_le_cours(self, client, store):
        assert upload(client, language="en").status_code == 202
        assert store.get(course_path(UID, COURSE_ID))["language"] == "en"

    def test_langue_invalide_devient_le_francais(self, client, store):
        assert upload(client, language="de").status_code == 202
        assert store.get(course_path(UID, COURSE_ID))["language"] == "fr"

    def test_l_assistant_repond_dans_la_langue_du_cours(self, client, store):
        assert upload(client, language="en").status_code == 202
        body = client.post(f"/courses/{COURSE_ID}/assistant", json={"question": "Who won the football world cup?"}).json()
        assert body["text"].startswith("I can't find that")


class TestQuizParNotion:
    """Chaque notion a son propre quiz : jusqu'à 3 questions différentes, sur cette notion seulement."""

    def built(self, settings, count=3):
        doc = extract_document("c.txt", COURSE_TEXT.encode())
        raw = extract_raw_notions(FakeAI(), doc, settings)
        built = build_notions(raw, doc, page_infos(doc), "Algorithmique", settings)
        return doc, (built * 3)[:count] if count > len(built) else built[:count]

    def test_trois_questions_par_notion_avec_des_identifiants_distincts(self, settings):
        doc, built = self.built(settings)
        result = generate_questions(FakeAI(), built, doc, settings)
        ids = [qid for qid, _ in result]
        assert len(ids) == len(set(ids)) == 9
        assert ids[:3] == ["q-n01-1", "q-n01-2", "q-n01-3"]
        for qid, data in result:
            assert qid.startswith(f"q-{data['notionId']}-")

    def test_pas_plus_de_trois_questions_ni_de_doublons(self, settings):
        doc, built = self.built(settings, 1)

        class Verbose(FakeAI):
            def complete_json(self, **kw):
                if kw["system"].startswith("Tu écris des questions"):
                    one = {"notion": "n01", "choices": ["a1", "b2", "c3", "d4"], "correct": 0, "explanation": "Une explication suffisamment longue."}
                    return {"questions": [
                        {**one, "text": "Première question sur la notion ?"},
                        {**one, "text": "Première question sur la notion ?"},  # doublon
                        {**one, "text": "Deuxième question sur la notion ?"},
                        {**one, "text": "Troisième question sur la notion ?"},
                        {**one, "text": "Quatrième question sur la notion ?"},  # au-delà de 3
                    ]}
                return super().complete_json(**kw)

        result = generate_questions(Verbose(), built, doc, settings)
        assert [qid for qid, _ in result] == ["q-n01-1", "q-n01-2", "q-n01-3"]

    def test_plusieurs_lots_en_parallele(self, settings):
        doc, built = self.built(settings, 3)
        ai = FakeAI()
        small = settings.model_copy(update={"max_questions": 8})
        many = [type(built[0])(**{**built[0].__dict__, "id": f"n{i:02d}"}) for i in range(1, 8)]
        result = generate_questions(ai, many, doc, small)
        calls = [c for c in ai.calls if c[1].startswith("Tu écris des questions")]
        assert len(calls) == 3  # 7 notions, 3 par lot
        assert len(result) == 21

    def test_un_lot_en_panne_ne_perd_pas_les_autres(self, settings):
        doc, built = self.built(settings, 3)
        many = [type(built[0])(**{**built[0].__dict__, "id": f"n{i:02d}"}) for i in range(1, 7)]

        class OneBatchDown(FakeAI):
            def complete_json(self, **kw):
                if kw["system"].startswith("Tu écris des questions") and "Notion n04" in kw["user"]:
                    raise AIError("panne")
                return super().complete_json(**kw)

        small = settings.model_copy(update={"max_questions": 8})
        result = generate_questions(OneBatchDown(), many, doc, small)
        assert {data["notionId"] for _, data in result} == {"n01", "n02", "n03"}

    def test_tous_les_lots_en_panne_leve_l_erreur(self, settings):
        doc, built = self.built(settings, 3)
        with pytest.raises(AIError):
            generate_questions(FakeAI(fail=True), built, doc, settings)
