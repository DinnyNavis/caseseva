import logging
import re
from abc import ABC, abstractmethod
from typing import Any

logger = logging.getLogger(__name__)

CORPUS_ALIAS_MAP = {
    # Labour / Employment aliases
    "labor": "labour",
    "labour": "labour",
    "employment": "labour",
    "wages": "labour",
    "labour employment": "labour",
    "labor employment": "labour",
    "employment and labour": "labour",
    "employment and labor": "labour",
    "wages and salary": "labour",
    "wages and salary disputes": "labour",
    "wages and salary dispute": "labour",
    "labour disputes": "labour",
    "labor disputes": "labour",
    # Consumer aliases
    "consumer": "consumer",
    "consumer protection": "consumer",
    "consumer disputes": "consumer",
    "consumer dispute": "consumer",
    "defective goods": "consumer",
    "defective goods and replacement dispute": "consumer",
    "consumer goods": "consumer",
}


def normalize_domain_to_corpus(domain_str: str) -> str | None:
    if not domain_str:
        logger.warning("[CorpusLookup] Empty domain string provided.")
        return None

    # Lowercase and trim
    raw = domain_str.lower().strip()

    # Strip punctuation, slashes, and collapse whitespace
    cleaned = re.sub(r"[^\w\s]", " ", raw)
    cleaned = " ".join(cleaned.split())

    # Exact alias match check
    if cleaned in CORPUS_ALIAS_MAP:
        return CORPUS_ALIAS_MAP[cleaned]

    # Substring / key term fallback check
    if any(k in cleaned for k in ["labor", "labour", "employment", "wages", "salary"]):
        return "labour"
    if any(k in cleaned for k in ["consumer", "defective goods", "defective item", "buyer"]):
        return "consumer"

    # Log unmatched domain string for visibility
    logger.warning(f"[CorpusLookup] Unmatched domain string: '{domain_str}' (cleaned: '{cleaned}')")
    return None


class LegalRetrievalAdapter(ABC):
    @abstractmethod
    def search(self, query: str, limit: int = 10, domain: str = "consumer") -> list[dict[str, Any]]:
        raise NotImplementedError
