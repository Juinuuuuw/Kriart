# Guia de Configuração do Kriart

## Requisitos de Sistema

| Componente | Mínimo | Recomendado |
|---|---|---|
| OS | Windows 10 / Ubuntu 20.04 | Windows 11 / Ubuntu 22.04 |
| CPU | 4 cores | 8+ cores |
| RAM | 8 GB | 16+ GB |
| GPU | - | NVIDIA 6GB+ VRAM |
| Python | 3.11 | 3.11+ |
| Disco | 10 GB livre | 20+ GB livre |

---

## 1. Instalação do Ollama

### Windows:
```bash
# Baixe o instalador em: https://ollama.ai
# Ou via winget:
winget install Ollama.Ollama
```

### Linux/Mac:
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

### Baixar os modelos necessários:
```bash
ollama pull phi3:mini
ollama pull llama3.2

# Verificar se estão disponíveis:
ollama list
```

### Verificar se o Ollama está rodando:
```bash
curl http://localhost:11434/api/tags
```

---

## 2. Configuração do Stable Diffusion Forge

### Instalação:
1. Clone o repositório: `https://github.com/lllyasviel/stable-diffusion-webui-forge`
2. Execute `webui-user.bat` (Windows) ou `webui.sh` (Linux)

### Modelo DreamShaper 8:
1. Baixe em: https://civitai.com/models/4384/dreamshaper
2. Coloque em: `stable-diffusion-webui-forge/models/Stable-diffusion/`
3. Nome do arquivo: `dreamshaper_8.safetensors`

### Iniciar o Forge com API habilitada:
```bash
# Windows (edite webui-user.bat):
set COMMANDLINE_ARGS=--api --listen

# Linux:
bash webui.sh --api --listen
```

### Verificar se o Forge está rodando:
```bash
curl http://localhost:7860/sdapi/v1/sd-models
```

---

## 3. Configuração do Projeto Python

### Clone e ambiente virtual:
```bash
git clone <url>
cd Kriart

# Criar ambiente virtual:
python -m venv .venv

# Ativar (Windows):
.venv\Scripts\activate

# Ativar (Linux/Mac):
source .venv/bin/activate
```

### Instalar dependências:
```bash
pip install -r requirements.txt
```

---

## 4. Configuração do .env

```bash
cp .env.example .env
```

Edite o `.env` conforme seu ambiente:

```env
# Se o Ollama estiver em outro host:
OLLAMA_BASE_URL=http://192.168.1.100:11434

# Se o SD Forge estiver em outro host:
SD_FORGE_URL=http://192.168.1.100:7860

# Para eventos: coloque o IP da máquina
BASE_URL=http://192.168.1.50:8000

# Para ativar impressão:
PRINT_ENABLED=true
PRINTER_NAME=Nome_Da_Impressora
```

---

## 5. Como Rodar o Projeto

```bash
# Certifique-se que o .venv está ativado
python run.py
```

Acesse:
- **Interface**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs
- **Health check**: http://localhost:8000/health

---

## 6. Assets Necessários

### Fontes (assets/fonts/):
- Recomendadas: **Poppins** ou **Inter** (Google Fonts)
- Baixe as versões .ttf e coloque em `assets/fonts/`

### Templates do Polaroid (assets/polaroid_template/):
- `frame.png`: Frame decorativo do Polaroid (600x720px)
- `uern_logo.png`: Logo da UERN (transparente)
- `lar_logo.png`: Logo do LAR (transparente)

---

## 7. Troubleshooting

### Ollama não conecta:
```bash
# Verifique se o serviço está rodando:
ollama serve

# Teste a conexão:
curl http://localhost:11434/api/tags
```

### SD Forge não conecta:
```bash
# Verifique se foi iniciado com --api
# Verifique se está escutando na porta 7860
curl http://localhost:7860/sdapi/v1/progress
```

### Erro de permissão nos arquivos de output:
```bash
# Windows - execute como administrador
# Linux:
chmod 755 output/polaroids output/prints output/qrcodes
```

### ImportError no startup:
```bash
# Reinstale as dependências:
pip install -r requirements.txt --force-reinstall
```

### Erro de banco de dados:
```bash
# Delete o banco e deixe recriar:
del kriart.db  # Windows
rm kriart.db   # Linux
python run.py
```

### Imagem não gerada / timeout:
- Aumente o `SD_STEPS` para menos (ex: 15) para acelerar
- Verifique a GPU disponível no SD Forge
- Verifique se o modelo DreamShaper 8 está carregado

---

## 8. Estrutura de Rede para Eventos

```
┌──────────────────────────────────────┐
│  Máquina Principal (Servidor)         │
│  - Python Kriart :8000               │
│  - Ollama :11434                     │
│  - SD Forge :7860                    │
│  IP: 192.168.1.50                    │
└─────────────────┬────────────────────┘
                  │ WiFi / LAN
     ┌────────────┼────────────┐
     ▼            ▼            ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│Tablet 1 │  │Tablet 2 │  │Tablet 3 │
│Chrome   │  │Chrome   │  │Chrome   │
│:8000    │  │:8000    │  │:8000    │
└─────────┘  └─────────┘  └─────────┘
```

Configure no `.env`: `BASE_URL=http://192.168.1.50:8000`
