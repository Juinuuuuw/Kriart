import os
import math
from pathlib import Path
from PIL import Image, ImageFilter
import rembg
import numpy as np

def generate_ar_spritesheet(image_path: str, output_path: str, frames: int = 8):
    """
    Reads the generated image, isolates the character, creates a breathing/floating
    animation loop, and saves it as a horizontal sprite sheet for WebAR.
    """
    # 1. Load original image
    img = Image.open(image_path).convert("RGB")
    width, height = img.size
    
    # 2. Extract character using rembg
    img_np = np.array(img)
    subject_np = rembg.remove(img_np)
    subject = Image.fromarray(subject_np).convert("RGBA")
    
    # 3. Create background (O usuário não quer borrado)
    # Vamos usar a imagem original como fundo (ou podemos aplicar outro efeito depois).
    # Como o personagem isolado vai ser colado por cima, o fundo fica sendo a própria imagem.
    clean_bg = img.copy()
    
    # 4. Generate frames for the Sprite Sheet
    # The sprite sheet will be a wide image: width * frames
    spritesheet = Image.new("RGBA", (width * frames, height))
    
    for i in range(frames):
        # Calculate animation phase (0 to 2*PI)
        phase = (i / frames) * 2 * math.pi
        
        # Breathing effect: Sine wave
        # Scale Y by slightly stretching/squashing
        scale_y = 1.0 + (math.sin(phase) * 0.015)
        scale_x = 1.0 - (math.sin(phase) * 0.005)
        
        # Swaying effect (Pêndulo): Shear on X axis
        # Queremos que os pés fiquem parados (y=height) e a cabeça balance (y=0)
        # x' = x + (height - y) * k
        k = math.sin(phase - math.pi/2) * 0.04 # Atrasado em relação à respiração
        
        # Resize subject based on scale
        new_w = int(width * scale_x)
        new_h = int(height * scale_y)
        warped_subject = subject.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        # Apply affine shear to make it sway side to side
        # Affine matrix: (a, b, c, d, e, f) -> x' = ax + by + c, y' = dx + ey + f
        # Para shear em X mantendo a base fixa: a=1, b=-k, c=new_h*k, d=0, e=1, f=0
        shear_matrix = (1, -k, new_h * k, 0, 1, 0)
        warped_subject = warped_subject.transform(
            (new_w, new_h), 
            Image.Transform.AFFINE, 
            shear_matrix, 
            resample=Image.Resampling.BICUBIC
        )
        
        # Calculate paste position to keep it centered horizontally
        paste_x = (width - new_w) // 2
        paste_y = height - new_h  # Alinha os pés na parte de baixo
        
        # Create this specific frame
        frame = clean_bg.copy().convert("RGBA")
        frame.paste(warped_subject, (paste_x, paste_y), warped_subject)
        
        # Paste this frame into the spritesheet
        spritesheet.paste(frame, (i * width, 0))
    
    # 5. Save the spritesheet
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    # Save as JPEG for better performance on mobile WebAR
    spritesheet.convert("RGB").save(output_path, "JPEG", quality=85)
    
    return output_path
