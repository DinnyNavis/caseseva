import re
from difflib import SequenceMatcher

# ---------------------------------------------------------
# Grounding Normalisation & Comparison Logic
# ---------------------------------------------------------

def normalize_section_num(sec_str: str) -> str:
    """Normalises section numbers: 'WAGES-45 ( 6 )', 'Section 45(6)', '45 (6)', '45.6' -> '45(6)'"""
    # 1. Strip domain prefix (e.g., "WAGES-", "CPA-", "TPA-")
    cleaned = re.sub(r"^[A-Z]+-", "", sec_str).strip()
    # 2. Remove 'Section', 'Sec', whitespace around parentheses
    cleaned = re.sub(r"(?i)\b(?:Section|Sec|\.)\b", "", cleaned).strip()
    cleaned = re.sub(r"\s*\(\s*", "(", cleaned)
    cleaned = re.sub(r"\s*\)\s*", ")", cleaned)
    cleaned = re.sub(r"\s+", "", cleaned)
    return cleaned


def normalize_title(title_str: str) -> str:
    """Normalises section title for comparison: strips section prefix, lowercases, removes punctuation."""
    # Strip domain prefix and section number prefix if present
    title_clean = re.sub(r"^[A-Z]+-", "", title_str)
    title_clean = re.sub(r"(?i)^(?:Section|Sec\.)?\s*\d+[A-Z]?(?:\([0-9a-z]+\))?\s*[-–—:]?\s*", "", title_clean)
    title_clean = re.sub(r"[^\w\s]", "", title_clean.lower()).strip()
    return title_clean


def title_similarity(t1: str, t2: str) -> float:
    """Returns ratio of similarity between two normalised section titles (0.0 to 1.0)."""
    norm1 = normalize_title(t1)
    norm2 = normalize_title(t2)
    return SequenceMatcher(None, norm1, norm2).ratio()


def verify_grounding(claimed_provision: dict, fetched_document_text: str, fetched_sections: list[dict]) -> dict:
    claimed_sec = normalize_section_num(claimed_provision.get("provision_id", ""))
    claimed_title = claimed_provision.get("title", "")

    # 1. Verify section number exists in fetched sections or raw text
    matching_section = None
    for sec in fetched_sections:
        if normalize_section_num(sec["section_number"]) == claimed_sec:
            matching_section = sec
            break

    if not matching_section:
        # Check raw document text for section number
        if not re.search(r"\b" + re.escape(claimed_sec) + r"\b", fetched_document_text):
            return {
                "decision": "REJECTED",
                "reason": f"Fabricated section: Section {claimed_sec} does not exist in fetched document text.",
                "similarity": 0.0,
            }

    # 2. Verify title similarity against fetched section title
    fetched_title = matching_section["raw_title"] if matching_section else ""
    sim = title_similarity(claimed_title, fetched_title)

    if sim >= 0.85:
        return {
            "decision": "VERIFIED",
            "reason": f"Grounded: Section {claimed_sec} matched fetched title '{fetched_title}' with similarity {sim:.2f} >= 0.85 threshold.",
            "similarity": sim,
        }
    else:
        return {
            "decision": "REJECTED",
            "reason": f"Title mismatch: Section {claimed_sec} exists, but claimed title '{claimed_title}' does not match fetched title '{fetched_title}' (similarity {sim:.2f} < 0.85 threshold).",
            "similarity": sim,
        }


# ---------------------------------------------------------
# Test Demonstrations
# ---------------------------------------------------------

FETCHED_SECTIONS_FIXTURE = [
    {"section_number": "45", "raw_title": "Claims under Code and procedure thereof"},
    {"section_number": "45(6)", "raw_title": "Period of limitation for claims"},
    {"section_number": "17", "raw_title": "Mode and time limit for payment of wages"},
]

RAW_TEXT_FIXTURE = """
45. Claims under Code and procedure thereof.—(1) An employee may file a claim...
45(6). Period of limitation for claims.—Every application under section 45 shall be filed within a period of three years...
17. Mode and time limit for payment of wages.—Wages shall be paid before 7th day...
"""

def main():
    print("==========================================")
    print("TASK 3: GROUNDING COMPARISON TEST DEMO")
    print("==========================================")

    # Test Case A: Fabricated Section (e.g. Section 999 or hallucinated section)
    test_a = {
        "provision_id": "WAGES-999",
        "title": "Section 999 - Automatic forfeiture of unpaid wages",
    }
    res_a = verify_grounding(test_a, RAW_TEXT_FIXTURE, FETCHED_SECTIONS_FIXTURE)
    print("\n[TEST A - Fabricated Section]")
    print(f"Claimed: {test_a['provision_id']} - {test_a['title']}")
    print(f"Result: {res_a['decision']}")
    print(f"Reason: {res_a['reason']}")

    # Test Case B: Real Section with Minor Whitespace/Formatting Differences
    test_b = {
        "provision_id": "WAGES-45 ( 6 )",
        "title": "Section 45(6) - Period of limitation for claims",
    }
    res_b = verify_grounding(test_b, RAW_TEXT_FIXTURE, FETCHED_SECTIONS_FIXTURE)
    print("\n[TEST B - Real Section with Whitespace/Formatting Differences]")
    print(f"Claimed: {test_b['provision_id']} - {test_b['title']}")
    print(f"Result: {res_b['decision']}")
    print(f"Reason: {res_b['reason']}")

    # Test Case C: Real Section but Wrong Title
    test_c = {
        "provision_id": "WAGES-45",
        "title": "Section 45 - Power of inspector to impose fines on employees",
    }
    res_c = verify_grounding(test_c, RAW_TEXT_FIXTURE, FETCHED_SECTIONS_FIXTURE)
    print("\n[TEST C - Real Section Number but Wrong Title]")
    print(f"Claimed: {test_c['provision_id']} - {test_c['title']}")
    print(f"Result: {res_c['decision']}")
    print(f"Reason: {res_c['reason']}")


if __name__ == "__main__":
    main()
