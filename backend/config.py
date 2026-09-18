"""Configuracoes centrais do Faísca via variaveis de ambiente."""
from pydantic_settings import BaseSettings
from pydantic import Field
from pathlib import Path


class Settings(BaseSettings):
    # Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_CHAT_MODEL: str = "phi3:mini"
    OLLAMA_PROMPT_MODEL: str = "phi3:mini"

    # Stable Diffusion Forge
    SD_FORGE_URL: str = "http://localhost:7860"
    SD_MODEL: str = "toonyou_beta6.safetensors"
    SD_STEPS: int = 25
    SD_CFG_SCALE: float = 7.0
    SD_WIDTH: int = 640
    SD_HEIGHT: int = 640
    SD_SAMPLER: str = "DPM++ 2M Karras"
    SD_NEGATIVE_PROMPT: str = (
        "(worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry), "
        "(nsfw, nude, naked, sexual, explicit), "
        "romantic, couple, lovers, intimate, kiss, kissing, adult content, "
        "bad anatomy, bad hands, missing fingers, extra fingers, fused fingers, too many fingers, "
        "deformed, mutated, extra limbs, disfigured, ugly, "
        "text, watermark, logo"
    )

    # App
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    DEBUG: bool = True
    SECRET_KEY: str = "change-me-in-production"

    # Database
    DATABASE_URL: str = "sqlite:///./kriart.db"

    # Output paths
    OUTPUT_POLAROIDS_DIR: Path = Path("output/polaroids")
    OUTPUT_PRINTS_DIR: Path = Path("output/prints")
    OUTPUT_QRCODES_DIR: Path = Path("output/qrcodes")

    # Polaroid
    POLAROID_PRINT_BATCH_SIZE: int = 6
    BASE_URL: str = "http://localhost:8000"

    # Impressao
    PRINT_ENABLED: bool = False
    PRINTER_NAME: str = ""

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()

# Garante que as pastas de output existam
for path in [
    settings.OUTPUT_POLAROIDS_DIR,
    settings.OUTPUT_PRINTS_DIR,
    settings.OUTPUT_QRCODES_DIR,
]:
    path.mkdir(parents=True, exist_ok=True)
