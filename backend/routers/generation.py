"""Endpoints do pipeline de geracao de IA."""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional

from backend.services.ollama_service import OllamaService
from backend.services.prompt_service import PromptService
from backend.services.sd_service import StableDiffusionService
from backend.services.validation_service import ValidationService
from backend.routers.session import _sessions
from backend.models.session import FlowStep

router = APIRouter()

ollama = OllamaService()
prompt_svc = PromptService()
sd_svc = StableDiffusionService()
validation_svc = ValidationService()


class GenerationRequest(BaseModel):
    session_id: str


class ChatRequest(BaseModel):
    session_id: str
    user_input: str
    context: Optional[str] = None


@router.post("/chat")
async def chat_with_ai(request: ChatRequest):
    """Envia uma mensagem ao LLM e retorna a resposta do sistema."""
    # Valida a entrada do usuario
    input_validation = await validation_svc.validate_text_input(request.user_input)
    if not input_validation["safe"]:
        raise HTTPException(
            status_code=422,
            detail=f"Conteudo inadequado detectado: {input_validation['reason']}"
        )

    response = await ollama.chat(
        user_message=request.user_input,
        context=request.context,
    )
    return {"response": response}


@router.post("/prompt")
async def generate_visual_prompt(request: GenerationRequest):
    """Gera o prompt visual a partir dos dados da sessao."""
    if request.session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")

    session = _sessions[request.session_id]

    # Gera e valida o prompt visual
    visual_prompt = await prompt_svc.build_prompt(session)

    prompt_validation = await validation_svc.validate_prompt(visual_prompt)
    if not prompt_validation["safe"]:
        raise HTTPException(
            status_code=422,
            detail=f"Prompt invalido: {prompt_validation['reason']}"
        )

    session.generated_prompt = visual_prompt
    _sessions[request.session_id] = session

    return {"prompt": visual_prompt}


@router.post("/image")
async def generate_image(request: GenerationRequest):
    """Gera a imagem via Stable Diffusion usando o prompt da sessao."""
    if request.session_id not in _sessions:
        raise HTTPException(status_code=404, detail="Sessao nao encontrada")

    session = _sessions[request.session_id]

    if not session.generated_prompt:
        raise HTTPException(status_code=400, detail="Prompt nao gerado ainda")

    session.step = FlowStep.GENERATING
    _sessions[request.session_id] = session

    image_path = await sd_svc.generate(prompt=session.generated_prompt)

    # Valida a imagem gerada
    image_validation = await validation_svc.validate_image(image_path)
    if not image_validation["safe"]:
        session.step = FlowStep.MESSAGE_CREATION
        _sessions[request.session_id] = session
        raise HTTPException(
            status_code=422,
            detail=f"Imagem gerada inadequada: {image_validation['reason']}"
        )

    session.generated_image_path = image_path
    session.validation_passed = True
    session.step = FlowStep.RESULT
    _sessions[request.session_id] = session

    return {"image_path": image_path, "image_url": f"/output/{image_path}"}
