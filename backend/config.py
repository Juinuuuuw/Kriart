"""Configuracoes centrais do Faísca via variaveis de ambiente."""
from pydantic_settings import BaseSettings
from pydantic import Field
from pathlib import Path


class Settings(BaseSettings):
    # Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_CHAT_MODEL: str = "phi4-mini:latest"
    OLLAMA_PROMPT_MODEL: str = "phi4-mini:latest"

    # Stable Diffusion Forge
    SD_FORGE_URL: str = "http://localhost:7860"
    SD_MODEL: str = "toonyou_beta6.safetensors"
    SD_STEPS: int = 20
    SD_CFG_SCALE: float = 7.0
    SD_WIDTH: int = 640
    SD_HEIGHT: int = 640
    SD_SAMPLER: str = "Euler a"
    SD_NEGATIVE_PROMPT: str = (
        "nsfw, nude, naked, (worst quality, low quality:1.4), deformed, bad anatomy, bad proportions, ugly, duplicate, morbid, "
        "mutilated, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, blurry, bad art, extra limbs, "
        "gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, mutated hands, fused fingers, "
        "too many fingers, long neck, watermark, signature, text"
    )

    # App
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 5000
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
    BASE_URL: str = "http://localhost:5000"

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
