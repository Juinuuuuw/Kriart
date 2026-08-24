"""Endpoints relacionados as campanhas educativas."""
from fastapi import APIRouter, HTTPException
from typing import List
from pathlib import Path
import json

from backend.models.campaign import Campaign

router = APIRouter()

CAMPAIGNS_DIR = Path("campaigns")


def load_campaigns() -> List[Campaign]:
    """Carrega todas as campanhas do diretorio campaigns/."""
    campaigns = []
    for file in CAMPAIGNS_DIR.glob("*.json"):
        with open(file, encoding="utf-8") as f:
            data = json.load(f)
            campaigns.append(Campaign(**data))
    return campaigns


@router.get("/", response_model=List[Campaign])
async def list_campaigns():
    """Lista todas as campanhas disponiveis."""
    return load_campaigns()


@router.get("/{campaign_id}", response_model=Campaign)
async def get_campaign(campaign_id: str):
    """Retorna os dados de uma campanha especifica."""
    file = CAMPAIGNS_DIR / f"{campaign_id}.json"
    if not file.exists():
        raise HTTPException(status_code=404, detail="Campanha nao encontrada")
    with open(file, encoding="utf-8") as f:
        data = json.load(f)
    return Campaign(**data)
