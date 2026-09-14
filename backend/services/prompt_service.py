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
Estilo visual: {session.visual_style or 'illustration'}
Elementos: {session.visual_elements or ''}
"""
        system_prompt = """You are an AI that translates Portuguese ideas into simple English comma-separated tags for Stable Diffusion.
Keep your prompts simple and correct. 
Use booru-style tags (e.g., 1girl, 2girls, multiple girls, boy, group of people). Accurately reflect the number of subjects based on the text.
DO NOT use tags like 'Realistic', '8k', 'masterpiece', or 'best quality' (these will be added automatically).
Do NOT include abstract concepts, words, or text. The image must be safe for children.
Respond with ONLY the comma-separated tags, no explanations."""

        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user", 
                    "content": "Generate tags for:\nCampanha: Bullying\nMensagem: Uma criança que está sendo excluída\nEstilo visual: anime style"
                },
                {
                    "role": "assistant", 
                    "content": "anime style, 1girl, sad, sitting alone, other children playing in background, school playground, day"
                },
                {
                    "role": "user", 
                    "content": "Generate tags for:\nCampanha: Violência contra a Mulher\nMensagem: Um grupo de mulheres de mãos dadas, mostrando união e força\nEstilo visual: 3d render"
                },
                {
                    "role": "assistant", 
                    "content": "3d render, multiple girls, group of women, holding hands, standing together, smiling, nature background, bright lighting"
                },
                {"role": "user", "content": f"Generate tags for:\n{user_context}"},
            ],
            "stream": False,
            "keep_alive": 0,
            "options": {"temperature": 0.5, "num_predict": 100, "num_gpu": -1},
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
                
                # Checkpoint required prefix
                return f"(best quality, masterpiece), {raw_prompt}"
        except Exception as e:
            logger.warning(f"Erro ao gerar prompt com LLM, usando fallback: {e}")
            return self._fallback_prompt(session)

    def _fallback_prompt(self, session: SessionState) -> str:
        """Prompt de fallback caso o LLM não esteja disponível."""
        style = session.visual_style or "anime style"
        elements = session.visual_elements or "children, nature, friendship"
        return f"(best quality, masterpiece), {style}, {elements}, safe for children, day"
