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

STRICT RULES - follow all:
1. COUNT subjects carefully: if the text mentions "group", "friends", "crianças", "pessoas", "rede", "apoio", "amigos", use: "group of people", "multiple girls", "multiple boys", "2girls 2boys" etc. NEVER use "1girl" or "1boy" for group scenes. A "rede de apoio" (support network) means a GROUP of 3+ people.
2. If text mentions "abraçar" (hug) between friends or a group, use "group hug", "friends hugging", "multiple people hugging". NEVER use romantic tags. Explicitly add "friends" tag.
3. If text mentions a couple explicitly, only THEN use "couple", "1boy 1girl".
4. Keep age-appropriate: use "children", "school kids", "teenagers", "adults" based on context.
5. Use booru-style tags (e.g., 2girls, 3boys, multiple people, group of children).
6. ALWAYS add natural hair colors: "black hair", "brown hair", "dark hair", "blonde hair", or "light brown hair". NEVER use blue, pink, purple, green, or rainbow hair.
7. DO NOT use tags like '8k', 'masterpiece', 'best quality', 'realistic' — they are added automatically.
8. Do NOT include abstract concepts or text in image. The image must be safe for children and teens.
9. Respond with ONLY the comma-separated tags, no explanations."""

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
                    "content": "anime style, 1girl, sad face, sitting alone on bench, multiple children playing in background, school playground, day, outdoor"
                },
                {
                    "role": "user", 
                    "content": "Generate tags for:\nCampanha: Amizade\nMensagem: Um grupo de amigos se abraçando felizes\nEstilo visual: cartoon"
                },
                {
                    "role": "assistant", 
                    "content": "cartoon, group of children, friends, group hug, multiple girls, multiple boys, laughing, happy, school, day, colorful clothes"
                },
                {
                    "role": "user", 
                    "content": "Generate tags for:\nCampanha: Violência contra a Mulher\nMensagem: Um grupo de mulheres de mãos dadas, mostrando união e força\nEstilo visual: 3d render"
                },
                {
                    "role": "assistant", 
                    "content": "3d render, multiple girls, group of women, holding hands, standing together, smiling, diverse group, nature background, bright lighting"
                },
                {
                    "role": "user", 
                    "content": "Generate tags for:\nCampanha: Meio Ambiente\nMensagem: Crianças plantando árvores juntas no parque\nEstilo visual: anime style"
                },
                {
                    "role": "assistant", 
                    "content": "anime style, multiple children, 2girls 1boy, planting trees, park, green environment, teamwork, smiling, nature, day, outdoor"
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
                
                # Safety net: LLMs pequenos às vezes ignoram as regras. Vamos forçar via código.
                msg_lower = (session.user_message or "").lower()
                group_keywords = ["amig", "grupo", "rede", "apoio", "criança", "pessoas", "turma"]
                if any(kw in msg_lower for kw in group_keywords):
                    if "multiple" not in raw_prompt.lower() and "group" not in raw_prompt.lower():
                        raw_prompt += ", group of people, multiple subjects, diverse group"
                    
                    # Remover tags isoladas que possam quebrar a geração
                    raw_prompt = raw_prompt.replace("1girl", "").replace("1boy", "").replace("single", "")

                final_prompt = f"(best quality, masterpiece), {raw_prompt}"
                logger.info(f"\n=======================================\nPROMPT FINAL:\n{final_prompt}\n=======================================\n")
                return final_prompt
        except Exception as e:
            logger.warning(f"Erro ao gerar prompt com LLM, usando fallback: {e}")
            return self._fallback_prompt(session)

    def _fallback_prompt(self, session: SessionState) -> str:
        """Prompt de fallback caso o LLM não esteja disponível."""
        style = session.visual_style or "anime style"
        elements = session.visual_elements or "children, nature, friendship"
        return f"(best quality, masterpiece), {style}, {elements}, safe for children, day"
