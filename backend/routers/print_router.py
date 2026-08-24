"""Endpoints do sistema de impressao."""
from fastapi import APIRouter, HTTPException
from backend.services.print_service import PrintService
from backend.routers.polaroid import _polaroids

router = APIRouter()
print_svc = PrintService()


@router.get("/status")
async def print_status():
    """Retorna status da impressao (quantos Polaroids aguardam impressao)."""
    pending = [p for p in _polaroids.values() if not p.get("printed")]
    return {
        "pending": len(pending),
        "batch_size": print_svc.batch_size,
        "ready_to_print": len(pending) >= print_svc.batch_size,
    }


@router.post("/batch")
async def print_batch():
    """Monta e envia para impressao o proximo lote de Polaroids."""
    pending = [p for p in _polaroids.values() if not p.get("printed")]
    if len(pending) < print_svc.batch_size:
        raise HTTPException(
            status_code=400,
            detail=f"Aguardando {print_svc.batch_size - len(pending)} participante(s) para completar o lote"
        )
    result = await print_svc.print_batch(pending[:print_svc.batch_size])
    for p in pending[:print_svc.batch_size]:
        _polaroids[p["id"]]["printed"] = True
    return result


@router.post("/force")
async def force_print():
    """Forca a impressao imediata dos Polaroids pendentes (modo manual)."""
    pending = [p for p in _polaroids.values() if not p.get("printed")]
    if not pending:
        raise HTTPException(status_code=400, detail="Nenhum Polaroid pendente")
    result = await print_svc.print_batch(pending)
    for p in pending:
        _polaroids[p["id"]]["printed"] = True
    return result
