"""Agente de validação multi-etapa de conteúdo."""
from loguru import logger
from pathlib import Path
from typing import Dict, Any

# Palavras/termos proibidos para filtragem de texto
PROHIBITED_TERMS = [
    # Violência
    "matar", "morte", "sangue", "violência", "arma", "faca", "tiro",
    "briga", "agressão", "kill", "murder", "blood", "weapon", "gun", "knife",
    # Drogas
    "droga", "cocaína", "maconha", "crack", "heroína", "drug", "cocaine",
    "marijuana", "heroin",
    # Conteúdo adulto
    "sexo", "pornô", "nudez", "sex", "nude", "porn", "nsfw",
    # Ódio
    "ódio", "racismo", "racista", "preconceito", "hate", "racist",
    # Ofensas graves
    "idiota", "imbecil", "estúpido", "burro", "retardado",
]

# Termos proibidos em prompts visuais
PROHIBITED_PROMPT_TERMS = [
    "nsfw", "nude", "naked", "explicit", "adult content", "18+",
    "gore", "gory", "blood", "violence", "weapon", "gun", "knife",
    "drug", "cocaine", "marijuana", "alcohol",
    "hate", "racist", "discrimination",
]


class ValidationService:
    """Valida entradas do usuário, prompts gerados e imagens resultantes."""

    async def validate_text_input(self, text: str) -> Dict[str, Any]:
        """Valida o texto inserido pelo usuário (Etapa 1)."""
        text_lower = text.lower()
        for term in PROHIBITED_TERMS:
            if term in text_lower:
                logger.warning(f"Termo proibido detectado na entrada: '{term}'")
                return {
                    "safe": False,
                    "reason": f"Conteúdo inadequado detectado. Por favor, use palavras adequadas para crianças.",
                    "flagged_term": term,
                }
        # Valida comprimento mínimo e máximo
        if len(text.strip()) < 3:
            return {"safe": False, "reason": "Texto muito curto."}
        if len(text) > 500:
            return {"safe": False, "reason": "Texto muito longo (máx. 500 caracteres)."}
        return {"safe": True, "reason": None}

    async def validate_prompt(self, prompt: str) -> Dict[str, Any]:
        """Valida o prompt visual gerado antes de enviar ao SD (Etapa 2)."""
        prompt_lower = prompt.lower()
        for term in PROHIBITED_PROMPT_TERMS:
            if term in prompt_lower:
                logger.warning(f"Termo proibido detectado no prompt: '{term}'")
                return {
                    "safe": False,
                    "reason": f"Prompt contém conteúdo inapropriado.",
                    "flagged_term": term,
                }
        return {"safe": True, "reason": None}

    async def validate_image(self, image_path: str) -> Dict[str, Any]:
        """
        Valida a imagem gerada (Etapa 3).
        Por ora, utiliza verificação básica de arquivo.
        Pode ser expandido com modelos de classificação de imagem (ex: NudeNet, CLIP).
        """
        path = Path(image_path)
        if not path.exists():
            return {"safe": False, "reason": "Imagem não encontrada."}
        if path.stat().st_size < 1000:
            return {"safe": False, "reason": "Arquivo de imagem inválido."}
        # TODO: Integrar modelo de classificação de imagem para validação mais robusta
        logger.info(f"Imagem validada (verificação básica): {image_path}")
        return {"safe": True, "reason": None}

    async def validate_final(self, polaroid_data: dict) -> Dict[str, Any]:
        """Validação final antes da impressão (Etapa 4)."""
        required_fields = ["phrase", "campaign_id", "polaroid_path"]
        for field in required_fields:
            if not polaroid_data.get(field):
                return {"safe": False, "reason": f"Campo obrigatório ausente: {field}"}
        # Revalida a frase
        phrase_check = await self.validate_text_input(polaroid_data["phrase"])
        if not phrase_check["safe"]:
            return phrase_check
        return {"safe": True, "reason": None}
