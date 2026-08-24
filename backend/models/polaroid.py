"""Modelo do Polaroid gerado."""
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class PolaroidRecord(BaseModel):
    """Registro de um Polaroid criado."""
    id: str
    session_id: str
    campaign_id: str
    participant_name: Optional[str]
    phrase: str
    image_path: str
    polaroid_path: str
    qrcode_path: str
    qrcode_url: str
    printed: bool = False
    created_at: datetime

    class Config:
        from_attributes = True
