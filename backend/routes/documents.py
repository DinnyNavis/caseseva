from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response
from pydantic import BaseModel

from ..models.case import utc_now
from ..services.documents import build_documents
from .dependencies import get_current_user, get_case_or_error

router = APIRouter(prefix="/api/cases")


def accessible_case(request: Request, case_id: str, user: dict[str, Any]) -> dict[str, Any]:
    case = request.app.state.adapters.database.get("cases", case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if case.get("owner_user_id") == user.get("id"):
        return case
    if case.get("assigned_advocate_id") == user.get("id") and user.get("role") == "advocate" and case.get("status") in {"ADVOCATE_APPROVED", "DOCUMENTS_READY", "DOCUMENTS_BLOCKED"}:
        return case
    raise HTTPException(status_code=403, detail="You do not have access to these documents")


def serialize(doc: dict[str, Any]) -> dict[str, Any]:
    return {key: doc.get(key) for key in ("id", "case_id", "type", "version", "created_at", "consistency", "download_url")}


def run_generation(request: Request, case: dict[str, Any]) -> list[dict[str, Any]]:
    generated = build_documents(case)
    db = request.app.state.adapters.database
    version = generated["version"]
    stored = []
    for kind in ("report", "draft"):
        content = generated[kind]
        key = f"cases/{case['case_id']}/documents/v{version}/{kind}.html"
        text_key = f"cases/{case['case_id']}/documents/v{version}/{kind}.txt"
        request.app.state.adapters.storage.upload(key, content["html"].encode(), "text/html")
        request.app.state.adapters.storage.upload(text_key, content["text"].encode(), "text/plain")
        item = {
            "id": f"{generated['id']}-{kind}", "case_id": case["case_id"], "type": kind,
            "version": version, "created_at": generated["created_at"], "html": content["html"],
            "text": content["text"], "storage_key": key, "text_storage_key": text_key,
            "consistency": generated["consistency"], "download_url": f"/api/cases/{case['case_id']}/documents/{generated['id']}-{kind}/download",
        }
        db.create("documents", item)
        stored.append(item)
    has_failures = any(item.get("result") == "FAIL" for item in generated["consistency"])
    db.update("cases", case["case_id"], {
        "status": "DOCUMENTS_BLOCKED" if has_failures else "DOCUMENTS_READY",
        "document_version": version,
        "document_consistency": generated["consistency"],
        "document_generation_stage": "COMPLETED",
        "version": case.get("version", 1) + 1,
    })
    return stored


@router.post("/{case_id}/documents/generate")
def generate(case_id: str, request: Request, user: dict = Depends(get_current_user)):
    case = get_case_or_error(request, case_id, user)
    if case.get("status") != "ADVOCATE_APPROVED":
        raise HTTPException(status_code=409, detail="Documents can only be generated after advocate approval")
    request.app.state.adapters.database.update("cases", case_id, {"status": "GENERATING_DOCUMENTS", "document_generation_stage": "RUNNING"})
    try:
        docs = run_generation(request, request.app.state.adapters.database.get("cases", case_id))
    except ValueError as exc:
        request.app.state.adapters.database.update("cases", case_id, {"status": "ADVOCATE_APPROVED", "document_generation_stage": "FAILED"})
        raise HTTPException(status_code=422, detail=str(exc))
    current = request.app.state.adapters.database.get("cases", case_id)
    return {"documents": [serialize(doc) for doc in docs], "status": current.get("status")}


@router.post("/{case_id}/documents/regenerate")
def regenerate(case_id: str, request: Request, user: dict = Depends(get_current_user)):
    case = get_case_or_error(request, case_id, user)
    if case.get("status") not in {"ADVOCATE_APPROVED", "DOCUMENTS_READY", "DOCUMENTS_BLOCKED"}:
        raise HTTPException(status_code=409, detail="Regeneration requires advocate approval")
    docs = run_generation(request, case)
    current = request.app.state.adapters.database.get("cases", case_id)
    return {"documents": [serialize(doc) for doc in docs], "status": current.get("status")}


@router.get("/{case_id}/documents")
def list_documents(case_id: str, request: Request, user: dict = Depends(get_current_user)):
    accessible_case(request, case_id, user)
    return {"documents": [serialize(doc) for doc in request.app.state.adapters.database.list("documents") if doc.get("case_id") == case_id]}


@router.get("/{case_id}/documents/{document_id}")
def get_document(case_id: str, document_id: str, request: Request, user: dict = Depends(get_current_user)):
    accessible_case(request, case_id, user)
    doc = request.app.state.adapters.database.get("documents", document_id)
    if not doc or doc.get("case_id") != case_id:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"document": {key: doc.get(key) for key in ("id", "case_id", "type", "version", "created_at", "html", "text", "consistency")}}


@router.get("/{case_id}/documents/{document_id}/download")
def download_document(case_id: str, document_id: str, request: Request, user: dict = Depends(get_current_user)):
    accessible_case(request, case_id, user)
    doc = request.app.state.adapters.database.get("documents", document_id)
    if not doc or doc.get("case_id") != case_id:
        raise HTTPException(status_code=404, detail="Document not found")
    return Response(content=request.app.state.adapters.storage.download(doc["storage_key"]), media_type="text/html", headers={"Content-Disposition": f'attachment; filename="{doc["type"]}-v{doc["version"]}.html"'})


@router.get("/{case_id}/documents/{document_id}/consistency")
def consistency(case_id: str, document_id: str, request: Request, user: dict = Depends(get_current_user)):
    accessible_case(request, case_id, user)
    doc = request.app.state.adapters.database.get("documents", document_id)
    if not doc or doc.get("case_id") != case_id:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"findings": doc.get("consistency", [])}


class OverrideBody(BaseModel):
    reason: str


@router.post("/{case_id}/documents/{document_id}/override-consistency")
def override_consistency(case_id: str, document_id: str, body: OverrideBody, request: Request, user: dict = Depends(get_current_user)):
    if user.get("role") != "advocate":
        raise HTTPException(status_code=403, detail="Advocate access required")
    case = accessible_case(request, case_id, user)
    doc = request.app.state.adapters.database.get("documents", document_id)
    if not doc or doc.get("case_id") != case_id:
        raise HTTPException(status_code=404, detail="Document not found")
    if not body.reason.strip():
        raise HTTPException(status_code=422, detail="Override reason is required")
    override = {"advocate_id": user["id"], "reason": body.reason.strip(), "at": utc_now()}
    updated = request.app.state.adapters.database.update("documents", document_id, {"consistency_override": override})
    documents = [item for item in request.app.state.adapters.database.list("documents") if item.get("case_id") == case_id]
    all_clear = all(
        not any(finding.get("result") == "FAIL" for finding in item.get("consistency", []))
        or item.get("consistency_override")
        or item["id"] == document_id
        for item in documents
    )
    request.app.state.adapters.database.update("cases", case_id, {"document_consistency_override": override, "status": "DOCUMENTS_READY" if all_clear else case.get("status")})
    return {"document": serialize(updated), "override": override}
