from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

from backend.db.database import SessionLocal
from backend.db import crud

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class PreTestRequest(BaseModel):
    session_id: str
    termo_aceito: str
    idade: Optional[str] = None
    escolaridade: Optional[str] = None
    genero: Optional[str] = None
    uso_ia: Optional[str] = None
    finalidades_ia: Optional[List[str]] = None
    q6: Optional[str] = None
    q7: Optional[str] = None
    q8: Optional[str] = None
    q9: Optional[str] = None
    q10: Optional[str] = None

@router.post("/pre-test")
def submit_pre_test(request: PreTestRequest, db: Session = Depends(get_db)):
    record = crud.save_pre_test(db, request.session_id, request.dict())
    return {"status": "success", "participant_status": record.status, "short_code": record.short_code}

class AbandonRequest(BaseModel):
    session_id: str

@router.post("/abandon")
def abandon_survey(req: AbandonRequest, db: Session = Depends(get_db)):
    record = crud.get_survey(db, req.session_id)
    if record and record.status in ["Aguardando pós-teste", "Aguardando jogar"]:
        crud.update_survey_status(db, req.session_id, "Desistiu")
        return {"status": "success", "message": "Participant abandoned"}
    return {"status": "ignored"}

@router.get("/dashboard")
def get_survey_dashboard(db: Session = Depends(get_db)):
    surveys = crud.list_surveys(db)
    stats = {
        "Não adepta": 0,
        "Aguardando pós-teste": 0,
        "Desistiu": 0,
        "Adepta ao estudo": 0
    }
    for s in surveys:
        if s.status in stats:
            stats[s.status] += 1
            
    waiting = [{"session_id": s.session_id, "short_code": s.short_code, "time": s.created_at.isoformat()} for s in surveys if s.status == "Aguardando pós-teste"]
    waiting_play = [{"session_id": s.session_id, "short_code": s.short_code, "time": s.created_at.isoformat()} for s in surveys if s.status == "Aguardando jogar"]
    
    return {
        "stats": stats,
        "waiting_post_test": waiting,
        "waiting_play": waiting_play,
        "total": len(surveys)
    }

@router.get("/waiting")
def get_waiting(db: Session = Depends(get_db)):
    playing = crud.list_surveys_by_status(db, "Aguardando jogar")
    post = crud.list_surveys_by_status(db, "Aguardando pós-teste")
    return {
        "waiting_play": [{"session_id": s.session_id, "short_code": s.short_code} for s in playing],
        "waiting_post": [{"session_id": s.session_id, "short_code": s.short_code} for s in post]
    }

class StartPlayRequest(BaseModel):
    session_id: str
    new_session_id: str

@router.post("/start-play")
def start_play(req: StartPlayRequest, db: Session = Depends(get_db)):
    """Called by the totem when a user selects their Q code to start playing."""
    record = crud.get_survey(db, req.session_id)
    if record and record.status == "Aguardando jogar":
        # The totem generates a new session ID for the actual image creation.
        # We need to update the survey to point to the new session ID, OR just use the survey's session_id for the creation.
        # Actually, it's easier to just use the pre-test's session_id as the main session_id!
        record.status = "Aguardando pós-teste"
        db.commit()
        return {"status": "success", "session_id": record.session_id}
    return {"status": "error", "message": "Not found or wrong status"}

@router.post("/post-test")
def submit_post_test(request: Dict[str, Any], db: Session = Depends(get_db)):
    session_id = request.get("session_id")
    if not session_id:
        return {"status": "error", "message": "No session_id"}
    
    record = crud.get_survey(db, session_id)
    if record and record.status == "Aguardando pós-teste":
        import json
        record.post_test_data = json.dumps(request)
        record.status = "Adepta ao estudo"
        db.commit()
        return {"status": "success", "message": "Post-test completed"}
    return {"status": "ignored"}
