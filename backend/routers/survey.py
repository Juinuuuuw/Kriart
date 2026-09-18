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
    return {"status": "success", "participant_status": record.status}

class AbandonRequest(BaseModel):
    session_id: str

@router.post("/abandon")
def abandon_survey(req: AbandonRequest, db: Session = Depends(get_db)):
    record = crud.get_survey(db, req.session_id)
    if record and record.status == "Aguardando pós-teste":
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
            
    waiting = [{"session_id": s.session_id, "time": s.created_at.isoformat()} for s in surveys if s.status == "Aguardando pós-teste"]
    
    return {
        "stats": stats,
        "waiting_post_test": waiting,
        "total": len(surveys)
    }

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
