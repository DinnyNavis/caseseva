from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Case:
    case_id: str
    owner_user_id: str
    status: str = "DRAFT"
    created_at: str = field(default_factory=utc_now)
    stage: str | None = None
    stage_details: dict[str, Any] = field(default_factory=dict)
    client_story: str = ""
    evidence: list[dict[str, Any]] = field(default_factory=list)
    facts: list[dict[str, Any]] = field(default_factory=list)
    timeline: list[dict[str, Any]] = field(default_factory=list)
    legal_issues: list[dict[str, Any]] = field(default_factory=list)
    legal_sections: list[dict[str, Any]] = field(default_factory=list)
    arguments: dict[str, Any] = field(default_factory=dict)
    advocate_id: str | None = None
    stage_statuses: dict[str, str] = field(default_factory=dict)
    version: int = 1

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Case":
        return cls(**data)
