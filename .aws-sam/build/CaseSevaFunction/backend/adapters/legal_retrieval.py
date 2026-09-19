from abc import ABC, abstractmethod
from typing import Any


class LegalRetrievalAdapter(ABC):
    @abstractmethod
    def search(self, query: str, limit: int = 10) -> list[dict[str, Any]]:
        raise NotImplementedError
