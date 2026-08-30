import os
import math
import numpy as np
from pathlib import Path
from PIL import Image, ImageFilter, ImageDraw
import rembg

try:
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision
    MP_AVAILABLE = True
except ImportError:
    MP_AVAILABLE = False

_face_landmarker = None

def get_face_landmarker():
    global _face_landmarker
    if not MP_AVAILABLE:
        return None
        
    model_path = os.path.join(os.path.dirname(__file__), "..", "models", "face_landmarker.task")
    if not os.path.exists(model_path):
        # We assume it was downloaded, if not, skip
        return None
        
    if _face_landmarker is None:
        base_options = python.BaseOptions(model_asset_path=model_path)
        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=False,
            num_faces=1
        )
        _face_landmarker = vision.FaceLandmarker.create_from_options(options)
        
    return _face_landmarker

def generate_ar_spritesheet(image_path: str, output_path: str, frames: int = 8):
    """
    Reads the generated image, isolates the character, creates a breathing/floating
    animation loop (including a blinking effect if a face is detected), 
    and saves it as a horizontal sprite sheet for WebAR.
    """
    # 1. Load original image
    img = Image.open(image_path).convert("RGB")
    width, height = img.size
    
    # 2. Extract character using rembg
    img_np = np.array(img)
    subject_np = rembg.remove(img_np)
    subject = Image.fromarray(subject_np).convert("RGBA")
    
    # 3. Create a blinking version of the subject
    subject_closed = subject.copy()
    detector = get_face_landmarker()
    
    has_blink = False
    if detector:
        # Detect face landmarks on the original image
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=np.array(img))
        detection_result = detector.detect(mp_image)
        
        if detection_result.face_landmarks:
            has_blink = True
            landmarks = detection_result.face_landmarks[0]
            
            def get_pt(idx):
                return (int(landmarks[idx].x * width), int(landmarks[idx].y * height))
            
            draw = ImageDraw.Draw(subject_closed)
            
            # Eye outlines and skin sample points
            left_eye = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7]
            right_eye = [362, 398, 384, 385, 386, 387, 388, 466, 263, 249, 390, 373, 374, 380, 381, 382]
            left_skin_idx = 71
            right_skin_idx = 301
            
            for eye_indices, skin_idx, inner, outer, mid in [(left_eye, left_skin_idx, 133, 33, 145), (right_eye, right_skin_idx, 362, 263, 374)]:
                skin_pt = get_pt(skin_idx)
                skin_pt = (max(0, min(width-1, skin_pt[0])), max(0, min(height-1, skin_pt[1])))
                skin_color = img.getpixel(skin_pt)
                
                # Fill the eye polygon with the skin color
                eye_pts = [get_pt(i) for i in eye_indices]
                draw.polygon(eye_pts, fill=skin_color)
                
                # Draw the eyelash curve `‿`
                p1 = get_pt(outer)
                p2 = get_pt(inner)
                pmid = get_pt(mid)
                
                # Draw slightly thicker line for closed eyelid
                draw.line([p1, pmid, p2], fill=(40, 30, 30), width=max(2, width//200), joint="curve")

    # 4. Create background
    # O usuário quer o fundo cortado! Então vamos criar um fundo 100% transparente
    clean_bg = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    
    # 5. Generate frames for the Sprite Sheet
    spritesheet = Image.new("RGBA", (width * frames, height), (0, 0, 0, 0))
    
    for i in range(frames):
        phase = (i / frames) * 2 * math.pi
        
        # Breathing effect
        scale_y = 1.0 + (math.sin(phase) * 0.015)
        scale_x = 1.0 - (math.sin(phase) * 0.005)
        
        # Swaying effect
        k = math.sin(phase - math.pi/2) * 0.04 
        
        # Select blinking frame
        if has_blink and i in [4, 5]:
            current_subject = subject_closed
        else:
            current_subject = subject
        
        new_w = int(width * scale_x)
        new_h = int(height * scale_y)
        warped_subject = current_subject.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        shear_matrix = (1, -k, new_h * k, 0, 1, 0)
        warped_subject = warped_subject.transform(
            (new_w, new_h), 
            Image.Transform.AFFINE, 
            shear_matrix, 
            resample=Image.Resampling.BICUBIC
        )
        
        paste_x = (width - new_w) // 2
        paste_y = height - new_h
        
        frame = clean_bg.copy()
        frame.paste(warped_subject, (paste_x, paste_y), warped_subject)
        
        spritesheet.paste(frame, (i * width, 0), frame)
    
    # 6. Save the spritesheet as PNG for transparency
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    # Ensure extension is .png
    if output_path.lower().endswith(".jpg") or output_path.lower().endswith(".jpeg"):
        output_path = output_path.rsplit(".", 1)[0] + ".png"
        
    spritesheet.save(output_path, "PNG")
    
    return output_path

