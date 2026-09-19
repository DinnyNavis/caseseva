import re
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

from ..models.case import utc_now
from .dependencies import get_case_or_error, get_current_user

router = APIRouter(prefix="/api/cases")
MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {
    ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".doc", ".docx",
    ".txt", ".rtf", ".xls", ".xlsx", ".csv", ".mp4", ".mov", ".avi", ".webm",
}
STAGES = {"NEW_CONSULTATION", "COMPLAINT_FIR", "EXISTING_OLD_CASE"}


class CaseUpdateBody(BaseModel):
    stage: str | None = None
    stage_details: dict[str, Any] | None = None
    client_story: str | None = None


class EvidenceUpdateBody(BaseModel):
    description: str = ""


def field_error(fields: dict[str, str]) -> HTTPException:
    return HTTPException(status_code=422, detail={"message": "Please complete the highlighted fields.", "fields": fields})


def validate_stage(stage: str | None, details: dict[str, Any] | None) -> dict[str, str]:
    errors: dict[str, str] = {}
    if not stage:
        errors["stage"] = "Choose a case stage."
        return errors
    if stage not in STAGES:
        errors["stage"] = "Choose a valid case stage."
        return errors
    details = details or {}
    required = {
        "COMPLAINT_FIR": ["has_fir", "reference_number", "station_authority"],
        "EXISTING_OLD_CASE": ["case_number", "court_authority", "current_stage"],
    }.get(stage, [])
    for key in required:
        value = details.get(key)
        if value is None or not str(value).strip():
            errors[key] = "This field is required for the selected stage."
    return errors


def validate_complete(case: dict[str, Any]) -> dict[str, str]:
    errors = validate_stage(case.get("stage"), case.get("stage_details"))
    if not case.get("client_story", "").strip():
        errors["client_story"] = "Tell us what happened before submitting."
    if not case.get("evidence"):
        errors["evidence"] = "Upload at least one evidence file before submitting."
    return errors


def next_evidence_id(evidence: list[dict[str, Any]]) -> str:
    numbers = [int(match.group(1)) for item in evidence if (match := re.fullmatch(r"E(\d+)", item["evidence_id"]))]
    return f"E{(max(numbers) + 1 if numbers else 1):03d}"


def get_owned_case(request: Request, case_id: str, user: dict) -> dict:
    return get_case_or_error(request, case_id, user)


@router.post("")
def create_case(request: Request, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    case = {
        "id": uuid4().hex,
        "case_id": uuid4().hex,
        "owner_user_id": user["id"],
        "status": "DRAFT",
        "created_at": utc_now(),
        "stage": None,
        "stage_details": {},
        "client_story": "",
        "evidence": [],
        "facts": [],
        "timeline": [],
        "legal_issues": [],
        "legal_sections": [],
        "arguments": {},
        "advocate_id": None,
        "stage_statuses": {},
        "version": 1,
    }
    case["id"] = case["case_id"]
    request.app.state.adapters.database.create("cases", case)
    return {"case": case}


@router.get("")
def list_cases(request: Request, user: dict = Depends(get_current_user)) -> dict[str, list[dict[str, Any]]]:
    cases = [
        {
            "case_id": case["case_id"],
            "status": case["status"],
            "created_at": case["created_at"],
            "stage": case.get("stage"),
            "title": (case.get("client_story", "").strip() or "Untitled case")[:80],
            "preview": case.get("client_story", "").strip()[:140],
        }
        for case in request.app.state.adapters.database.list("cases")
        if case["owner_user_id"] == user["id"]
    ]
    cases.sort(key=lambda item: item["created_at"], reverse=True)
    return {"cases": cases}


@router.get("/{case_id}")
def get_case(case_id: str, request: Request, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    return {"case": get_owned_case(request, case_id, user)}


@router.patch("/{case_id}")
def update_case(case_id: str, body: CaseUpdateBody, request: Request, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    case = get_owned_case(request, case_id, user)
    if case["status"] != "DRAFT":
        raise HTTPException(status_code=409, detail="Only draft cases can be edited")
    changes = body.model_dump(exclude_none=True)
    merged_stage = changes.get("stage", case.get("stage"))
    merged_details = changes.get("stage_details", case.get("stage_details", {}))
    if "stage" in changes and changes["stage"] != case.get("stage"):
        merged_details = changes.get("stage_details", {})
    errors = validate_stage(merged_stage, merged_details)
    if errors:
        raise field_error(errors)
    changes["stage"] = merged_stage
    changes["stage_details"] = merged_details
    changes["version"] = case.get("version", 1) + 1
    updated = request.app.state.adapters.database.update("cases", case_id, changes)
    return {"case": updated}


@router.post("/{case_id}/submit")
def submit_case(case_id: str, request: Request, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    case = get_owned_case(request, case_id, user)
    if case["status"] != "DRAFT":
        raise HTTPException(status_code=409, detail="Only draft cases can be submitted")
    errors = validate_complete(case)
    if errors:
        raise field_error(errors)
    updated = request.app.state.adapters.database.update(
        "cases", case_id, {"status": "READY_FOR_ANALYSIS", "version": case.get("version", 1) + 1}
    )
    return {"case": updated}


@router.delete("/{case_id}")
def delete_case(case_id: str, request: Request, user: dict = Depends(get_current_user)) -> dict[str, str]:
    case = get_owned_case(request, case_id, user)
    if case["status"] != "DRAFT":
        raise HTTPException(status_code=409, detail="Only draft cases can be deleted")
    for item in case.get("evidence", []):
        request.app.state.adapters.storage.delete(item["storage_key"])
    request.app.state.adapters.database.delete("cases", case_id)
    return {"status": "deleted"}


@router.post("/{case_id}/evidence")
async def upload_evidence(
    case_id: str,
    request: Request,
    file: UploadFile = File(...),
    description: str = Form(""),
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    case = get_owned_case(request, case_id, user)
    if case["status"] not in {"DRAFT", "AWAITING_PREVIEW_1"}:
        raise HTTPException(status_code=409, detail="Evidence can only be added during draft or Preview 1")
    filename = file.filename or "upload"
    extension = "." + filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    content = await file.read()
    if extension not in ALLOWED_EXTENSIONS and not (file.content_type or "").startswith(("image/", "video/")):
        raise HTTPException(status_code=415, detail="Unsupported file type. Upload an image, PDF, document, or video.")
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File is too large. Maximum size is 10 MB.")
    evidence_id = next_evidence_id(case.get("evidence", []))
    storage_key = f"cases/{case_id}/{evidence_id}-{filename}"
    url = request.app.state.adapters.storage.upload(storage_key, content, file.content_type or "application/octet-stream")
    item = {
        "evidence_id": evidence_id,
        "filename": filename,
        "content_type": file.content_type or "application/octet-stream",
        "size": len(content),
        "storage_key": storage_key,
        "url": url,
        "description": description.strip(),
        "uploaded_at": utc_now(),
    }
    updated = request.app.state.adapters.database.update(
        "cases", case_id, {"evidence": case.get("evidence", []) + [item], "version": case.get("version", 1) + 1}
    )
    return {"evidence": item, "case": updated}


@router.get("/{case_id}/evidence/{evidence_id}")
def download_evidence(case_id: str, evidence_id: str, request: Request, user: dict = Depends(get_current_user)):
    case = get_owned_case(request, case_id, user)
    item = next((entry for entry in case.get("evidence", []) if entry["evidence_id"] == evidence_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Evidence not found")
    from fastapi.responses import Response
    return Response(
        content=request.app.state.adapters.storage.download(item["storage_key"]),
        media_type=item["content_type"],
        headers={"Content-Disposition": f'inline; filename="{item["filename"]}"'},
    )


@router.delete("/{case_id}/evidence/{evidence_id}")
def delete_evidence(case_id: str, evidence_id: str, request: Request, user: dict = Depends(get_current_user)) -> dict[str, Any]:
    case = get_owned_case(request, case_id, user)
    if case["status"] != "DRAFT":
        raise HTTPException(status_code=409, detail="Evidence can only be deleted from draft cases")
    item = next((entry for entry in case.get("evidence", []) if entry["evidence_id"] == evidence_id), None)
    if item is None:
        raise HTTPException(status_code=404, detail="Evidence not found")
    request.app.state.adapters.storage.delete(item["storage_key"])
    remaining = [entry for entry in case.get("evidence", []) if entry["evidence_id"] != evidence_id]
    updated = request.app.state.adapters.database.update("cases", case_id, {"evidence": remaining, "version": case.get("version", 1) + 1})
    return {"case": updated}


@router.patch("/{case_id}/evidence/{evidence_id}")
def update_evidence(
    case_id: str,
    evidence_id: str,
    body: EvidenceUpdateBody,
    request: Request,
    user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    case = get_owned_case(request, case_id, user)
    if case["status"] != "DRAFT":
        raise HTTPException(status_code=409, detail="Evidence can only be edited in draft cases")
    updated_entry = None
    evidence = []
    for entry in case.get("evidence", []):
        if entry["evidence_id"] == evidence_id:
            updated_entry = {**entry, "description": body.description.strip()}
            evidence.append(updated_entry)
        else:
            evidence.append(entry)
    if updated_entry is None:
        raise HTTPException(status_code=404, detail="Evidence not found")
    updated = request.app.state.adapters.database.update("cases", case_id, {"evidence": evidence, "version": case.get("version", 1) + 1})
    return {"evidence": updated_entry, "case": updated}
