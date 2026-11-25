"""Extraction du texte d'un fichier de cours : PDF, DOCX, PPTX et TXT.

Chaque fichier devient une liste de « pages » (page PDF, diapositive, ou tranche de ~3 000 caractères pour les
formats sans pages), avec les titres repérés. Un fichier sans texte lisible (PDF scanné, photo) donne une liste
vide : le pipeline le refuse avec une erreur d'import claire.
"""

from __future__ import annotations

import io
import re
from dataclasses import dataclass, field

ALLOWED_EXTENSIONS = {"pdf", "docx", "pptx", "ppt", "txt"}
VIRTUAL_PAGE_CHARS = 3000


class UnsupportedFile(Exception):
    """Format non pris en charge (ou fichier corrompu)."""


@dataclass
class Page:
    number: int
    text: str
    headings: list[str] = field(default_factory=list)


@dataclass
class Document:
    pages: list[Page]
    page_label: str  # « p. », « diapo » ou « partie »

    @property
    def text(self) -> str:
        return "\n\n".join(page.text for page in self.pages)

    @property
    def total_chars(self) -> int:
        return sum(len(page.text.strip()) for page in self.pages)


_HEADING_RE = re.compile(
    r"^(?:(?:chapitre|chap\.?|partie|section|module|cours)\s+[\dIVXivx]+\b.*|\d{1,2}(?:\.\d{1,2}){0,2}[.)]?\s+[^\d\s].{2,80})$",
    re.IGNORECASE,
)


_EXERCISE_HEAD = re.compile(r"^(exercices?|td|tp|travaux dirigés|travaux diriges)\b.{0,60}$", re.IGNORECASE)


def looks_like_heading(line: str) -> bool:
    """Ligne courte, numérotée (« 2.1 Boucles ») ou introduite par « Chapitre », ou en capitales."""
    line = line.strip()
    if not 3 <= len(line) <= 90 or line.endswith((".", ",", ";")):
        return False
    if _HEADING_RE.match(line) or _EXERCISE_HEAD.match(line):
        return True
    letters = [c for c in line if c.isalpha()]
    return len(letters) >= 4 and all(c.isupper() for c in letters) and len(line.split()) <= 10


def extension_of(filename: str) -> str:
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


def _split_virtual_pages(blocks: list[tuple[str, bool]], label: str) -> Document:
    """Découpe une suite de paragraphes (texte, est_un_titre) en tranches d'environ 3 000 caractères."""
    pages: list[Page] = []
    current: list[str] = []
    headings: list[str] = []
    size = 0
    for text, is_heading in blocks:
        text = text.strip()
        if not text:
            continue
        if size >= VIRTUAL_PAGE_CHARS:
            pages.append(Page(len(pages) + 1, "\n".join(current), headings))
            current, headings, size = [], [], 0
        current.append(text)
        size += len(text)
        if is_heading or looks_like_heading(text):
            headings.append(text)
    if current:
        pages.append(Page(len(pages) + 1, "\n".join(current), headings))
    return Document(pages, label)


def _from_pdf(data: bytes) -> Document:
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            reader.decrypt("")
        pages = []
        for index, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").strip()
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            pages.append(Page(index, text, [line for line in lines if looks_like_heading(line)]))
    except Exception as error:
        raise UnsupportedFile("pdf") from error
    return Document(pages, "p.")


def _from_docx(data: bytes) -> Document:
    from docx import Document as Docx

    try:
        document = Docx(io.BytesIO(data))
        blocks = [(p.text, (p.style.name or "").lower().startswith(("heading", "titre"))) for p in document.paragraphs]
        for table in document.tables:
            for row in table.rows:
                blocks.append((" | ".join(cell.text.strip() for cell in row.cells), False))
    except Exception as error:
        raise UnsupportedFile("docx") from error
    return _split_virtual_pages(blocks, "partie")


def _from_pptx(data: bytes) -> Document:
    from pptx import Presentation

    try:
        presentation = Presentation(io.BytesIO(data))
        pages = []
        for index, slide in enumerate(presentation.slides, start=1):
            title = slide.shapes.title.text.strip() if slide.shapes.title is not None and slide.shapes.title.has_text_frame else ""
            lines = []
            for shape in slide.shapes:
                if shape.has_text_frame:
                    lines.extend(p.text.strip() for p in shape.text_frame.paragraphs if p.text.strip())
            text = "\n".join(lines)
            pages.append(Page(index, text, [title] if title else []))
    except Exception as error:
        raise UnsupportedFile("pptx") from error
    return Document(pages, "diapo")


def _from_txt(data: bytes) -> Document:
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            text = data.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        raise UnsupportedFile("txt")
    return _split_virtual_pages([(line, False) for line in text.splitlines()], "partie")


def extract_document(filename: str, data: bytes) -> Document:
    extension = extension_of(filename)
    if extension == "pdf":
        return _from_pdf(data)
    if extension == "docx":
        return _from_docx(data)
    if extension == "pptx":
        return _from_pptx(data)
    if extension == "txt":
        return _from_txt(data)
    # L'ancien format .ppt (binaire) n'est pas lisible sans LibreOffice : refusé avec un message clair.
    raise UnsupportedFile(extension or "inconnu")
