/**
 * main.js — Ponto de entrada principal do frontend Faísca.
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

  // Carrega polaroids reais no hero
  loadHeroPolaroids();

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

/**
 * Carrega polaroids reais do mural para exibir no hero da página inicial.
 */
async function loadHeroPolaroids() {
  const container = document.getElementById('hero-polaroids-container');
  if (!container) return;

  try {
    const res = await fetch('/api/mural/polaroids');
    if (!res.ok) return;
    const polaroids = await res.json();

    // Pega até 6 polaroids aleatórios
    const shuffled = polaroids.sort(() => Math.random() - 0.5).slice(0, 6);
    if (shuffled.length === 0) return;

    const positions = [
      { cls: 'hc-1', style: 'top:170px; left:calc(50% - 550px); transform:rotate(-7deg); width:170px;' },
      { cls: 'hc-2', style: 'top:430px; left:calc(50% - 620px); transform:rotate(5deg); width:210px;' },
      { cls: 'hc-3', style: 'top:720px; left:calc(50% - 520px); transform:rotate(-4deg); width:230px;' },
      { cls: 'hc-4', style: 'top:150px; right:calc(50% - 540px); transform:rotate(6deg); width:190px;' },
      { cls: 'hc-5', style: 'top:460px; right:calc(50% - 630px); transform:rotate(-6deg); width:230px;' },
      { cls: 'hc-6', style: 'top:750px; right:calc(50% - 530px); transform:rotate(5deg); width:210px;' },
    ];

    shuffled.forEach((p, i) => {
      const pos = positions[i];
      const card = document.createElement('div');
      card.className = `hero-card ${pos.cls}`;
      card.style.cssText = pos.style;

      const imgUrl = p.image_url || p.polaroid_url || '';
      const phrase = p.phrase || '';
      const name = p.participant_name || 'Anônimo';

      card.innerHTML = `
        <div class="hero-card-img">
          <img src="${imgUrl}" alt="${phrase}" loading="lazy">
        </div>
        <p class="hero-card-caption">${phrase.length > 40 ? phrase.substring(0, 40) + '…' : phrase}</p>
        <span class="hero-card-name">— ${name} <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg></span>
      `;
      container.appendChild(card);
    });
  } catch (e) {
    // Silenciosamente falha — o hero funciona sem polaroids
    console.log('Polaroids do hero não disponíveis:', e.message);
  }
}

// Inicia a aplicação quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);
