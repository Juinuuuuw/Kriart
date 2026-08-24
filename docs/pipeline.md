# Pipeline de IA do Kriart

## Visão Geral

O pipeline de IA do Kriart é composto por 6 etapas encadeadas, com validação em múltiplos pontos para garantir a segurança e adequação do conteúdo gerado para crianças.

---

## Etapa 1: Entrada e Validação de Texto

**Componente**: `ValidationService.validate_text_input()`  
**Arquivo**: `backend/services/validation_service.py`

### Processo:
1. Usuário insere mensagem e frase no frontend
2. Dados são enviados para `POST /api/generate/chat`
3. O `ValidationService` verifica o texto contra a lista `PROHIBITED_TERMS`
4. Se seguro, o texto é encaminhado ao Ollama

### Regras de Validação:
- Lista de ~30 termos proibidos (violência, drogas, conteúdo adulto, ódio)
- Comprimento mínimo: 3 caracteres
- Comprimento máximo: 500 caracteres
- **Se reprovado**: HTTP 422 com mensagem amigável ao usuário

---

## Etapa 2: Estruturação via Ollama / Phi-3 Mini

**Componente**: `OllamaService.chat()` e `OllamaService.structure_data()`  
**Arquivo**: `backend/services/ollama_service.py`  
**Modelo**: `phi3:mini` (via Ollama local, porta 11434)

### Processo:
1. Recebe a mensagem do usuário + contexto da campanha
2. O sistema envia um prompt estruturado ao Phi-3 Mini
3. O modelo retorna JSON com:
   - `mensagem_principal`: essência da mensagem
   - `frase`: versão condensada (máx. 15 palavras)
   - `estilo_visual`: estilo artístico escolhido
   - `elementos_visuais`: lista de elementos para a imagem
   - `tom`: tom emocional (alegre, esperançoso, etc.)
4. Fallback: se o JSON não for parseable, usa os dados brutos do usuário

### System Prompt:
```
Você é um assistente criativo do projeto Kriart da UERN...
Sempre responda em português brasileiro, de forma simples e acolhedora.
```

---

## Etapa 3: Geração de Prompt Visual via LLaMA 3.2

**Componente**: `PromptService.build_prompt()`  
**Arquivo**: `backend/services/prompt_service.py`  
**Modelo**: `llama3.2` (via Ollama local)

### Processo:
1. Recebe os dados estruturados da sessão
2. Envia contexto ao LLaMA 3.2 com instrução para gerar prompt SD
3. O modelo gera um prompt detalhado **em inglês** (melhor performance no SD)
4. Sufixo de qualidade é anexado automaticamente:
   ```
   , educational illustration, child-friendly, vibrant colors,
   high quality, detailed, safe for children, inspiring, positive message
   ```
5. **Fallback**: se o Ollama não estiver disponível, usa `_fallback_prompt()`

### Exemplo de Prompt Gerado:
```
watercolor illustration of diverse children holding hands in a school garden,
smiling faces, rainbow colors, friendship and unity theme, warm lighting,
detailed background with flowers and trees, educational campaign art,
child-friendly, vibrant colors, high quality, safe for children
```

---

## Etapa 4: Geração de Imagem via Stable Diffusion Forge

**Componente**: `StableDiffusionService.generate()`  
**Arquivo**: `backend/services/sd_service.py`  
**Modelo**: DreamShaper 8  
**Endpoint**: `POST {SD_FORGE_URL}/sdapi/v1/txt2img`

### Parâmetros de Geração:
| Parâmetro | Valor Padrão |
|---|---|
| Steps | 25 |
| CFG Scale | 7.0 |
| Width | 512 |
| Height | 512 |
| Sampler | DPM++ 2M Karras |
| Negative Prompt | nsfw, violence, blood, weapons... |

### Processo:
1. Envia payload JSON ao SD Forge
2. Recebe imagem em base64
3. Decodifica e salva como PNG em `output/polaroids/img_{id}.png`
4. **Timeout**: 300 segundos (geração pode ser lenta)

---

## Etapa 5: Validação da Imagem Gerada

**Componente**: `ValidationService.validate_image()`  
**Arquivo**: `backend/services/validation_service.py`

### Processo Atual:
1. Verifica se o arquivo existe
2. Verifica se o tamanho é > 1KB (arquivo válido)
3. **Se reprovada**: sessão volta ao step de mensagem

### Expansão Futura:
- Integração com **NudeNet** para detecção de conteúdo adulto
- Integração com **CLIP** para verificação semântica de conteúdo
- Score de adequação infantil

---

## Etapa 6: Composição do Polaroid

**Componente**: `PolaroidService.create_polaroid()`  
**Arquivo**: `backend/services/polaroid_service.py`  
**Biblioteca**: Pillow (PIL)

### Elementos do Polaroid (600x720px):
1. **Fundo branco** com borda sutil cinza
2. **Imagem gerada** (480x420px, posição 60,60)
3. **Frase do participante** centralizada (fonte 22px)
4. **Nome do participante** (opcional, fonte 14px)
5. **Identidade visual**: UERN / LAR / GO!RN (canto inferior esquerdo)
6. **QR Code** (80x80px, canto inferior direito)
7. **ID do Polaroid** no rodapé central

### QR Code:
- Gerado via `QRCodeService.generate()`
- Biblioteca: `qrcode[pil]`
- URL: `{BASE_URL}/p/{polaroid_id}`
- Error correction: HIGH (30% de recuperação)

---

## Fluxo de Erros e Fallbacks

```
Ollama indisponível → Fallback prompt manual
SD Forge indisponível → HTTP 500 com mensagem de erro
Imagem inválida → Volta ao step de mensagem (pode tentar novamente)
Prompt inválido → HTTP 422 com mensagem amigável
Texto proibido → HTTP 422 com instrução ao usuário
```

---

## Sistema de Impressão

**Componente**: `PrintService`  
**Lote**: 6 Polaroids por folha A4

### Layout da Folha A4 (300 DPI = 2480x3508px):
```
┌──────────────────────────┐
│  ┌────────┐  ┌────────┐  │
│  │Pol. 1  │  │Pol. 2  │  │
│  └────────┘  └────────┘  │
│  ┌────────┐  ┌────────┐  │
│  │Pol. 3  │  │Pol. 4  │  │
│  └────────┘  └────────┘  │
│  ┌────────┐  ┌────────┐  │
│  │Pol. 5  │  │Pol. 6  │  │
│  └────────┘  └────────┘  │
└──────────────────────────┘
```
