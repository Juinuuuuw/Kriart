"""Serviço de integração com Ollama (Phi-3 Mini)."""
import httpx
from loguru import logger
from backend.config import settings

SYSTEM_PROMPT = """Você é um assistente criativo do projeto Faísca da UERN (Universidade do Estado do Rio Grande do Norte).
Sua função é ajudar crianças e visitantes a criar campanhas educativas personalizadas de forma amigável, divertida e encorajadora.
Sempre responda em português brasileiro, de forma simples e acolhedora.
Evite qualquer conteúdo inadequado para crianças.
Seja conciso e positivo."""


class OllamaService:
    """Integração com o Ollama local para chat e estruturação de dados."""

    def __init__(self):
        self.base_url = settings.OLLAMA_BASE_URL
        self.model = settings.OLLAMA_CHAT_MODEL

    async def chat(self, user_message: str, context: str = None) -> str:
        """Envia uma mensagem ao modelo e retorna a resposta."""
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if context:
            messages.append({"role": "assistant", "content": context})
        messages.append({"role": "user", "content": user_message})

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.7, "num_predict": 300},
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()
                return data["message"]["content"]
        except Exception as e:
            logger.error(f"Erro ao chamar Ollama: {e}")
            raise

    async def structure_data(self, raw_input: str, campaign_context: dict) -> dict:
        """Estrutura as respostas do usuário em dados organizados para geração."""
        prompt = f"""Com base nas respostas do usuário abaixo, extraia e organize as informações para criar uma imagem educativa sobre '{campaign_context.get('nome', 'campanha educativa')}'.

Respostas do usuário:
{raw_input}

Responda APENAS em JSON válido com os campos:
- mensagem_principal: a mensagem que o usuário quer transmitir
- frase: a frase escolhida (máx 15 palavras)
- estilo_visual: estilo preferido (ex: ilustração infantil, aquarela, desenho)
- elementos_visuais: lista de elementos que devem aparecer na imagem
- tom: tom emocional (ex: alegre, sério, esperançoso, divertido)"""

        result_str = await self.chat(prompt)
        import json, re
        match = re.search(r'\{[^{}]+\}', result_str, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        return {
            "mensagem_principal": raw_input[:100],
            "frase": raw_input[:60],
            "estilo_visual": "ilustração infantil",
            "elementos_visuais": campaign_context.get("elementos", []),
            "tom": "alegre",
        }
