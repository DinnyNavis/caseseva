import json
from pathlib import Path
from typing import Any

from ..legal_retrieval import LegalRetrievalAdapter


class RealLegalRetrievalAdapter(LegalRetrievalAdapter):
    """Reads the local corpus JSON with keyword ranking.

    This is intentionally identical to the mock until an AWS vector store is
    wired. The corpus file is the source of truth for provision IDs and titles;
    the hallucination filter in legal_analysis.py enforces that contract.
    """

    def __init__(self, corpus_path: str | Path = "backend/legal_corpus/consumer/provisions.json"):
        self.corpus_path = Path(corpus_path)

    def search(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        entries = json.loads(self.corpus_path.read_text(encoding="utf-8"))
        terms = {term.lower() for term in query.split() if len(term) > 2}
        ranked = sorted(
            entries,
            key=lambda entry: sum(
                term in (entry["title"] + " " + entry["summary"]).lower()
                for term in terms
            ),
            reverse=True,
        )
        return ranked[:limit]
