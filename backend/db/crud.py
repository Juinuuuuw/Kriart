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
