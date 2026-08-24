"""Serviço de integração com Stable Diffusion Forge (API WebUI)."""
import httpx
import base64
import uuid
from pathlib import Path
from loguru import logger
from backend.config import settings


class StableDiffusionService:
    """Integração com o Stable Diffusion Forge via API."""

    def __init__(self):
        self.base_url = settings.SD_FORGE_URL
        self.output_dir = settings.OUTPUT_POLAROIDS_DIR

    async def generate(self, prompt: str) -> str:
        """Gera uma imagem e salva localmente. Retorna o caminho relativo."""
        neg_prompt = settings.SD_NEGATIVE_PROMPT + ", BadDream"

        payload = {
            "prompt": prompt,
            "negative_prompt": neg_prompt,
            "steps": settings.SD_STEPS,
            "cfg_scale": settings.SD_CFG_SCALE,
            "width": settings.SD_WIDTH,
            "height": settings.SD_HEIGHT,
            "sampler_name": settings.SD_SAMPLER,
            "batch_size": 1,
            "n_iter": 1,
            "alwayson_scripts": {
                "ADetailer": {
                    "args": [
                        True,
                        {
                            "ad_model": "face_yolov8n.pt",
                            "ad_mask_merge_invert": "Merge",
                            "ad_use_steps": True,
                            "ad_steps": 10
                        }
                    ]
                }
            }
        }

        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(
                    f"{self.base_url}/sdapi/v1/txt2img",
                    json=payload,
                )
                response.raise_for_status()
                data = response.json()

                # Decodifica e salva a imagem
                image_b64 = data["images"][0]
                image_bytes = base64.b64decode(image_b64)

                filename = f"img_{uuid.uuid4().hex[:8]}.png"
                output_path = self.output_dir / filename
                output_path.write_bytes(image_bytes)

                logger.info(f"Imagem gerada: {output_path}")
                return str(output_path)

        except Exception as e:
            logger.error(f"Erro ao gerar imagem com SD Forge: {e}")
            raise

    async def check_availability(self) -> bool:
        """Verifica se o SD Forge está disponível."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                r = await client.get(f"{self.base_url}/sdapi/v1/progress")
                return r.status_code == 200
        except Exception:
            return False
