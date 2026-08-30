"""Aplicacao FastAPI principal do Faísca."""
import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from backend.routers import session, campaigns, generation, polaroid, print_router, mural
from backend.db.database import init_db

app = FastAPI(
    title="Faísca",
    description="Backend para o totem educativo com IA",
    version="1.0.0"
)

# Configura CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inicializa Banco de Dados no startup
@app.on_event("startup")
async def on_startup():
    init_db()
    logging.info("Banco de dados inicializado.")

# Rotas de API
app.include_router(session.router, prefix="/api/session", tags=["Session"])
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["Campaigns"])
app.include_router(generation.router, prefix="/api/generate", tags=["Generation"])
app.include_router(polaroid.router, prefix="/api/polaroid", tags=["Polaroid"])
app.include_router(print_router.router, prefix="/api/print", tags=["Print"])
app.include_router(mural.router, prefix="/api/mural", tags=["Mural"])

# Frontend estático e arquivos gerados (output)
# Em produção, um Nginx faria isso melhor, mas para o totem funciona bem.
BASE_DIR = Path(__file__).parent.parent

# Serve output de imagens geradas
app.mount("/output", StaticFiles(directory=str(BASE_DIR / "output")), name="output")

# Serve arquivos estaticos
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "frontend" / "static")), name="static")

@app.get("/")
async def serve_index():
    return FileResponse(str(BASE_DIR / "frontend" / "index.html"))

@app.get("/p/{polaroid_id}", include_in_schema=False)
async def serve_polaroid_view(polaroid_id: str):
    return FileResponse(str(BASE_DIR / "frontend" / "polaroid_view.html"))

@app.get("/ar/{polaroid_id}")
async def serve_ar(polaroid_id: str):
    return FileResponse(str(BASE_DIR / "frontend" / "ar.html"))

@app.get("/mural", include_in_schema=False)
async def serve_mural():
    return FileResponse(str(BASE_DIR / "frontend" / "mural.html"))

@app.get("/health")
async def health():
    return {"status": "ok", "project": "Faísca"}
