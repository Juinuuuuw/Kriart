"""Serviço de composição do Polaroid digital."""
import uuid
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from loguru import logger
from backend.config import settings
from backend.models.session import SessionState
from backend.services.qrcode_service import QRCodeService


class PolaroidService:
    """Compõe o Polaroid final combinando imagem, texto, identidade visual e QR Code."""

    def __init__(self):
        self.output_dir = settings.OUTPUT_POLAROIDS_DIR
        self.assets_dir = Path("assets/polaroid_template")
        self.qr_svc = QRCodeService()

        # Dimensões do Polaroid (estilo físico)
        self.width = 600
        self.height = 720
        self.image_area = (60, 60, 540, 480)  # (left, top, right, bottom)
        self.bg_color = (255, 255, 255)  # Branco
        self.border_color = (230, 230, 230)

    async def create_polaroid(self, session: SessionState) -> dict:
        """Cria os Polaroids e retorna seus dados."""
        polaroid_id = uuid.uuid4().hex[:10].upper()
        qrcode_url = f"{settings.BASE_URL}/p/{polaroid_id}"

        # Gera o QR Code
        qr_path = await self.qr_svc.generate(polaroid_id, qrcode_url)

        # Gera versão rascunho (sketch) da imagem original
        from PIL import Image, ImageOps, ImageEnhance, ImageFilter
        orig_img_path = Path(session.generated_image_path)
        sketch_img_path = orig_img_path.with_name(orig_img_path.stem + "_sketch" + orig_img_path.suffix)
        
        try:
            with Image.open(orig_img_path) as img:
                img_gray = img.convert('L')
                edges = img_gray.filter(ImageFilter.FIND_EDGES)
                edges = ImageOps.invert(edges)
                enhancer = ImageEnhance.Contrast(edges)
                sketch_img = enhancer.enhance(3.0)
                sketch_img.save(sketch_img_path)
        except Exception as e:
            logger.error(f"Erro ao gerar rascunho: {e}")
            sketch_img_path = orig_img_path

        # Cria a imagem do Polaroid Colorido
        polaroid_color = await self._compose(
            polaroid_id=polaroid_id,
            image_path=str(orig_img_path),
            phrase=session.user_phrase or session.user_message or "",
            participant_name=session.participant_name,
            campaign_id=session.campaign_id,
            qr_path=qr_path,
            suffix="_color"
        )
        
        # Cria a imagem do Polaroid Rascunho
        polaroid_sketch = await self._compose(
            polaroid_id=polaroid_id,
            image_path=str(sketch_img_path),
            phrase=session.user_phrase or session.user_message or "",
            participant_name=session.participant_name,
            campaign_id=session.campaign_id,
            qr_path=qr_path,
            suffix="_sketch"
        )

        # Gera o Sprite Sheet para WebAR
        from backend.services.animation_service import generate_ar_spritesheet
        spritesheet_path = self.output_dir / f"ar_{polaroid_id}.jpg"
        try:
            spritesheet_path_out = generate_ar_spritesheet(str(orig_img_path), str(spritesheet_path))
            ar_url = f"/output/polaroids/{Path(spritesheet_path_out).name}"
        except Exception as e:
            logger.error(f"Erro ao gerar AR Sprite Sheet: {e}")
            ar_url = None

        # Retorna o polaroid padrão como o colorido (para compatibilidade do banco), 
        # mas inclui o sketch no dict para o frontend exibir ambos.
        return {
            "id": polaroid_id,
            "session_id": session.session_id,
            "campaign_id": session.campaign_id,
            "participant_name": session.participant_name,
            "phrase": session.user_phrase or session.user_message or "",
            "image_path": str(orig_img_path),
            "polaroid_path": str(polaroid_color),
            "polaroid_sketch_path": str(polaroid_sketch),
            "qrcode_path": str(qr_path),
            "qrcode_url": qrcode_url,
            "polaroid_url": f"/output/polaroids/{polaroid_color.name}",
            "polaroid_sketch_url": f"/output/polaroids/{polaroid_sketch.name}",
            "ar_spritesheet_url": ar_url,
            "printed": False,
        }

    async def _compose(self, polaroid_id: str, image_path: str, phrase: str,
                       participant_name, campaign_id: str,
                       qr_path: Path, suffix: str = "") -> Path:
        """Compõe a imagem do Polaroid."""
        # Base branca do Polaroid
        polaroid = Image.new("RGB", (self.width, self.height), self.bg_color)
        draw = ImageDraw.Draw(polaroid)

        # Borda sutil
        draw.rectangle(
            [(0, 0), (self.width - 1, self.height - 1)],
            outline=self.border_color, width=3
        )

        # Imagem gerada
        try:
            gen_img = Image.open(image_path).convert("RGB")
            img_w = self.image_area[2] - self.image_area[0]
            img_h = self.image_area[3] - self.image_area[1]
            gen_img = gen_img.resize((img_w, img_h), Image.LANCZOS)
            polaroid.paste(gen_img, (self.image_area[0], self.image_area[1]))
        except Exception as e:
            logger.error(f"Erro ao carregar imagem gerada: {e}")
            # Placeholder colorido
            draw.rectangle(self.image_area, fill=(200, 220, 255))
            draw.text((self.image_area[0] + 20, self.image_area[1] + 20),
                      "[Imagem]", fill=(100, 100, 100))

        # Fonte
        try:
            font_phrase = ImageFont.truetype("arial.ttf", 22)
            font_small = ImageFont.truetype("arial.ttf", 14)
        except Exception:
            font_phrase = ImageFont.load_default()
            font_small = ImageFont.load_default()

        # Frase do participante
        phrase_y = self.image_area[3] + 20
        draw.text((self.width // 2, phrase_y), f'"{phrase}"',
                  font=font_phrase, fill=(50, 50, 50), anchor="mm")

        # Nome do participante
        if participant_name:
            draw.text((self.width // 2, phrase_y + 35), f"— {participant_name}",
                      font=font_small, fill=(120, 120, 120), anchor="mm")

        # Identidade UERN / LAR (deslocado para a direita para dar espaço ao Hiro)
        footer_y = self.height - 60
        text_x = 90
        draw.text((text_x, footer_y), "UERN / LAR", font=font_small, fill=(0, 80, 160))
        draw.text((text_x, footer_y + 16), f"Campanha: {campaign_id}",
                  font=font_small, fill=(100, 100, 100))
        draw.text((text_x, footer_y + 32), "GO!RN", font=font_small, fill=(0, 150, 80))

        # QR Code
        try:
            qr_img = Image.open(qr_path).convert("RGBA")
            qr_size = 80
            qr_img = qr_img.resize((qr_size, qr_size), Image.LANCZOS)
            qr_x = self.width - qr_size - 20
            qr_y = self.height - qr_size - 15
            polaroid.paste(qr_img, (qr_x, qr_y))
        except Exception as e:
            logger.warning(f"Erro ao inserir QR Code: {e}")
            
        # AR.js Hiro Marker
        try:
            hiro_img = Image.open(Path("assets/hiro.png")).convert("RGBA")
            hiro_size = 60
            hiro_img = hiro_img.resize((hiro_size, hiro_size), Image.LANCZOS)
            # Coloca no canto inferior esquerdo
            hiro_x = 20
            hiro_y = self.height - hiro_size - 15
            polaroid.paste(hiro_img, (hiro_x, hiro_y))
        except Exception as e:
            logger.warning(f"Erro ao inserir Hiro marker: {e}")

        # ID no rodapé
        draw.text((self.width // 2, self.height - 12),
                  f"ID: {polaroid_id}", font=font_small,
                  fill=(180, 180, 180), anchor="mm")

        # Salva o Polaroid
        output_path = self.output_dir / f"polaroid_{polaroid_id}{suffix}.png"
        polaroid.save(str(output_path), "PNG")
        logger.info(f"Polaroid criado: {output_path}")
        return output_path
