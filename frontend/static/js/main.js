/**
 * main.js — Ponto de entrada principal do frontend Kriart.
 * Gerencia estado global e inicialização do fluxo.
 */
import { showStep, setProgress, showError, showToast } from './ui.js';
import { API } from './api.js';
import { initCampaignStep } from './steps/campaign.js';

// Estado global da aplicação
const state = {
  sessionId: null,
  campaign: null,
  campaigns: [],
  userMessage: null,
  userPhrase: null,
  visualStyle: null,
  mood: null,
  participantName: null,
  generatedPrompt: null,
  generatedImagePath: null,
  generatedImageUrl: null,
  polaroidData: null,
};

/**
 * Inicializa a aplicação.
 */
async function init() {
  // Mostra tela de boas-vindas
  showStep('step-welcome');
  setProgress(0, 0);

  // Pré-inicializa sessão em background
  initSession();

  // Botão Começar
  const startBtn = document.getElementById('btn-start');
  if (startBtn) {
    startBtn.onclick = async () => {
      // Garante que a sessão foi criada
      if (!state.sessionId) {
        startBtn.disabled = true;
        startBtn.textContent = 'Iniciando...';
        try {
          await initSession();
        } catch (e) {
          showError('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
          startBtn.disabled = false;
          startBtn.textContent = 'Começar Agora';
          return;
        }
        startBtn.disabled = false;
        startBtn.textContent = 'Começar Agora';
      }

      showStep('step-campaign');
      setProgress(20, 1);
      await initCampaignStep(state);
    };
  }
}

/**
 * Inicializa a sessão com o backend.
 */
async function initSession() {
  if (state.sessionId) return state.sessionId;
  try {
    const session = await API.startSession();
    state.sessionId = session.session_id;
    console.log('Sessão iniciada:', state.sessionId);
    return state.sessionId;
  } catch (e) {
    console.error('Erro ao iniciar sessão:', e);
    throw e;
  }
}

// Inicia a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);
