from typing import Any

from ..auth import AuthAdapter


class RealAuthAdapter(AuthAdapter):
    def signup(self, profile: dict[str, Any], password: str) -> dict[str, Any]:
        # TODO: AWS
        raise NotImplementedError

    def login(self, email: str, password: str) -> dict[str, Any]:
        # TODO: AWS
        raise NotImplementedError

    def logout(self, token: str) -> None:
        # TODO: AWS
        raise NotImplementedError

    def verify_session(self, token: str) -> bool:
        # TODO: AWS
        raise NotImplementedError

    def get_current_user(self, token: str) -> dict[str, Any] | None:
        # TODO: AWS
        raise NotImplementedError

    def update_profile(self, user_id: str, changes: dict[str, Any]) -> dict[str, Any]:
        # TODO: AWS
        raise NotImplementedError
