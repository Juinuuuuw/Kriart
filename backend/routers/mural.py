"""Endpoints do Mural — listagem de polaroids e SSE para atualizações em tempo real."""
import json
import asyncio
from datetime import datetime
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import AsyncGenerator

from backend.db.crud import get_db, list_polaroids
from backend.db.database import PolaroidDB
from backend.models.polaroid import PolaroidRecord

router = APIRouter()

# Fila de eventos SSE: qualquer novo polaroid salvo publica aqui
_subscribers: list[asyncio.Queue] = []


def notify_new_polaroid(record: PolaroidDB):
    """Chamado pelo router de polaroid quando um novo é criado. Publica para todos os assinantes SSE."""
    polaroid_url = "/" + record.polaroid_path.replace("\\", "/")
    image_url = "/" + record.image_path.replace("\\", "/")
    payload = {
        "id": record.id,
        "campaign_id": record.campaign_id,
        "participant_name": record.participant_name or "Participante",
        "phrase": record.phrase,
        "polaroid_url": polaroid_url,
        "image_url": image_url,
        "created_at": record.created_at.isoformat() if record.created_at else datetime.utcnow().isoformat(),
    }
    msg = f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
    dead = []
    for q in _subscribers:
        try:
            q.put_nowait(msg)
        except asyncio.QueueFull:
            dead.append(q)
    for q in dead:
        _subscribers.remove(q)


@router.get("/polaroids")
async def get_mural_polaroids(campaign_id: str = None, db: Session = Depends(get_db)):
    """Retorna todos os polaroids do mural, opcionalmente filtrados por campanha."""
    records = list_polaroids(db, campaign_id=campaign_id)
    result = []
    for r in records:
        polaroid_url = "/" + r.polaroid_path.replace("\\", "/")
        image_url = "/" + r.image_path.replace("\\", "/")
        result.append({
            "id": r.id,
            "campaign_id": r.campaign_id,
            "participant_name": r.participant_name or "Participante",
            "phrase": r.phrase,
            "polaroid_url": polaroid_url,
            "image_url": image_url,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        })
    return result


@router.get("/stats")
async def get_mural_stats(db: Session = Depends(get_db)):
    """Retorna estatísticas gerais do mural."""
    all_records = list_polaroids(db)
    participants = len(set(r.participant_name for r in all_records if r.participant_name))
    return {
        "total_polaroids": len(all_records),
        "participants": max(participants, len(all_records)),
        "campaigns_count": 4,
        "art_styles_count": 6,
    }


@router.get("/stream")
async def mural_stream():
    """Server-Sent Events: transmite novos polaroids em tempo real para o mural."""
    queue: asyncio.Queue = asyncio.Queue(maxsize=50)
    _subscribers.append(queue)

    async def event_generator() -> AsyncGenerator[str, None]:
        yield "data: {\"type\": \"connected\"}\n\n"
        try:
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield msg
                except asyncio.TimeoutError:
                    # Heartbeat para manter a conexão viva
                    yield ": heartbeat\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            if queue in _subscribers:
                _subscribers.remove(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
