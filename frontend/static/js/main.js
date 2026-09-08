/**
 * main.js — Ponto de entrada principal do frontend Kriart.
 * Gerencia estado global e inicialização do fluxo.
 */
import { showStep, setProgress, showError, showToast } from './ui.js';
import { API } from './api.js';
import { initCampaignStep } from './steps/campaign.js';
import { initChoiceEffects } from './effects.js';

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
  
  // Carregar polaroids reais e ativar parallax
  loadHeroPolaroids();

  setProgress(0, 0);

  // Liga as animações de "alimentar o sistema" (escolhas voando até o coletor)
  initChoiceEffects();

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


async function loadHeroPolaroids() {
  const container = document.getElementById('hero-polaroids-container');
  if (!container) return;
  
  let polaroids = [];
  try {
    const res = await fetch('/api/mural/polaroids');
    if (res.ok) {
      polaroids = await res.json();
    }
  } catch (e) {
    console.error('Erro ao carregar polaroids do mural', e);
  }
  
  // Fallback visual se não houver polaroids na base
  if (!polaroids || polaroids.length === 0) {
    polaroids = [
      { image_url: '/output/polaroids/polaroid_0D899BCE9E_color.png', phrase: 'Respeito gera conexões!', participant_name: 'Ana Clara' },
      { image_url: '/output/polaroids/polaroid_166E67F30F_color.png', phrase: 'Pequenas atitudes, grandes mudanças.', participant_name: 'João Pedro' },
      { image_url: '/output/polaroids/polaroid_1C38D687C0_color.png', phrase: 'Juntos, somos mais fortes!', participant_name: 'Turma 5ºA' },
      { image_url: '/output/polaroids/polaroid_1CE7DF9844_color.png', phrase: 'Cuidar da mente também é se cuidar.', participant_name: 'Maria Eduarda' },
      { image_url: '/output/polaroids/polaroid_2A3B8F297C_color.png', phrase: 'No trânsito, escolha a vida!', participant_name: 'Gabriel' },
      { image_url: '/output/polaroids/polaroid_2ADF9C99BD_color.png', phrase: 'Inclusão é respeito em cada ação.', participant_name: 'Lucas' }
    ];
  }

  // Pega os 6 últimos para preencher as 6 posições
  polaroids = polaroids.slice(-6);
  
  const baseClasses = ['hc-1', 'hc-2', 'hc-3', 'hc-4', 'hc-5', 'hc-6'];
  const baseRots = [-7, 5, -4, 6, -6, 5];
  
  container.innerHTML = '';
  
  polaroids.forEach((pol, i) => {
    if (i >= 6) return;
    const cls = baseClasses[i];
    const card = document.createElement('div');
    card.className = `hero-card ${cls}`;
    card.dataset.rot = baseRots[i];
    
    // Fallback svg invisível se a imagem não carregar
    card.innerHTML = `
      <div class="hero-card-img">
        <img src="${pol.image_url}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlMGUwZTAiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiLz48L3N2Zz4='" />
      </div>
      <p class="hero-card-caption">${pol.phrase}</p>
      <span class="hero-card-name">— ${pol.participant_name}</span>
    `;
    container.appendChild(card);
  });
  
  // Parallax de proximidade
  document.addEventListener('mousemove', (e) => {
    const cards = container.querySelectorAll('.hero-card');
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const cardX = rect.left + rect.width / 2;
      const cardY = rect.top + rect.height / 2;
      const dist = Math.hypot(e.clientX - cardX, e.clientY - cardY);
      
      const maxDist = 300; // Raio de ativação (pixels)
      const rot = parseFloat(card.dataset.rot || 0);
      
      if (dist > maxDist) {
        // Fora do raio, volta à rotação original
        card.style.transform = `rotate(${rot}deg) rotateX(0deg) rotateY(0deg) scale(1)`;
        return;
      }
      
      const factor = Math.pow(1 - (dist / maxDist), 1.5); // fator suave, 1 no centro, 0 na borda
      
      // Coordenadas relativas ao centro do card (normalizadas de -1 a 1)
      const localX = (e.clientX - cardX) / maxDist; 
      const localY = (e.clientY - cardY) / maxDist; 
      
      // Move NA DIREÇÃO do mouse
      const xOffset = localX * 30 * factor;
      const yOffset = localY * 30 * factor;
      
      // Gira PARA o mouse
      const rotX = localY * 20 * factor; 
      const rotY = -localX * 20 * factor;  
      
      card.style.transform = `translate(${xOffset}px, ${yOffset}px) rotate(${rot}deg) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${1 + 0.05 * factor})`;
      card.style.transition = 'transform 0.05s linear';
    });
  });
}
