from fastapi import APIRouter, Request

router = APIRouter(prefix="/api")


@router.get("/health")
def health(request: Request) -> dict[str, str]:
    adapters = request.app.state.adapters
    return {"status": "ok", "adapter_mode": adapters.mode}
