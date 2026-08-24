/**
 * generating.js — Step de geração com IA.
 */
import { showStep, setProgress, setGenStep, setGeneratingMessage, showGenError, hideGenError } from '../ui.js';
import { API } from '../api.js';

const MESSAGES = [
  'A IA está lendo sua mensagem...',
  'Criando o estilo visual perfeito...',
  'Gerando sua arte com Stable Diffusion...',
  'Quase lá! Montando seu Polaroid...',
  'Finalizando sua criação exclusiva...',
];

let messageInterval = null;

/**
 * Inicia o processo de geração de IA.
 * @param {object} state - Estado global da aplicação
 */
export async function startGeneration(state) {
  hideGenError();
  resetGenSteps();
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
    state.generatedImageUrl = imgResult.image_url;
    setGenStep(3, 'done');

    // Etapa 4: Criar Polaroid
    setGenStep(4, 'active');
    setGeneratingMessage('Montando seu Polaroid exclusivo...');
    const polaroidResult = await API.createPolaroid(state.sessionId, state.participantName);
    state.polaroidData = polaroidResult;
    setGenStep(4, 'done');

    stopMessageCycle();
    setGeneratingMessage('Sua arte está pronta!');

    await delay(800);

    // Vai para o resultado
    import('./result.js').then(m => m.showResult(state));
    showStep('step-result');
    setProgress(100, 5);

  } catch (e) {
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

function resetGenSteps() {
  for (let i = 1; i <= 4; i++) {
    const step = document.getElementById(`gen-step-${i}`);
    if (step) {
      step.classList.remove('active', 'done');
      const statusEl = step.querySelector('.gen-step-status');
      if (statusEl) {
        statusEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
      }
    }
  }
}

function startMessageCycle() {
  let i = 0;
  messageInterval = setInterval(() => {
    const msg = document.getElementById('generating-title');
    if (msg) msg.textContent = MESSAGES[i % MESSAGES.length];
    i++;
  }, 3000);
}

function stopMessageCycle() {
  if (messageInterval) {
    clearInterval(messageInterval);
    messageInterval = null;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
