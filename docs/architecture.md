# Arquitetura do Kriart

## Visão Geral

O Kriart é uma aplicação web cliente-servidor com pipeline de IA integrado. A arquitetura é composta por:

- **Frontend**: Interface web em HTML/CSS/JS puro
- **Backend**: API REST em FastAPI (Python)
- **IA Conversacional**: Ollama (local) com Phi-3 Mini
- **IA Generativa**: Stable Diffusion Forge com DreamShaper 8
- **Banco de Dados**: SQLite via SQLAlchemy
- **Armazenamento**: Sistema de arquivos local

---

## Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                        NAVEGADOR                             │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Step 1   │  │ Step 2   │  │ Step 3   │  │ Step 4   │   │
│  │Campanha  │→ │Mensagem  │→ │ Visual   │→ │ Geração  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                  ↓          │
│                                          ┌──────────┐       │
│                                          │ Step 5   │       │
│                                          │Resultado │       │
│                                          └──────────┘       │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/REST
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    FASTAPI BACKEND                           │
│                                                             │
│  /api/campaigns  /api/session  /api/generate  /api/polaroid │
│                                                             │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                     SERVICES                           │ │
│  │                                                        │ │
│  │  OllamaService  PromptService  SDService  ValidationSvc│ │
│  │  PolaroidService  QRCodeService  PrintService          │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────────────────────┐ │
│  │   SQLite (DB)    │  │   Sistema de Arquivos (output/)  │ │
│  └──────────────────┘  └──────────────────────────────────┘ │
└──────────┬─────────────────────────┬───────────────────────┘
           │                         │
           ▼                         ▼
┌─────────────────┐      ┌───────────────────────┐
│  OLLAMA (local) │      │  SD FORGE (local)      │
│  - phi3:mini    │      │  - DreamShaper 8       │
│  - llama3.2     │      │  - txt2img API         │
│  :11434         │      │  :7860                 │
└─────────────────┘      └───────────────────────┘
```

---

## Diagrama do Pipeline de IA

```
ENTRADA DO USUÁRIO
       │
       ▼
┌─────────────┐
│ Validação   │ ◄── Lista de termos proibidos
│ de Texto    │     (PROHIBITED_TERMS)
└──────┬──────┘
       │ [APROVADO]
       ▼
┌─────────────┐
│ Ollama      │ ◄── phi3:mini
│ Chat/       │     System prompt educativo
│ Estruturação│     Contexto da campanha
└──────┬──────┘
       │ {mensagem, frase, estilo, elementos, tom}
       ▼
┌─────────────┐
│ Ollama      │ ◄── llama3.2
│ Prompt      │     Gera prompt em inglês
│ Generator   │     para Stable Diffusion
└──────┬──────┘
       │ "prompt detalhado em inglês..."
       ▼
┌─────────────┐
│ Validação   │ ◄── Lista PROHIBITED_PROMPT_TERMS
│ de Prompt   │
└──────┬──────┘
       │ [APROVADO]
       ▼
┌─────────────┐
│ SD Forge    │ ◄── DreamShaper 8
│ txt2img     │     25 steps, CFG 7
│ API         │     512x512
└──────┬──────┘
       │ [imagem PNG base64]
       ▼
┌─────────────┐
│ Validação   │ ◄── Verificação de arquivo
│ de Imagem   │     (+ futura: NudeNet/CLIP)
└──────┬──────┘
       │ [APROVADO]
       ▼
┌─────────────┐
│ Composição  │ ◄── Pillow
│ Polaroid    │     Frame, texto, logos
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ QR Code     │ ◄── qrcode[pil]
│ Único       │     URL: /p/{polaroid_id}
└──────┬──────┘
       │
       ▼
  POLAROID FINAL
```

---

## Módulos do Sistema

| Módulo | Arquivo | Responsabilidade |
|---|---|---|
| Config | `backend/config.py` | Configurações via .env |
| Main | `backend/main.py` | FastAPI app, routers, static |
| OllamaService | `backend/services/ollama_service.py` | Chat e estruturação via Ollama |
| PromptService | `backend/services/prompt_service.py` | Geração de prompt SD |
| SDService | `backend/services/sd_service.py` | Geração de imagem via SD Forge |
| ValidationService | `backend/services/validation_service.py` | Validação multi-etapa |
| PolaroidService | `backend/services/polaroid_service.py` | Composição do Polaroid |
| QRCodeService | `backend/services/qrcode_service.py` | Geração de QR Codes |
| PrintService | `backend/services/print_service.py` | Impressão em lote |
| Database | `backend/db/database.py` | SQLite/SQLAlchemy |
| CRUD | `backend/db/crud.py` | Operações de banco |
