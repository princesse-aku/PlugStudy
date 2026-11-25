import pytest

from app.analysis import (
    chunk_document,
    find_page,
    frequency_scores,
    normalize,
    page_infos,
    position_score,
    source_label,
    windows,
)
from app.extract import UnsupportedFile, extract_document, looks_like_heading
from tests.conftest import COURSE_TEXT, QUOTE_COMPLEXITE, make_docx, make_pdf, make_pptx


def txt_doc():
    return extract_document("cours.txt", COURSE_TEXT.encode("utf-8"))


class TestExtraction:
    def test_txt(self):
        doc = txt_doc()
        assert doc.page_label == "partie"
        assert "boucle" in doc.text
        assert doc.total_chars > 500

    def test_txt_en_cp1252(self):
        doc = extract_document("cours.txt", "Complexité d'un algorithme éé".encode("cp1252"))
        assert "Complexité" in doc.text

    def test_pdf_a_du_texte_et_des_pages(self):
        doc = extract_document("cours.pdf", make_pdf(COURSE_TEXT))
        assert doc.page_label == "p."
        assert len(doc.pages) == 1
        assert "Une variable est un nom" in doc.text

    def test_pdf_scanne_n_a_pas_de_texte(self):
        doc = extract_document("scan.pdf", make_pdf(None))
        assert doc.total_chars == 0

    def test_pdf_corrompu(self):
        with pytest.raises(UnsupportedFile):
            extract_document("cours.pdf", b"ceci n'est pas un pdf")

    def test_docx_garde_les_titres(self):
        doc = extract_document("cours.docx", make_docx(COURSE_TEXT))
        assert any("CHAPITRE 1" in h for page in doc.pages for h in page.headings)
        assert "Une boucle répète" in doc.text

    def test_pptx_une_page_par_diapositive(self):
        doc = extract_document("cours.pptx", make_pptx([("Boucles", "Répéter des instructions"), ("Variables", "Un nom pour une valeur")]))
        assert doc.page_label == "diapo"
        assert [p.number for p in doc.pages] == [1, 2]
        assert doc.pages[0].headings == ["Boucles"]

    def test_ancien_format_ppt_refuse(self):
        with pytest.raises(UnsupportedFile):
            extract_document("cours.ppt", b"x")

    def test_extension_inconnue_refusee(self):
        with pytest.raises(UnsupportedFile):
            extract_document("photo.png", b"x")

    @pytest.mark.parametrize(
        "line,expected",
        [
            ("CHAPITRE 2 BOUCLES", True),
            ("1. Variables et types", True),
            ("2.1 Boucles imbriquées", True),
            ("Exercices", True),
            ("TD 3 : boucles", True),
            ("Une boucle répète des instructions tant qu'une condition est vraie.", False),
            ("Ok", False),
        ],
    )
    def test_reconnait_les_titres(self, line, expected):
        assert looks_like_heading(line) is expected


class TestAnalysis:
    def test_normalize(self):
        assert normalize("Récursivité, c'est l'ÉNORME !") == "recursivite c est l enorme"

    def test_chapitres_explicites_ignorent_la_numerotation(self):
        doc = txt_doc()
        infos = page_infos(doc)
        assert infos[1].chapter == "1"  # « 1. Variables » ne devient pas un chapitre

    def test_chapitre_suivant_detecte_sur_plusieurs_pages(self):
        from app.extract import Document, Page

        doc = Document(
            [
                Page(1, "x" * 300, ["CHAPITRE 1 DEBUT"]),
                Page(2, "y" * 300, []),
                Page(3, "z" * 300, ["CHAPITRE 2 SUITE", "Exercices"]),
            ],
            "p.",
        )
        infos = page_infos(doc)
        assert [infos[n].chapter for n in (1, 2, 3)] == ["1", "1", "2"]
        assert infos[3].exercise and not infos[2].exercise

    def test_passages_gardent_page_et_chapitre(self):
        doc = txt_doc()
        chunks = chunk_document(doc, page_infos(doc))
        assert chunks and chunks[0].page == 1 and chunks[0].chapter == "1"
        assert all(c.text for c in chunks)

    def test_long_texte_decoupe_avec_chevauchement(self):
        from app.extract import Document, Page

        words = " ".join(f"mot{i}" for i in range(2000))
        doc = Document([Page(1, words)], "p.")
        chunks = chunk_document(doc, page_infos(doc))
        assert len(chunks) > 2
        assert all(len(c.text) <= 2500 for c in chunks)

    def test_fenetres_echantillonnees_sur_tout_le_cours(self):
        from app.extract import Document, Page

        doc = Document([Page(i, "a" * 500) for i in range(1, 41)], "p.")
        parts = windows(doc, size=2000, max_windows=4)
        assert len(parts) == 4
        assert parts[0].startswith("[1]") and "[40]" in parts[-1]

    def test_frequence_la_plus_citee_vaut_un(self):
        doc = txt_doc()
        scores = frequency_scores(["Complexité algorithmique", "Variables et types", "Récursivité"], doc)
        assert scores["Complexité algorithmique"] == 1.0
        assert 0 < scores["Variables et types"] < 1.0
        assert scores["Récursivité"] == 0.0

    def test_position(self):
        doc = txt_doc()
        infos = page_infos(doc)
        assert position_score("Boucles", doc, infos) == 1.0  # dans le titre « CHAPITRE 2 BOUCLES »
        assert position_score("Complexité algorithmique", doc, infos) == 0.7  # cité dans les exercices
        assert position_score("Récursivité", doc, infos) == 0.3

    def test_retrouve_la_page_d_un_extrait(self):
        doc = txt_doc()
        assert find_page(QUOTE_COMPLEXITE, doc) == 1
        assert find_page("Une phrase qui n'est nulle part dans ce cours d'exemple.", doc) is None
        assert find_page("trop court", doc) is None

    def test_etiquette_de_source(self):
        doc = txt_doc()
        infos = page_infos(doc)
        assert source_label("Algorithmique", doc, infos, 1) == "Algorithmique, chap. 1, partie 1"
        pdf = extract_document("c.pdf", make_pdf(COURSE_TEXT))
        assert source_label("Algorithmique", pdf, page_infos(pdf), 1).endswith(", p. 1")


class TestDocxSecours:
    """Un .docx que python-docx refuse (export mobile ou Google Docs) est lu quand même, directement dans le XML."""

    def test_lecture_de_secours(self, monkeypatch):
        import docx

        data = make_docx(COURSE_TEXT)  # fabriqué avant de saboter python-docx

        def refuse(*args, **kwargs):
            raise KeyError("styles manquants")

        monkeypatch.setattr(docx, "Document", refuse)
        doc = extract_document("cours.docx", data)
        assert "algorithme est une suite d'instructions" in doc.text
        assert any("CHAPITRE 1" in heading for page in doc.pages for heading in page.headings)

    def test_fichier_qui_n_est_pas_un_docx(self):
        with pytest.raises(UnsupportedFile):
            extract_document("cours.docx", b"ceci n'est pas un zip")
