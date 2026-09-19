from abc import ABC, abstractmethod
from typing import Any


class WorkflowAdapter(ABC):
    @abstractmethod
    def start_run(self, case_id: str, stages: list[str]) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def get_run_status(self, run_id: str) -> dict[str, Any] | None:
        raise NotImplementedError

    @abstractmethod
    def advance_run(self, run_id: str) -> dict[str, Any]:
        raise NotImplementedError
