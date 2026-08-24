"""Endpoints de gerenciamento de sessao do usuario."""
from fastapi import APIRouter, HTTPException
from typing import Dict, Any
import uuid

from backend.models.session import SessionState, FlowStep
from backend.db import crud

router = APIRouter()

# Sessoes em memoria (simples para um evento presencial)
_sessions: Dict[str, SessionState] = {}


@router.post("/start", response_model=SessionState)
async def start_session():
    """Inicia uma nova sessao de criacao."""
    session_id = str(uuid.uuid4())
    session = SessionState(session_id=session_id)
    _sessions[session_id] = session
    return session


@router.get("/{session_id}", response_model=SessionState)
async def get_session(session_id: str):
    """Retorna o estado atual da sessao."""
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")
    return _sessions[session_id]


@router.patch("/{session_id}", response_model=SessionState)
async def update_session(session_id: str, updates: Dict[str, Any]):
    """Atualiza campos da sessao."""
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")
    session = _sessions[session_id]
    for key, value in updates.items():
        if hasattr(session, key):
            setattr(session, key, value)
    _sessions[session_id] = session
    return session


@router.delete("/{session_id}")
async def end_session(session_id: str):
    """Encerra e remove a sessao."""
    if session_id in _sessions:
        del _sessions[session_id]
    return {"status": "ok"}
