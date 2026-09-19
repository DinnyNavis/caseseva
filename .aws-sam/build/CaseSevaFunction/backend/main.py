from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .adapters.factory import load_adapters
from .routes.health import router as health_router
from .routes.auth import router as auth_router
from .routes.cases import router as cases_router
from .routes.analysis import router as analysis_router
from .routes.legal_analysis import router as legal_analysis_router
from .routes.advocates import router as advocates_router
from .routes.documents import router as documents_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.adapters = load_adapters()
    yield


app = FastAPI(title="CaseSeva.ai", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(health_router)
app.include_router(auth_router)
app.include_router(cases_router)
app.include_router(analysis_router)
app.include_router(legal_analysis_router)
app.include_router(advocates_router)
app.include_router(documents_router)
