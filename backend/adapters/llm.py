from abc import ABC, abstractmethod
from typing import Any


class LLMAdapter(ABC):
    @abstractmethod
    def generate(self, prompt: str, schema: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError
