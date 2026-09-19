import json
from pathlib import Path
from typing import Any

from ..legal_retrieval import LegalRetrievalAdapter


class MockLegalRetrievalAdapter(LegalRetrievalAdapter):
    def __init__(self, corpus_root: str | Path = "backend/legal_corpus"):
        self.corpus_root = Path(corpus_root)

    def search(self, query: str, limit: int = 10, domain: str = "consumer") -> list[dict[str, Any]]:
        norm_domain = domain.lower().split("/")[0].strip()
        if "labour" in norm_domain or "employment" in norm_domain:
            norm_domain = "labour"
        elif "consumer" in norm_domain:
            norm_domain = "consumer"

        corpus_file = self.corpus_root / norm_domain / "provisions.json"
        if not corpus_file.exists():
            return []

        entries = json.loads(corpus_file.read_text(encoding="utf-8"))
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
