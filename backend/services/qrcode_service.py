"""Serviço de geração de QR Codes."""
import qrcode
from pathlib import Path
from loguru import logger
from backend.config import settings


class QRCodeService:
    """Gera QR Codes únicos para cada Polaroid."""

    def __init__(self):
        self.output_dir = settings.OUTPUT_QRCODES_DIR

    async def generate(self, polaroid_id: str, url: str) -> Path:
        """Gera um QR Code para o URL do Polaroid e salva como PNG."""
        qr = qrcode.QRCode(
            version=2,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=8,
            border=2,
        )
        qr.add_data(url)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")
        output_path = self.output_dir / f"qr_{polaroid_id}.png"
        img.save(str(output_path))
        logger.info(f"QR Code gerado: {output_path} -> {url}")
        return output_path
