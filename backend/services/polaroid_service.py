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
    "meio_ambiente": (76, 175, 80),
    "inclusao": (156, 39, 176),
}

CAMPAIGN_ICONS = {
    "setembro_amarelo": "heart",   # coração amarelo
    "bullying": "ribbon",          # laço verde
    "meio_ambiente": "ribbon",     # laço verde
    "inclusao": "heart",           # coração roxo
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
    return CAMPAIGN_COLORS.get(campaign_id, (124, 110, 242))


def _draw_heart(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int, color: tuple, alpha_img: Image.Image = None):
    """Desenha um coração centrado em (cx, cy)."""
    # Heart using two ellipses + a polygon
    r = size // 4
    # Left lobe
    draw.ellipse([cx - size//2, cy - r, cx, cy + r], fill=color)
    # Right lobe
    draw.ellipse([cx, cy - r, cx + size//2, cy + r], fill=color)
    # Bottom triangle
    draw.polygon([
        (cx - size//2, cy + r // 2),
        (cx + size//2, cy + r // 2),
        (cx, cy + size // 2),
    ], fill=color)


def _draw_ribbon(draw: ImageDraw.ImageDraw, cx: int, cy: int, size: int, color: tuple):
    """Desenha um laço de conscientização (awareness ribbon) centrado em (cx, cy)."""
    # Two overlapping loops + knot in the middle
    lw = max(6, size // 8)
    half = size // 2
    # Left loop
    draw.arc([cx - half, cy - half, cx, cy + half // 2], start=180, end=360, fill=color, width=lw)
    # Right loop
    draw.arc([cx, cy - half, cx + half, cy + half // 2], start=180, end=360, fill=color, width=lw)
    # Tails
    draw.line([(cx - half // 2, cy + half // 4), (cx, cy)], fill=color, width=lw)
    draw.line([(cx + half // 2, cy + half // 4), (cx, cy)], fill=color, width=lw)
    draw.line([(cx - half // 3, cy), (cx - half // 3, cy + half)], fill=color, width=lw)
    draw.line([(cx + half // 3, cy), (cx + half // 3, cy + half)], fill=color, width=lw)


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

        # Dimensões do Polaroid (proporção física 3:4 aprox)
        self.width = 600
        self.height = 750
        self.pad = 20  # padding lateral interno
        self.img_top = 20
        self.img_h = 440  # altura da área de imagem

    @property
    def image_area(self):
        return (self.pad, self.img_top, self.width - self.pad, self.img_top + self.img_h)

    async def create_polaroid(self, session: SessionState) -> dict:
        """Cria os Polaroids e retorna seus dados."""
        polaroid_id = uuid.uuid4().hex[:10].upper()
        qrcode_url = f"{settings.BASE_URL}/p/{polaroid_id}"

        # Gera o QR Code (mantém lógica backend, não exibe no polaroid)
        qr_path = await self.qr_svc.generate(polaroid_id, qrcode_url)

        # Gera versão rascunho (sketch) da imagem original
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

        # Cria a imagem do Polaroid Colorido
        polaroid_color = await self._compose(
            polaroid_id=polaroid_id,
            image_path=str(orig_img_path),
            phrase=phrase,
            participant_name=session.participant_name,
            campaign_id=session.campaign_id,
            campaign_color=campaign_color,
            suffix="_color"
        )

        # Cria a imagem do Polaroid Rascunho (para colorir)
        polaroid_sketch = await self._compose(
            polaroid_id=polaroid_id,
            image_path=str(sketch_img_path),
            phrase=phrase,
            participant_name=session.participant_name,
            campaign_id=session.campaign_id,
            campaign_color=campaign_color,
            suffix="_sketch"
        )

        # Gera o Sprite Sheet para WebAR (mantém lógica, não aparece no polaroid)
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
                       participant_name, campaign_id: str,
                       campaign_color: tuple, suffix: str = "") -> Path:
        """Compõe a imagem do Polaroid com novo design."""
        W, H = self.width, self.height
        pad = self.pad
        ia = self.image_area
        img_w = ia[2] - ia[0]
        img_h = ia[3] - ia[1]

        is_sketch = "_sketch" in suffix

        # ── Base ─────────────────────────────────────────────────────────────
        polaroid = Image.new("RGB", (W, H), (255, 255, 255))
        draw = ImageDraw.Draw(polaroid)

        # Barra de cor no topo (faixa da campanha)
        bar_h = 14
        draw.rectangle([(0, 0), (W, bar_h)], fill=campaign_color)

        # Borda sutil
        draw.rectangle([(0, 0), (W - 1, H - 1)], outline=(210, 210, 210), width=2)

        # ── Imagem gerada ────────────────────────────────────────────────────
        try:
            gen_img = Image.open(image_path).convert("RGB")
            gen_img = gen_img.resize((img_w, img_h), Image.LANCZOS)
            polaroid.paste(gen_img, (ia[0], ia[1]))
        except Exception as e:
            logger.error(f"Erro ao carregar imagem: {e}")
            draw.rectangle(ia, fill=(230, 235, 255))

        # Linha separadora sutil abaixo da imagem
        sep_y = ia[3] + 2
        draw.line([(pad, sep_y), (W - pad, sep_y)], fill=(220, 220, 220), width=1)

        # ── Fontes ───────────────────────────────────────────────────────────
        fonts_dir = Path("assets/fonts")
        def load_font(name, size):
            for candidate in [fonts_dir / name, Path(name)]:
                try:
                    return ImageFont.truetype(str(candidate), size)
                except Exception:
                    pass
            return ImageFont.load_default()

        font_brand_bold = load_font("Poppins-Bold.ttf", 18)
        font_brand      = load_font("Poppins-Regular.ttf", 11)
        font_phrase     = load_font("Poppins-SemiBold.ttf", 19)
        font_name       = load_font("Poppins-Regular.ttf", 14)
        font_tiny       = load_font("Poppins-Regular.ttf", 10)

        # ── Ícone decorativo (coração ou laço) ─────────────────────────────
        icon_type = CAMPAIGN_ICONS.get(campaign_id, "heart")
        icon_cx = W - pad - 36
        icon_cy = ia[3] + 38
        icon_size = 46
        icon_color = campaign_color

        if icon_type == "heart":
            _draw_heart(draw, icon_cx, icon_cy, icon_size, icon_color)
        else:
            _draw_ribbon(draw, icon_cx, icon_cy, icon_size, icon_color)

        # Segundo ícone menor no canto esquerdo espelhado
        _draw_heart(draw, pad + 22, icon_cy, 30, icon_color)

        # ── Frase do participante ─────────────────────────────────────────
        phrase_x = W // 2
        phrase_y_start = ia[3] + 20
        phrase_max_w = W - 2 * pad - icon_size - 20

        # Envolve em aspas
        display_phrase = f'"{phrase}"' if phrase else ""
        lines = _wrap_text(display_phrase, font_phrase, phrase_max_w, draw)
        line_h = 24
        for i, line in enumerate(lines[:3]):  # max 3 linhas
            draw.text((phrase_x, phrase_y_start + i * line_h), line,
                      font=font_phrase, fill=(40, 40, 40), anchor="mm")

        # Nome do participante
        if participant_name:
            name_y = phrase_y_start + len(lines[:3]) * line_h + 8
            draw.text((phrase_x, name_y), f"— {participant_name}",
                      font=font_name, fill=(130, 130, 130), anchor="mm")

        # ── Rodapé: logo UERN | LAR ──────────────────────────────────────
        footer_top = H - 78
        # Linha separadora do rodapé
        draw.line([(pad, footer_top), (W - pad, footer_top)], fill=(220, 220, 220), width=1)

        # Fundo suave no rodapé
        draw.rectangle([(0, footer_top + 1), (W, H)], fill=(250, 250, 252))

        # "UERN" em bold
        uern_x = pad + 10
        uern_y = footer_top + 14
        draw.text((uern_x, uern_y), "UERN", font=font_brand_bold, fill=(30, 30, 80))

        # Separador vertical
        sep_x = uern_x + 52
        draw.line([(sep_x, uern_y + 2), (sep_x, uern_y + 36)], fill=(200, 200, 220), width=1)

        # "LAR" em bold e subtítulo
        lar_x = sep_x + 10
        draw.text((lar_x, uern_y), "LAR", font=font_brand_bold, fill=(30, 30, 80))
        draw.text((lar_x, uern_y + 18), "Laboratório de", font=font_brand, fill=(100, 100, 130))
        draw.text((lar_x, uern_y + 29), "Aprendizagem Robótica", font=font_brand, fill=(100, 100, 130))

        # ID pequeno no canto inferior direito
        draw.text((W - pad - 4, H - 14), f"#{polaroid_id}",
                  font=font_tiny, fill=(190, 190, 200), anchor="ra")

        # ── Salva ─────────────────────────────────────────────────────────
        output_path = self.output_dir / f"polaroid_{polaroid_id}{suffix}.png"
        polaroid.save(str(output_path), "PNG")
        logger.info(f"Polaroid criado: {output_path}")
        return output_path
