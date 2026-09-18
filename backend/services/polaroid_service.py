"""Serviço de composição do Polaroid digital."""
import uuid
import math
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageEnhance, ImageFilter
from loguru import logger
from backend.config import settings
from backend.models.session import SessionState
from backend.services.qrcode_service import QRCodeService

# Campaign color map (fallback if JSON not readable)
CAMPAIGN_COLORS = {
    "setembro_amarelo": (245, 197, 24),
    "bullying": (76, 175, 80),
    "violencia_mulher": (194, 24, 91),
    "inclusao": (156, 39, 176),
}

def _hex_to_rgb(hex_color: str) -> tuple:
    """Converte #RRGGBB para (R, G, B)."""
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def _load_campaign_color(campaign_id: str) -> tuple:
    """Carrega a cor da campanha do JSON, com fallback."""
    try:
        p = Path(f"campaigns/{campaign_id}.json")
        if p.exists():
            data = json.loads(p.read_text(encoding="utf-8"))
            return _hex_to_rgb(data.get("cor_tema", "#7c6ef2"))
    except Exception:
        pass
    return CAMPAIGN_COLORS.get(campaign_id, (245, 197, 24))

def _wrap_text(text: str, font, max_width: int, draw: ImageDraw.ImageDraw) -> list:
    """Quebra texto em linhas que cabem em max_width."""
    words = text.split()
    lines = []
    current = ""
    for word in words:
        test = (current + " " + word).strip()
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines

class PolaroidService:
    """Compõe o Polaroid final combinando imagem, texto, identidade visual."""

    def __init__(self):
        self.output_dir = settings.OUTPUT_POLAROIDS_DIR
        self.qr_svc = QRCodeService()

        # Dimensões baseadas no "exemplo polaroid.png"
        self.width = 800
        self.height = 980
        
        self.pad = 40
        self.img_top = 60
        self.img_h = 560
        self.image_area = (self.pad, self.img_top, self.width - self.pad, self.img_top + self.img_h)

    async def create_polaroid(self, session: SessionState) -> dict:
        """Cria os Polaroids e retorna seus dados."""
        polaroid_id = uuid.uuid4().hex[:10].upper()
        qrcode_url = f"{settings.BASE_URL}/p/{polaroid_id}"

        # Gera o QR Code (lógica mantida)
        qr_path = await self.qr_svc.generate(polaroid_id, qrcode_url)

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

        campaign_color = _load_campaign_color(session.campaign_id)
        phrase = session.user_phrase or session.user_message or ""

        polaroid_color = await self._compose(
            polaroid_id=polaroid_id,
            image_path=str(orig_img_path),
            phrase=phrase,
            participant_name=session.participant_name,
            campaign_color=campaign_color,
            suffix="_color"
        )

        polaroid_sketch = await self._compose(
            polaroid_id=polaroid_id,
            image_path=str(sketch_img_path),
            phrase=phrase,
            participant_name=session.participant_name,
            campaign_color=campaign_color,
            suffix="_sketch"
        )

        from backend.services.animation_service import generate_ar_spritesheet
        spritesheet_path = self.output_dir / f"ar_{polaroid_id}.jpg"
        try:
            spritesheet_path_out = generate_ar_spritesheet(str(orig_img_path), str(spritesheet_path))
            ar_url = f"/output/polaroids/{Path(spritesheet_path_out).name}"
        except Exception as e:
            logger.error(f"Erro ao gerar AR Sprite Sheet: {e}")
            ar_url = None

        return {
            "id": polaroid_id,
            "session_id": session.session_id,
            "campaign_id": session.campaign_id,
            "participant_name": session.participant_name,
            "phrase": phrase,
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
                       participant_name, campaign_color: tuple, suffix: str = "") -> Path:
        """Compõe a imagem do Polaroid com o design idêntico ao exemplo."""
        W, H = self.width, self.height
        pad = self.pad
        ia = self.image_area

        polaroid = Image.new("RGB", (W, H), (255, 255, 255))
        draw = ImageDraw.Draw(polaroid)

        # Borda muito sutil do polaroid (só para dar limite na tela, mas é branco no branco)
        draw.rectangle([(0, 0), (W - 1, H - 1)], outline=(230, 230, 230), width=1)

        # ── Imagem Principal ──────────────────────────────────────────────────
        try:
            gen_img = Image.open(image_path).convert("RGB")
            # Recorta ou redimensiona para caber
            img_w = ia[2] - ia[0]
            img_h = ia[3] - ia[1]
            gen_img = ImageOps.fit(gen_img, (img_w, img_h), Image.LANCZOS)
            polaroid.paste(gen_img, (ia[0], ia[1]))
        except Exception as e:
            logger.error(f"Erro ao carregar imagem: {e}")
            draw.rectangle(ia, fill=(240, 240, 240))

        # ── Elementos Decorativos (Top) ───────────────────────────────────────
        # Fita adesiva (canto superior esquerdo)
        # Vamos desenhar um polígono inclinado na cor da campanha
        tape_pts = [(0, 60), (160, 20), (170, 45), (10, 85)]
        draw.polygon(tape_pts, fill=campaign_color)
        # Mais um corte pequeno para dar efeito de fita rasgada
        draw.polygon([(0, 60), (10, 50), (20, 58), (10, 85)], fill=(255,255,255))
        
        # Brilhos/Solzinho (canto superior direito)
        # 3 linhas irradiando
        lx, ly = W - 30, 40
        draw.line([(lx, ly), (lx - 30, ly + 15)], fill=campaign_color, width=6)
        draw.line([(lx - 10, ly - 30), (lx - 40, ly - 10)], fill=campaign_color, width=6)
        draw.line([(lx - 50, ly + 30), (lx - 80, ly + 25)], fill=campaign_color, width=6)


        # ── Textos (Fonte Manuscrita) ─────────────────────────────────────────
        def load_system_font(name, size):
            try:
                return ImageFont.truetype(name, size)
            except:
                return ImageFont.load_default()

        # Fonte estilo caligrafia para a frase
        font_phrase = load_system_font("segoepr.ttf", 36)
        font_author = load_system_font("segoepr.ttf", 26)
        
        # Fonte para logo UERN/LAR
        font_logo = load_system_font("arialbd.ttf", 40)

        # Frase
        display_phrase = f'"{phrase}"' if phrase else ""
        lines = _wrap_text(display_phrase, font_phrase, W - 140, draw)
        
        phrase_y = ia[3] + 50
        line_spacing = 50
        for i, line in enumerate(lines[:3]):
            # Desenha com uma leve inclinação ou só reto? Vamos fazer reto, como no exemplo
            draw.text((100, phrase_y + i * line_spacing), line, font=font_phrase, fill=(40, 40, 40))

        # Ícone de aspas/brilho no começo da frase (igual no exemplo)
        q_y = phrase_y + 10
        draw.line([(80, q_y), (50, q_y + 10)], fill=campaign_color, width=6)
        draw.line([(80, q_y + 30), (45, q_y + 40)], fill=campaign_color, width=6)

        # Autor
        author = participant_name or "Anônimo"
        author_y = phrase_y + len(lines[:3]) * line_spacing + 15
        draw.text((100, author_y), f"— {author}", font=font_author, fill=(100, 100, 100))

        # ── Rodapé ───────────────────────────────────────────────────────────
        # Logo UERN / LAR
        logo_y = H - 80
        draw.text((40, logo_y), "UERN", font=font_logo, fill=(4, 30, 66)) # Azul UERN
        
        # Barra divisória
        div_x = 180
        draw.line([(div_x, logo_y), (div_x, logo_y + 45)], fill=(0, 0, 0), width=3)
        
        draw.text((div_x + 20, logo_y), "/ LAR", font=font_logo, fill=(50, 50, 50))

        # Onda/Forma geométrica canto inferior direito (como no exemplo)
        # Vamos desenhar um polígono preenchido com a cor
        wave_pts = [
            (W, H),
            (W - 120, H),
            (W - 100, H - 30),
            (W - 50, H - 90),
            (W, H - 110)
        ]
        draw.polygon(wave_pts, fill=campaign_color)
        
        # Detalhe de contorno paralelo da onda
        wave_line = [
            (W - 140, H),
            (W - 120, H - 40),
            (W - 70, H - 100),
            (W, H - 130)
        ]
        draw.line(wave_line, fill=campaign_color, width=6, joint="curve")

        output_path = self.output_dir / f"polaroid_{polaroid_id}{suffix}.png"
        polaroid.save(str(output_path), "PNG")
        logger.info(f"Polaroid criado: {output_path}")
        return output_path
