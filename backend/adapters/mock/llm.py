import json
from pathlib import Path
from typing import Any

from ..llm import LLMAdapter


class MockLLMAdapter(LLMAdapter):
    def __init__(self, fixture_root: str | Path = "fixtures/llm"):
        self.fixture_root = Path(fixture_root)

    def generate(self, prompt: str, schema: dict[str, Any]) -> dict[str, Any]:
        if schema.get("fixture") == "uninformative":
            raise ValueError("Semantic sanity check failed: 'parties' returned all unknown roles.")
        if schema.get("fixture") == "malformed":
            return json.loads((self.fixture_root / "malformed.json").read_text(encoding="utf-8"))
        if schema.get("fixture") == "no_document":
            return json.loads((self.fixture_root / "evidence_challenger_resolved.json").read_text(encoding="utf-8"))
        if schema.get("fixture") == "document_request":
            return json.loads((self.fixture_root / "evidence_challenger_request.json").read_text(encoding="utf-8"))
        if schema.get("fixture") == "hallucinated_statute":
            return json.loads((self.fixture_root / "statute_retrieval_hallucinated.json").read_text(encoding="utf-8"))
        if schema.get("fixture") == "other_domain":
            return json.loads((self.fixture_root / "domain_router_other.json").read_text(encoding="utf-8"))
        if schema.get("fixture") == "labor_domain":
            return json.loads((self.fixture_root / "domain_router_labor.json").read_text(encoding="utf-8"))
        if schema.get("fixture") == "statute_retrieval_labor":
            return json.loads((self.fixture_root / "statute_retrieval_labor.json").read_text(encoding="utf-8"))

        stage = str(schema.get("stage", "default")).lower().replace(" ", "_")
        fixture = self.fixture_root / f"{stage}.json"
        if not fixture.exists():
            fixture = self.fixture_root / "placeholder.json"
        return json.loads(fixture.read_text(encoding="utf-8"))
