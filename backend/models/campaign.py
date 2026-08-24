"""Modelo de dados de uma Campanha."""
from pydantic import BaseModel
from typing import List, Optional


class Campaign(BaseModel):
    """Representa uma campanha educativa configurada."""
    id: str
    nome: str
    objetivo: str
    descricao: str
    faixa_etaria: str
    estilos: List[str]
    elementos: List[str]
    cor_tema: str
    icone: Optional[str] = None
    perguntas_guia: List[str] = []
    sd_style_keywords: List[str] = []
