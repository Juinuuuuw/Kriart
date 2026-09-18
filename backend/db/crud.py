"""Operações CRUD no banco de dados."""
from sqlalchemy.orm import Session
from backend.db.database import PolaroidDB, SessionLocal
from typing import List, Optional


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def save_polaroid(db: Session, data: dict) -> PolaroidDB:
    """Salva um Polaroid no banco."""
    record = PolaroidDB(
        id=data["id"],
        session_id=data["session_id"],
        campaign_id=data["campaign_id"],
        participant_name=data.get("participant_name"),
        phrase=data["phrase"],
        image_path=data["image_path"],
        polaroid_path=data["polaroid_path"],
        polaroid_sketch_path=data.get("polaroid_sketch_path"),
        qrcode_path=data["qrcode_path"],
        qrcode_url=data["qrcode_url"],
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def get_polaroid(db: Session, polaroid_id: str) -> Optional[PolaroidDB]:
    return db.query(PolaroidDB).filter(PolaroidDB.id == polaroid_id).first()


def list_polaroids(db: Session, campaign_id: str = None) -> List[PolaroidDB]:
    q = db.query(PolaroidDB)
    if campaign_id:
        q = q.filter(PolaroidDB.campaign_id == campaign_id)
    return q.order_by(PolaroidDB.created_at.desc()).all()


def mark_as_printed(db: Session, polaroid_id: str):
    record = get_polaroid(db, polaroid_id)
    if record:
        record.printed = True
        db.commit()

from backend.db.database import SurveyResponseDB

def save_pre_test(db: Session, session_id: str, data: dict) -> SurveyResponseDB:
    """Salva os dados do pré-teste da pesquisa."""
    termo_aceito = data.get("termo_aceito") == "sim"
    status = "Aguardando jogar" if termo_aceito else "Não adepta"
    
    count = db.query(SurveyResponseDB).filter(SurveyResponseDB.termo_aceito == True).count()
    short_code = f"Q{count + 1}" if termo_aceito else None

    import json
    finalidades = data.get("finalidades_ia", [])
    if isinstance(finalidades, list):
        finalidades = json.dumps(finalidades)
        
    record = SurveyResponseDB(
        session_id=session_id,
        short_code=short_code,
        status=status,
        termo_aceito=termo_aceito,
        idade=data.get("idade"),
        escolaridade=data.get("escolaridade"),
        genero=data.get("genero"),
        uso_ia=data.get("uso_ia"),
        finalidades_ia=finalidades,
        percepcao_q6=data.get("q6"),
        percepcao_q7=data.get("q7"),
        percepcao_q8=data.get("q8"),
        percepcao_q9=data.get("q9"),
        percepcao_q10=data.get("q10"),
    )
    db.merge(record) # create or update
    db.commit()
    return record

def get_survey(db: Session, session_id: str) -> Optional[SurveyResponseDB]:
    return db.query(SurveyResponseDB).filter(SurveyResponseDB.session_id == session_id).first()

def update_survey_status(db: Session, session_id: str, status: str):
    record = get_survey(db, session_id)
    if record:
        record.status = status
        db.commit()

def list_surveys(db: Session) -> List[SurveyResponseDB]:
    return db.query(SurveyResponseDB).order_by(SurveyResponseDB.created_at.desc()).all()

def list_surveys_by_status(db: Session, status: str) -> List[SurveyResponseDB]:
    return db.query(SurveyResponseDB).filter(SurveyResponseDB.status == status).order_by(SurveyResponseDB.created_at.desc()).all()
