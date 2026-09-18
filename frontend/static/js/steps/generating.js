/**
 * generating.js — Step de geração com IA.
 * Animação: robô pintando em loop com frames 092-113 e 114-120.
 */
import { showStep, setProgress, setGenStep, setGeneratingMessage, showGenError, hideGenError } from '../ui.js';
import { API } from '../api.js';

// ─── Configuração da animação de frames ──────────────────────────────────────
const FRAME_BASE   = '/static/img/robot_painting/frame_';
const SEQ_A_START  = 92;   // pintura 1: tela verde
const SEQ_A_END    = 113;
const SEQ_B_START  = 114;  // pintura 2: noite estrelada
const SEQ_B_END    = 120;
const FRAME_DELAY  = 80;   // ms por frame (~12 fps)

// ─── Mensagens rotativas ──────────────────────────────────────────────────────
const MESSAGES = [
  'Interpretando sua mensagem com IA...',
  'Criando a composição visual...',
  'Gerando sua arte com Stable Diffusion...',
  'Quase lá! Montando seu Polaroid...',
  'Finalizando sua criação exclusiva...',
];

// Intervalos
let frameInterval   = null;
let messageInterval = null;

// ─── Estado interno da animação ───────────────────────────────────────────────
let currentFrame = SEQ_A_START;
let inSeqA       = true;

/**
 * Inicia o processo de geração de IA.
 * @param {object} state - Estado global da aplicação
 */
export async function startGeneration(state) {
  hideGenError();
  startRobotAnimation();
  startMessageCycle();

  try {
    // Etapa 1: Gerar prompt visual
    setGenStep(1, 'active');
    setGeneratingMessage('Processando sua mensagem com IA...');
    const promptResult = await API.generatePrompt(state.sessionId);
    state.generatedPrompt = promptResult.prompt;
    setGenStep(1, 'done');

    // Etapa 2: Prompt OK (processado internamente)
    setGenStep(2, 'active');
    setGeneratingMessage('Preparando o prompt visual...');
    await delay(800);
    setGenStep(2, 'done');

    // Etapa 3: Gerar imagem
    setGenStep(3, 'active');
    setGeneratingMessage('Gerando imagem com Stable Diffusion... (pode demorar até 1 minuto)');
    const imgResult = await API.generateImage(state.sessionId);
    state.generatedImagePath = imgResult.image_path;
    state.generatedImageUrl  = imgResult.image_url;
    setGenStep(3, 'done');

    // Etapa 4: Criar Polaroid
    setGenStep(4, 'active');
    setGeneratingMessage('Montando seu Polaroid exclusivo...');
    const polaroidResult = await API.createPolaroid(state.sessionId, state.participantName);
    state.polaroidData = polaroidResult;
    setGenStep(4, 'done');

    stopRobotAnimation();
    stopMessageCycle();
    setGeneratingMessage('Sua arte está pronta!');
    updateSubtitle('Sua arte está pronta! 🎨');

    await delay(800);

    // Vai para o resultado
    import('./result.js').then(m => m.showResult(state));
    showStep('step-result');
    setProgress(100, 5);

  } catch (e) {
    stopRobotAnimation();
    stopMessageCycle();
    const errorMsg = e.message || 'Ocorreu um erro inesperado.';
    showGenError(`Erro: ${errorMsg}`);

    // Setup do botão retry
    const retryBtn = document.getElementById('btn-retry');
    if (retryBtn) {
      retryBtn.onclick = () => startGeneration(state);
    }
  }
}

// ─── Animação do robô ─────────────────────────────────────────────────────────

function startRobotAnimation() {
  currentFrame = SEQ_A_START;
  inSeqA       = true;

  // Pré-carrega todos os frames para evitar flicker
  preloadFrames();

  renderFrame(currentFrame);

  frameInterval = setInterval(() => {
    // Avança frame
    currentFrame++;

    if (inSeqA && currentFrame > SEQ_A_END) {
      // Transiciona para sequência B
      inSeqA       = false;
      currentFrame = SEQ_B_START;
    } else if (!inSeqA && currentFrame > SEQ_B_END) {
      // Volta ao início da sequência A (loop)
      inSeqA       = true;
      currentFrame = SEQ_A_START;
    }

    renderFrame(currentFrame);
  }, FRAME_DELAY);
}

function stopRobotAnimation() {
  if (frameInterval) {
    clearInterval(frameInterval);
    frameInterval = null;
  }
}

function renderFrame(num) {
  const img = document.getElementById('gen-robot-frame');
  if (!img) return;
  const padded = String(num).padStart(3, '0');
  img.src = `${FRAME_BASE}${padded}.png`;
}

function preloadFrames() {
  for (let i = SEQ_A_START; i <= SEQ_B_END; i++) {
    const padded = String(i).padStart(3, '0');
    const pre = new Image();
    pre.src = `${FRAME_BASE}${padded}.png`;
  }
}

// ─── Mensagens rotativas ──────────────────────────────────────────────────────

function startMessageCycle() {
  let i = 0;
  // Atualiza título principal
  const title = document.getElementById('generating-title');
  if (title) title.textContent = MESSAGES[0];

  messageInterval = setInterval(() => {
    i = (i + 1) % MESSAGES.length;
    const t = document.getElementById('generating-title');
    if (t) t.textContent = MESSAGES[i];
  }, 4000);
}

function stopMessageCycle() {
  if (messageInterval) {
    clearInterval(messageInterval);
    messageInterval = null;
  }
}

function updateSubtitle(text) {
  const sub = document.getElementById('generating-subtitle');
  if (!sub) return;
  sub.style.opacity = '0';
  setTimeout(() => {
    sub.textContent  = text;
    sub.style.opacity = '1';
  }, 400);
}

// ─── Utilitários ─────────────────────────────────────────────────────────────

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
