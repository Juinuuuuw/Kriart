"""Modelo de sessao do usuario durante o fluxo de criacao."""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from enum import Enum
from datetime import datetime


class FlowStep(str, Enum):
    CAMPAIGN_SELECTION = "campaign_selection"
    MESSAGE_CREATION = "message_creation"
    VISUAL_CHOICES = "visual_choices"
    GENERATING = "generating"
    VALIDATION = "validation"
    RESULT = "result"
    COMPLETED = "completed"


class SessionState(BaseModel):
    """Estado completo da sessao de criacao do usuario."""
    session_id: str
    step: FlowStep = FlowStep.CAMPAIGN_SELECTION
    campaign_id: Optional[str] = None
    user_message: Optional[str] = None
    user_phrase: Optional[str] = None
    visual_style: Optional[str] = None
    visual_elements: Optional[str] = None
    mood: Optional[str] = None
    color_type: Optional[str] = None
    participant_name: Optional[str] = None
    generated_prompt: Optional[str] = None
    generated_image_path: Optional[str] = None
    polaroid_id: Optional[str] = None
    polaroid_path: Optional[str] = None
    validation_passed: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    extra: Dict[str, Any] = {}
