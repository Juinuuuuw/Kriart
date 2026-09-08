# ⚡ Faísca — Framework de Campanhas Educativas com IA

> Projeto desenvolvido pela **UERN (Universidade do Estado do Rio Grande do Norte)** em parceria com o **LAR (Laboratório de Aprendizagem Robótica)**.

---

## 💡 O que é o Faísca?

O **Faísca** é um framework interativo para criação de campanhas educativas personalizadas com inteligência artificial. Visitantes (alunos, professores, familiares) interagem com um sistema de IA para:

1. **Escolher uma campanha** (Bullying, Drogas, Meio Ambiente, Inclusão, Saúde, Educação)
2. **Criar uma mensagem personalizada** com ajuda do Phi-3 Mini via Ollama
3. **Gerar uma arte única** com Stable Diffusion Forge + DreamShaper 8
4. **Receber um Polaroid digital** com QR Code exclusivo
5. **Imprimir** em lotes de 6 participantes

---

## 🛠️ Stack Tecnológica

| Componente | Tecnologia |
|---|---|  ssh -p 443 -R0:127.0.0.1:8000 a.pinggy.io
| Backend | Python 3.11+ / FastAPI |
| IA Conversacional | Ollama + Phi-3 Mini |
| Geração de Prompt | Ollama + LLaMA 3.2 |
| Geração de Imagem | Stable Diffusion Forge + DreamShaper 8 |
| Banco de Dados | SQLite + SQLAlchemy |
| Frontend | HTML5 + CSS3 + JavaScript (Vanilla) |
| Composição de Imagem | Pillow (PIL) |
| QR Code | qrcode[pil] |

---

## ⚙️ Como Instalar

### Requisitos
- Python 3.11+
- [Ollama](https://ollama.ai) instalado e rodando
- [Stable Diffusion Forge](https://github.com/lllyasviel/stable-diffusion-webui-forge) instalado
- Git

### 1. Clone o repositório
```bash
git clone <url-do-repositorio>
cd Faísca
```

### 2. Crie e ative o ambiente virtual
```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/Mac:
source .venv/bin/activate
```

### 3. Instale as dependências
```bash
pip install -r requirements.txt
```

### 4. Configure o ambiente
```bash
cp .env.example .env
# Edite o .env com suas configurações
```

### 5. Baixe os modelos Ollama
```bash
ollama pull phi3:mini
ollama pull llama3.2
```

### 6. Configure o Stable Diffusion Forge
- Instale o modelo DreamShaper 8
- Inicie o Forge com: `--api --listen`
- URL padrão: `http://localhost:7860`

---

## ▶️ Como Rodar

```bash
python run.py
```

Acesse: `http://localhost:8000`

---

## 📁 Estrutura de Pastas

```
Faisca/
├── backend/          # API FastAPI (Python)
│   ├── models/       # Modelos de dados (Pydantic)
│   ├── routers/      # Endpoints da API
│   ├── services/     # Lógica de negócio e integrações
│   └── db/           # Banco de dados (SQLite)
├── campaigns/        # Configurações das campanhas (JSON)
├── frontend/         # Interface web
│   ├── static/css/   # Estilos
│   ├── static/js/    # JavaScript modular
│   └── static/assets/# Recursos estáticos
├── assets/           # Assets do projeto (templates, fontes)
├── output/           # Arquivos gerados (gitignored)
└── docs/             # Documentação técnica
```

---

## ➕ Como Adicionar Novas Campanhas

1. Crie um arquivo JSON em `campaigns/nova_campanha.json`
2. Siga a estrutura dos arquivos existentes:
```json
{
  "id": "nova_campanha",
  "nome": "Nome da Campanha",
  "objetivo": "Objetivo educativo",
  "descricao": "Descrição para o usuário",
  "faixa_etaria": "8-14",
  "estilos": ["ilustracao", "aquarela"],
  "elementos": ["elemento1", "elemento2"],
  "cor_tema": "#FF5722",
  "icone": "⭐",
  "perguntas_guia": ["Pergunta 1?", "Pergunta 2?"],
  "sd_style_keywords": ["keyword1", "keyword2"]
}
```
3. A campanha será carregada automaticamente na próxima inicialização.

---

## 🧠 Como Funciona o Pipeline de IA

```
Usuário   [Validação de Texto]   Ollama/Phi-3 Mini
                                         
    (input seguro)            (estruturação da mensagem)
                                         
                          Ollama/LLaMA 3.2
                                         
                          (geração de prompt visual em inglês)
                                         
                          [Validação do Prompt]
                                         
                          SD Forge + DreamShaper 8
                                         
                          (geração da imagem)
                                         
                          [Validação da Imagem]
                                         
                          Composição do Polaroid (PIL)
                                         
                          QR Code único   Polaroid final
```

---

## 📜 Licença

Projeto UERN / LAR. Todos os direitos reservados.
