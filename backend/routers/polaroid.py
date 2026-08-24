"""Endpoints de geracao e consulta de Polaroids."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

from backend.services.polaroid_service import PolaroidService
from backend.services.qrcode_service import QRCodeService
from backend.routers.session import _sessions
from backend.models.session import FlowStep
from backend.db import crud
from backend.db.database import SessionLocal

router = APIRouter()

polaroid_svc = PolaroidService()
qr_svc = QRCodeService()

# Registro de Polaroids em memoria (complementa o banco)
_polaroids = {}


class PolaroidRequest(BaseModel):
    session_id: str
    participant_name: Optional[str] = None


@router.post("/create")
async def create_polaroid(request: PolaroidRequest):
    """Cria o Polaroid final a partir da sessao."""
    if request.session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")

    session = _sessions[request.session_id]

    if not session.validation_passed or not session.generated_image_path:
        raise HTTPException(
            status_code=400,
            detail="Imagem ainda nao gerada ou validada"
        )

    if request.participant_name:
        session.participant_name = request.participant_name

    polaroid_data = await polaroid_svc.create_polaroid(session)
    _polaroids[polaroid_data["id"]] = polaroid_data

    session.polaroid_id = polaroid_data["id"]
    session.polaroid_path = polaroid_data["polaroid_path"]
    session.step = FlowStep.COMPLETED
    _sessions[request.session_id] = session

    # Persiste no banco e notifica o mural via SSE
    try:
        db = SessionLocal()
        db_record = crud.save_polaroid(db, polaroid_data)
        db.close()
        from backend.routers.mural import notify_new_polaroid
        notify_new_polaroid(db_record)
    except Exception:
        pass  # SSE/persistência não devem quebrar a criação

    return polaroid_data


@router.get("/{polaroid_id}")
async def get_polaroid(polaroid_id: str):
    """Retorna os dados de um Polaroid pelo ID."""
    if polaroid_id not in _polaroids:
        raise HTTPException(status_code=404, detail="Polaroid nao encontrado")
    return _polaroids[polaroid_id]


@router.get("/")
async def list_polaroids_route(campaign_id: Optional[str] = None):
    """Lista todos os Polaroids, opcionalmente filtrados por campanha."""
    polaroids = list(_polaroids.values())
    if campaign_id:
        polaroids = [p for p in polaroids if p.get("campaign_id") == campaign_id]
    return polaroids

