from abc import ABC, abstractmethod
from typing import Any


class AuthAdapter(ABC):
    @abstractmethod
    def signup(self, profile: dict[str, Any], password: str) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def login(self, email: str, password: str) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def logout(self, token: str) -> None:
        raise NotImplementedError

    @abstractmethod
    def verify_session(self, token: str) -> bool:
        raise NotImplementedError

    @abstractmethod
    def get_current_user(self, token: str) -> dict[str, Any] | None:
        raise NotImplementedError

    @abstractmethod
    def update_profile(self, user_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError
