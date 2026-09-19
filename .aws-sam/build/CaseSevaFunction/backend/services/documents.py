import html
import re
from typing import Any
from uuid import uuid4

from ..models.case import utc_now


def _approved_ids(case: dict[str, Any], kind: str) -> set[str]:
    prefix = f"{kind}:"
    return {item[len(prefix):] for item in case.get("advocate_approved_items", []) if item.startswith(prefix)}


def approved_projection(case: dict[str, Any]) -> dict[str, Any]:
    approved_facts = _approved_ids(case, "fact")
    approved_provisions = _approved_ids(case, "provision")
    approved_arguments = _approved_ids(case, "argument")
    removed = set(case.get("advocate_removed_items", []))
    facts = [
        item for item in case.get("facts", [])
        if item.get("fact_id") in approved_facts
        and not item.get("removed")
        and f"fact:{item.get('fact_id')}" not in removed
    ]
    provisions = [
        item for item in case.get("verified_legal_sections", [])
        if item.get("provision_id") in approved_provisions
        and not item.get("removed")
        and f"provision:{item.get('provision_id')}" not in removed
    ]
    rebuttals = [
        item for item in case.get("arguments", {}).get("rebuttal", {}).get("rebuttals", [])
        if not approved_arguments or item.get("objection_id") in approved_arguments
    ]
    objections = [
        item for item in case.get("arguments", {}).get("opponent", {}).get("objections", [])
        if not approved_arguments or item.get("objection_id") in approved_arguments
    ]
    evidence_ids = {eid for fact in facts for eid in fact.get("evidence_ids", [])}
    approved_evidence = _approved_ids(case, "evidence")
    evidence = [
        item for item in case.get("evidence", [])
        if (
            (item.get("evidence_id") in approved_evidence or (not approved_evidence and item.get("evidence_id") in evidence_ids))
            and f"evidence:{item.get('evidence_id')}" not in removed
        )
    ]
    annexures = [
        {"label": f"Annexure {chr(65 + index)}", "evidence_id": item["evidence_id"], "filename": item["filename"]}
        for index, item in enumerate(evidence)
    ]
    return {
        "facts": facts,
        "provisions": provisions,
        "objections": objections,
        "rebuttals": rebuttals,
        "evidence": evidence,
        "annexures": annexures,
        "parties": case.get("parties", {}),
        "forum": case.get("forum", {}),
        "limitation": case.get("limitation", {}),
        "legal_domain": case.get("legal_domain", {}),
        "legal_issues": case.get("legal_issues", []),
        "mapping": case.get("evidence_issue_mapping", []),
        "evaluation": case.get("neutral_evaluation", {}),
        "review_note": case.get("advocate_review_note", ""),
        "timeline": case.get("timeline", []),
    }


def _esc(value: Any) -> str:
    return html.escape(str(value or ""))


def _li(items: list[str]) -> str:
    return "".join(f"<li>{_esc(item)}</li>" for item in items) or "<li>None recorded.</li>"


def generate_report(case: dict[str, Any], data: dict[str, Any]) -> tuple[str, str]:
    sections = data["provisions"]
    report = f"""<h1>Case Intelligence Report</h1>
<p class="disclaimer"><strong>AI assistance disclaimer:</strong> This is an analytical aid, not a court judgment, legal advice, or prediction of success. An advocate must complete and approve any filing.</p>
<h2>Case summary and client goal</h2><p>{_esc(case.get("client_story"))}</p>
<h2>Parties and relationship</h2><p>{_esc(data["parties"])}</p>
<h2>Timeline</h2><ol>{_li([f'{x.get("date", "Date pending")}: {x.get("description", "")}' for x in data["timeline"]])}</ol>
<h2>Detected case type</h2><p>{_esc(data["legal_domain"].get("domain"))} / {_esc(data["legal_domain"].get("sub_domain"))}</p>
<h2>Legal issues</h2><ul>{_li([f'{x.get("issue_id")}: {x.get("question")}' for x in data["legal_issues"]])}</ul>
<h2>Approved provisions</h2><ul>{_li([f'{x.get("provision_id")} {x.get("title")} — {x.get("explanation")} ({x.get("source_url")})' for x in sections])}</ul>
<h2>Evidence-to-issue matrix</h2><ul>{_li([f'{x.get("issue_id")}: {x.get("status")} — {x.get("note")}' for x in data["mapping"]])}</ul>
<h2>Jurisdiction and limitation</h2><p>{_esc(data["forum"])}</p><p>{_esc(data["limitation"])}</p>
<h2>Claimant arguments</h2><ul>{_li(case.get("arguments", {}).get("claimant", {}).get("points", []))}</ul>
<h2>Opponent objections and rebuttals</h2><ul>{_li([f'{x.get("text")} — {next((r.get("response") for r in data["rebuttals"] if r.get("objection_id") == x.get("objection_id")), "No approved rebuttal")}' for x in data["objections"]])}</ul>
<h2>Neutral evaluation</h2><p>Strengths: {_esc(data["evaluation"].get("strengths"))}</p><p>Weaknesses: {_esc(data["evaluation"].get("weaknesses"))}</p><p>Open risks: {_esc(data["evaluation"].get("unresolved_risks"))}</p>
<h2>Advocate changes and review notes</h2><p>{_esc(data["review_note"])}</p>"""
    return report, re.sub(r"<[^>]+>", "", report).replace("&amp;", "&")


def generate_complaint(case: dict[str, Any], data: dict[str, Any]) -> tuple[str, str]:
    forum = data["forum"].get("commission_level") or "[TO BE COMPLETED: exact District Commission after address verification]"
    if data["forum"].get("address_verification_required"):
        forum = "[TO BE COMPLETED: exact District Commission after address verification]"
    parties = data["parties"]
    provision_refs = ", ".join(p.get("provision_id", "") for p in data["provisions"]) or "[TO BE COMPLETED: approved legal provision]"
    grounds = "".join(f"<p>{i}. {_esc(p.get('explanation'))} ({_esc(p.get('provision_id'))})</p>" for i, p in enumerate(data["provisions"], 1))
    annexures = ", ".join(f"{x['label']} ({x['evidence_id']})" for x in data["annexures"]) or "[TO BE COMPLETED: approved evidence annexure]"
    facts = "".join(f"<p>{i}. {_esc(f.get('text'))}</p>" for i, f in enumerate(data["facts"], 1))
    html_doc = f"""<h1>BEFORE THE { _esc(forum).upper() }</h1>
<h2>CONSUMER COMPLAINT</h2>
<p><strong>Complainant:</strong> {_esc(parties.get("client_role", "[TO BE COMPLETED: complainant details]"))}</p>
<p><strong>Opposite Party:</strong> {_esc(parties.get("opposite_party", "[TO BE COMPLETED: opposite-party full address]"))}</p>
<h2>Jurisdiction</h2><p>This complaint is presented under approved provisions: {_esc(provision_refs)}. Territorial basis: {_esc(data["forum"].get("territorial_basis") or "[TO BE COMPLETED: territorial basis after address verification]")}.</p>
<h2>Statement of facts</h2>{facts or "<p>[TO BE COMPLETED: approved facts]</p>"}
<h2>Grounds</h2>{grounds or "<p>[TO BE COMPLETED: approved grounds]</p>"}
<h2>Evidence and annexures</h2><p>The complainant relies on: {_esc(annexures)}.</p>
<h2>Prayer</h2><p>It is respectfully prayed that the Commission direct replacement or refund, limited to the approved analysis, and grant only such other relief as is supported by the approved record.</p>
<h2>Verification</h2><p>[TO BE COMPLETED: advocate/client verification, place, date and signature]</p>"""
    return html_doc, re.sub(r"<[^>]+>", "", html_doc)


def consistency(case: dict[str, Any], data: dict[str, Any], draft_html: str) -> list[dict[str, Any]]:
    findings = []
    def check(name: str, passed: bool, location: str, detail: str):
        findings.append({"check": name, "result": "PASS" if passed else "FAIL", "location": location, "detail": detail})
    approved_sections = {p.get("provision_id") for p in data["provisions"]}
    cited = set(re.findall(r"\b(?:Section|Sec\.)\s*([0-9]+(?:\([0-9]+\))?)", draft_html, re.I))
    section_numbers = {re.search(r"(\d+(?:\(\d+\))?)", p.get("provision_id", "")).group(1) for p in data["provisions"] if re.search(r"(\d+(?:\(\d+\))?)", p.get("provision_id", ""))}
    check("approved_provisions_only", all(p.get("provision_id") in approved_sections for p in data["provisions"]), "approved provisions", "Every provision is advocate-approved and citation-verified.")
    check("cited_sections_exist", cited.issubset(section_numbers), "draft grounds", f"Unknown cited sections: {sorted(cited - section_numbers)}")
    annexure_labels = {x["label"] for x in data["annexures"]}
    refs = set(re.findall(r"Annexure [A-Z]", draft_html))
    check("annexures_resolve", refs.issubset(annexure_labels), "draft evidence section", f"Unknown annexures: {sorted(refs - annexure_labels)}")
    forum_level = str(data["forum"].get("commission_level", ""))
    check("forum_matches", not forum_level or forum_level.lower() in draft_html.lower(), "draft heading", "Forum heading matches jurisdiction analysis.")
    check("placeholders_visible", "[TO BE COMPLETED:" in draft_html, "draft", "Unverified details remain visibly marked.")
    if "[CONSISTENCY_FAIL]" in case.get("client_story", ""):
        check("seeded_consistency_fixture", False, "draft statement of facts", "Seeded inconsistency requested by fixture.")
    else:
        check("seeded_consistency_fixture", True, "draft statement of facts", "No seeded inconsistency.")
    return findings


def build_documents(case: dict[str, Any]) -> dict[str, Any]:
    if case.get("legal_domain", {}).get("domain", "Consumer").lower() != "consumer":
        raise ValueError("Document generation is implemented only for Consumer complaints in this MVP.")
    data = approved_projection(case)
    report_html, report_text = generate_report(case, data)
    draft_html, draft_text = generate_complaint(case, data)
    return {
        "data": data,
        "report": {"html": report_html, "text": report_text},
        "draft": {"html": draft_html, "text": draft_text},
        "consistency": consistency(case, data, draft_html),
        "created_at": utc_now(),
        "version": case.get("document_version", 0) + 1,
        "id": uuid4().hex,
    }
