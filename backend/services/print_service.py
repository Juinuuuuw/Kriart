"""Serviço de impressão de lotes de Polaroids."""
from pathlib import Path
from typing import List, Dict, Any
from PIL import Image
from loguru import logger
from backend.config import settings

# Dimensões de uma folha A4 em pixels (300 DPI)
A4_W, A4_H = 2480, 3508
# Tamanho de cada Polaroid na folha de impressão
POLAROID_PRINT_W, POLAROID_PRINT_H = 1100, 1320


class PrintService:
    """Monta folhas de impressão com múltiplos Polaroids e envia para impressora."""

    def __init__(self):
        self.output_dir = settings.OUTPUT_PRINTS_DIR
        self.batch_size = settings.POLAROID_PRINT_BATCH_SIZE
        self.printer_name = settings.PRINTER_NAME
        self.print_enabled = settings.PRINT_ENABLED

    async def print_batch(self, polaroids: List[Dict[str, Any]]) -> dict:
        """Monta a folha de impressão e envia (se habilitado)."""
        import uuid
        sheet_path = self.output_dir / f"print_sheet_{uuid.uuid4().hex[:6]}.png"
        sheet = self._compose_sheet(polaroids)
        sheet.save(str(sheet_path), "PNG", dpi=(300, 300))
        logger.info(f"Folha de impressão criada: {sheet_path}")

        if self.print_enabled:
            self._send_to_printer(sheet_path)

        return {
            "sheet_path": str(sheet_path),
            "sheet_url": f"/output/prints/{sheet_path.name}",
            "count": len(polaroids),
            "printed": self.print_enabled,
        }

    def _compose_sheet(self, polaroids: List[Dict[str, Any]]) -> Image.Image:
        """Compõe a folha A4 com os Polaroids organizados em grid."""
        sheet = Image.new("RGB", (A4_W, A4_H), (255, 255, 255))
        cols = 2
        margin_x = (A4_W - cols * POLAROID_PRINT_W) // (cols + 1)
        margin_y = 80
        spacing_y = (A4_H - margin_y * 2 - 3 * POLAROID_PRINT_H) // 2

        for i, pol in enumerate(polaroids[:6]):
            col = i % cols
            row = i // cols
            x = margin_x + col * (POLAROID_PRINT_W + margin_x)
            y = margin_y + row * (POLAROID_PRINT_H + spacing_y)

            try:
                pol_img = Image.open(pol["polaroid_path"]).convert("RGB")
                pol_img = pol_img.resize((POLAROID_PRINT_W, POLAROID_PRINT_H), Image.LANCZOS)
                sheet.paste(pol_img, (x, y))
            except Exception as e:
                logger.warning(f"Erro ao adicionar polaroid à folha: {e}")

        return sheet

    def _send_to_printer(self, file_path: Path):
        """Envia o arquivo para impressão no Windows."""
        import subprocess
        try:
            subprocess.run(
                ["mspaint", "/pt", str(file_path), self.printer_name],
                check=True, timeout=30
            )
            logger.info(f"Enviado para impressora: {self.printer_name}")
        except Exception as e:
            logger.error(f"Erro ao imprimir: {e}")
            raise
