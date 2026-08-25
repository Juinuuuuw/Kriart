"""Aplicacao FastAPI principal do Kriart."""
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path

from backend.config import settings
from backend.db.database import init_db
from backend.routers import campaigns, session, generation, polaroid, print_router, mural

app = FastAPI(
    title="Kriart",
    description="Framework de Campanhas Educativas com Inteligencia Artificial",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["Campanhas"])
app.include_router(session.router, prefix="/api/session", tags=["Sessao"])
app.include_router(generation.router, prefix="/api/generate", tags=["Geracao IA"])
app.include_router(polaroid.router, prefix="/api/polaroid", tags=["Polaroid"])
app.include_router(print_router.router, prefix="/api/print", tags=["Impressao"])
app.include_router(mural.router, prefix="/api/mural", tags=["Mural"])

# Arquivos estaticos
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")
app.mount("/output", StaticFiles(directory="output"), name="output")


@app.on_event("startup")
async def startup_event():
    """Inicializa o banco de dados na inicializacao."""
    init_db()


@app.get("/", include_in_schema=False)
async def serve_index():
    return FileResponse("frontend/index.html")


@app.get("/p/{polaroid_id}", include_in_schema=False)
async def serve_polaroid_view(polaroid_id: str):
    return FileResponse("frontend/polaroid_view.html")

@app.get("/ar/{polaroid_id}", include_in_schema=False)
async def serve_ar_view(polaroid_id: str):
    return FileResponse("frontend/ar.html")

@app.get("/mural", include_in_schema=False)
async def serve_mural():
    return FileResponse("frontend/mural.html")

@app.get("/health")
async def health():
    return {"status": "ok", "project": "Kriart"}
