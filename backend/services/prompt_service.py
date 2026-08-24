"""Serviço de geração de prompt visual para o Stable Diffusion."""
import httpx
from loguru import logger
from backend.config import settings
from backend.models.session import SessionState


class PromptService:
    """Transforma os dados da sessão em um prompt visual detalhado para o SD."""

    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_PROMPT_MODEL

    async def build_prompt(self, session: SessionState) -> str:
        """Gera um prompt em inglês para o Stable Diffusion."""
        user_context = f"""
Campanha: {session.campaign_id}
Mensagem: {session.user_message or ''}
Frase: {session.user_phrase or ''}
Estilo visual: {session.visual_style or 'illustration'}
Elementos: {session.visual_elements or ''}
Tom/Mood: {session.mood or 'cheerful'}
"""
        system_prompt = """You are a creative AI assistant that generates Stable Diffusion prompts for educational campaigns.
Create a detailed, child-friendly, and literal image prompt in English.
Focus entirely on VISUAL descriptions (subject, setting, lighting, action). Do NOT include abstract concepts, words, or text.
The image must be appropriate for children, educational, and safe.
Do NOT include any violence, weapons, adult content, or inappropriate elements.
Respond with ONLY the prompt text, no explanations or quotes."""

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user", 
                    "content": "Generate a Stable Diffusion prompt for this educational campaign context:\nCampanha: reading_week\nMensagem: Leia um livro por dia\nFrase: \nEstilo visual: watercolor\nElementos: livros, árvore, crianças lendo\nTom/Mood: calm and magical"
                },
                {
                    "role": "assistant", 
                    "content": "A beautiful watercolor painting of happy children reading books under a large magical glowing tree, flying books, calm atmosphere, fantasy elements"
                },
                {"role": "user", "content": f"Generate a Stable Diffusion prompt for this educational campaign context:\n{user_context}"},
            ],
            "stream": False,
            "options": {"temperature": 0.7, "num_predict": 200},
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                raw_prompt = data["message"]["content"].strip()
                
                quality_suffix = (
                    ", educational illustration, child-friendly, vibrant colors, "
                    "high quality, detailed, safe for children, inspiring, positive message"
                )
                    
                return raw_prompt + quality_suffix
        except Exception as e:
            logger.warning(f"Erro ao gerar prompt com LLM, usando fallback: {e}")
            return self._fallback_prompt(session)

    def _fallback_prompt(self, session: SessionState) -> str:
        """Prompt de fallback caso o LLM não esteja disponível."""
        style = session.visual_style or "colorful illustration"
        mood = session.mood or "cheerful and inspiring"
        elements = session.visual_elements or "children, nature, friendship"
        return (
            f"{style}, {mood}, {elements}, educational campaign art, "
            "child-friendly, vibrant colors, high quality, positive message, "
            "school poster style, detailed background, safe for children"
        )
