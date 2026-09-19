from typing import Any

DEPENDENCY_MAP = {
    "fact": ["LEGAL_ISSUE_IDENTIFICATION", "STATUTE_RETRIEVAL", "CITATION_VERIFICATION", "EVIDENCE_ISSUE_MAPPING", "CLAIMANT_COUNSEL", "OPPONENT_COUNSEL", "REBUTTAL", "NEUTRAL_EVALUATION"],
    "provision": ["CLAIMANT_COUNSEL", "OPPONENT_COUNSEL", "REBUTTAL", "NEUTRAL_EVALUATION"],
    "forum": ["NEUTRAL_EVALUATION"],
    "limitation": ["NEUTRAL_EVALUATION"],
    "evidence": ["EVIDENCE_ISSUE_MAPPING", "EVIDENCE_CHALLENGER", "REBUTTAL", "NEUTRAL_EVALUATION"],
    "argument": ["REBUTTAL", "NEUTRAL_EVALUATION"],
}


def audit(case: dict[str, Any], advocate_id: str, action: str, target: str, previous: Any, new: Any) -> dict[str, Any]:
    return {
        "advocate_id": advocate_id,
        "action": action,
        "target": target,
        "previous": previous,
        "new": new,
        "timestamp": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    }


def append_audit(case: dict[str, Any], entry: dict[str, Any]) -> list[dict[str, Any]]:
    return case.get("advocate_audit", []) + [entry]


def reviewable_items(case: dict[str, Any]) -> list[str]:
    items = []
    for fact in case.get("facts", []):
        if not fact.get("removed"):
            items.append(f"fact:{fact['fact_id']}")
    for provision in case.get("verified_legal_sections", []):
        if not provision.get("removed"):
            items.append(f"provision:{provision['provision_id']}")
    if case.get("forum"):
        items.append("forum:forum")
    if case.get("limitation"):
        items.append("limitation:limitation")
    for objection in case.get("arguments", {}).get("opponent", {}).get("objections", []):
        items.append(f"argument:{objection['objection_id']}")
    return items


def outstanding_items(case: dict[str, Any]) -> list[str]:
    approved = set(case.get("advocate_approved_items", []))
    removed = set(case.get("advocate_removed_items", []))
    return [item for item in reviewable_items(case) if item not in approved and item not in removed]
