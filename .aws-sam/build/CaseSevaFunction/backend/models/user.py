from dataclasses import asdict, dataclass, field
from typing import Any

from .case import utc_now


@dataclass
class User:
    user_id: str
    full_name: str
    email: str
    mobile_number: str
    preferred_language: str
    state: str
    district_city: str
    password_hash: str
    role: str = "client"
    verification_status: str | None = None
    created_at: str = field(default_factory=utc_now)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "User":
        return cls(**data)
