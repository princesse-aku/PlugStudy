"""Analyse d'un document : chapitres, découpage en passages, et les calculs F (fréquence) et P (position).

S = 0,4·I + 0,3·F + 0,3·P (voir le document de fonctionnalités). L'IA juge l'importance I ; la fréquence F et la
position P sont calculées ici, sans IA, pour qu'elles soient vérifiables.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from app.extract import Document, Page

CHUNK_CHARS = 2400  # environ 600 tokens
OVERLAP_CHARS = 300

_CHAPTER_WORD_RE = re.compile(r"^(?:chapitre|chap\.?)\s*([\dIVXivx]+)", re.IGNORECASE)
_CHAPTER_NUM_RE = re.compile(r"^(\d{1,2})[.)]\s+\S")
_EXERCISE_RE = re.compile(r"\b(exercices?|td|tp|travaux dirig[ée]s|applications?|mise en pratique)\b", re.IGNORECASE)

STOP_WORDS = {
    "dans", "avec", "pour", "sans", "sous", "entre", "cette", "leur", "leurs", "comme", "plus", "moins", "tout",
    "tous", "toute", "toutes", "dont", "elle", "elles", "nous", "vous", "ainsi", "alors", "notion", "notions",
    "cours", "rappel", "introduction", "definition", "exemple", "exemples", "les", "des", "une", "aux", "par",
}


def normalize(text: str) -> str:
    """Minuscules, sans accents ni ponctuation, espaces simples."""
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn").lower()
    text = re.sub(r"[^a-z0-9]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


@dataclass
class PageInfo:
    number: int
    chapter: str | None
    exercise: bool


@dataclass
class Chunk:
    id: str
    text: str
    page: int
    chapter: str | None
    exercise: bool


def page_infos(doc: Document) -> dict[int, PageInfo]:
    """Chapitre courant et « zone d'exercices » de chaque page, d'après les titres rencontrés."""
    infos: dict[int, PageInfo] = {}
    # Si le cours annonce des « Chapitre N », seuls ceux-là comptent ; sinon, on prend les titres « 1. … » de premier niveau.
    explicit = any(_CHAPTER_WORD_RE.match(h.strip()) for page in doc.pages for h in page.headings)
    chapter_re = _CHAPTER_WORD_RE if explicit else _CHAPTER_NUM_RE
    chapter: str | None = None
    exercise = False
    for page in doc.pages:
        page_chapter = chapter  # chapitre en cours au début de la page
        first_seen = False
        for heading in page.headings:
            match = chapter_re.match(heading.strip())
            if match:
                chapter = match.group(1).upper()
                if not first_seen:  # la page appartient au premier chapitre qui y commence
                    page_chapter, first_seen = chapter, True
                exercise = False
            if _EXERCISE_RE.search(heading):
                exercise = True
        infos[page.number] = PageInfo(page.number, page_chapter, exercise)
    return infos


def _split_text(text: str) -> list[str]:
    """Coupe un long texte en morceaux d'environ CHUNK_CHARS, avec chevauchement, sans couper un mot."""
    text = text.strip()
    if len(text) <= CHUNK_CHARS:
        return [text] if text else []
    parts, start = [], 0
    while start < len(text):
        end = min(len(text), start + CHUNK_CHARS)
        if end < len(text):
            cut = text.rfind(" ", start + CHUNK_CHARS // 2, end)
            end = cut if cut > start else end
        parts.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(end - OVERLAP_CHARS, start + 1)
    return [part for part in parts if part]


def chunk_document(doc: Document, infos: dict[int, PageInfo]) -> list[Chunk]:
    """Passages de 500 à 800 tokens environ ; chaque passage garde sa page et son chapitre (la citation)."""
    chunks: list[Chunk] = []
    buffer: list[str] = []
    buffer_page: Page | None = None

    def flush() -> None:
        nonlocal buffer, buffer_page
        if buffer and buffer_page is not None:
            info = infos[buffer_page.number]
            for piece in _split_text("\n".join(buffer)):
                chunks.append(Chunk(f"c{len(chunks) + 1:04d}", piece, buffer_page.number, info.chapter, info.exercise))
        buffer, buffer_page = [], None

    for page in doc.pages:
        text = page.text.strip()
        if not text:
            continue
        if buffer_page is not None and sum(len(part) for part in buffer) + len(text) > CHUNK_CHARS:
            flush()
        if buffer_page is None:
            buffer_page = page
        buffer.append(text)
    flush()
    return chunks


def windows(doc: Document, size: int, max_windows: int) -> list[str]:
    """Tranches de texte pour l'IA ; au-delà de `max_windows`, on en prend régulièrement sur tout le cours."""
    pieces: list[str] = []
    current, length = [], 0
    for page in doc.pages:
        text = page.text.strip()
        if not text:
            continue
        block = f"[{page.number}] {text}"
        if current and length + len(block) > size:
            pieces.append("\n".join(current))
            current, length = [], 0
        current.append(block)
        length += len(block)
    if current:
        pieces.append("\n".join(current))
    if len(pieces) <= max_windows:
        return pieces
    step = (len(pieces) - 1) / (max_windows - 1)
    return [pieces[round(i * step)] for i in range(max_windows)]


def significant_words(title: str) -> list[str]:
    return [w for w in normalize(title).split() if len(w) >= 4 and w not in STOP_WORDS]


def _stem(word: str) -> str:
    return word[:5] if len(word) > 5 else word


def occurrences(words: list[str], normalized_text: str) -> float:
    """Nombre moyen d'occurrences des mots (par leur début, pour couvrir pluriels et accords)."""
    if not words:
        return 0.0
    total = sum(len(re.findall(rf"\b{re.escape(_stem(w))}\w*", normalized_text)) for w in words)
    return total / len(words)


def frequency_scores(titles: list[str], doc: Document) -> dict[str, float]:
    """F : fréquence de chaque notion dans le cours, ramenée entre 0 et 1 (la plus citée vaut 1)."""
    text = normalize(doc.text)
    counts = {title: occurrences(significant_words(title), text) for title in titles}
    highest = max(counts.values(), default=0.0)
    return {title: (count / highest if highest > 0 else 0.0) for title, count in counts.items()}


def position_score(title: str, doc: Document, infos: dict[int, PageInfo]) -> float:
    """P : 1 si la notion est dans un titre, 0,7 si elle apparaît dans une zone d'exercices, sinon 0,3."""
    words = significant_words(title)
    if not words:
        return 0.3
    needed = max(1, round(len(words) * 0.6))
    in_exercise = False
    for page in doc.pages:
        for heading in page.headings:
            heading_norm = normalize(heading)
            if sum(1 for w in words if _stem(w) in heading_norm) >= needed:
                return 1.0
        if infos[page.number].exercise:
            page_norm = normalize(page.text)
            if sum(1 for w in words if _stem(w) in page_norm) >= needed:
                in_exercise = True
    return 0.7 if in_exercise else 0.3


def find_page(quote: str, doc: Document) -> int | None:
    """Page où l'extrait cité par l'IA apparaît mot pour mot (au détail de typographie près), sinon None."""
    wanted = normalize(quote)
    if len(wanted) < 20:
        return None
    probe = wanted[:120]
    for page in doc.pages:
        if probe in normalize(page.text):
            return page.number
    return None


def best_page_for_words(words: list[str], doc: Document) -> int | None:
    """Page qui contient le plus de mots importants d'une notion (repli quand l'extrait n'est pas retrouvé)."""
    if not words:
        return None
    best, best_hits = None, 0
    for page in doc.pages:
        norm = normalize(page.text)
        hits = sum(1 for w in words if _stem(w) in norm)
        if hits > best_hits:
            best, best_hits = page.number, hits
    return best if best_hits >= max(1, round(len(words) * 0.6)) else None


def page_text(doc: Document, number: int) -> str:
    return next((page.text for page in doc.pages if page.number == number), "")


def source_label(course_name: str, doc: Document, infos: dict[int, PageInfo], page: int) -> str:
    """« Algorithmique, chap. 2, p. 14 » (ou « diapo 14 », « partie 3 » selon le format)."""
    chapter = infos[page].chapter if page in infos else None
    place = f"{doc.page_label} {page}" if doc.page_label != "p." else f"p. {page}"
    return f"{course_name}, chap. {chapter}, {place}" if chapter else f"{course_name}, {place}"
