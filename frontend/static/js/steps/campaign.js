/**
 * campaign.js — Step de seleção de campanha.
 */
import { showStep, setProgress, showError, animateIn } from '../ui.js';
import { API } from '../api.js';

let selectedCampaign = null;

/** Mapa de ícones SVG por slug (campo 'icone' no JSON da campanha) */
const CAMPAIGN_ICONS = {
  handshake: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/>
  </svg>`,
  rainbow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 17a10 10 0 0 0-20 0"/>
    <path d="M6 17a6 6 0 0 1 12 0"/>
    <path d="M10 17a2 2 0 0 1 4 0"/>
  </svg>`,
  leaf: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 22V12"/>
    <path d="M5 12a7 7 0 0 0 7-7 7 7 0 0 0 7 7H5z"/>
  </svg>`,
  setembro_amarelo: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
  </svg>`,
  default: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>`,
};

/**
 * Inicializa o step de campanha.
 * @param {object} state - Estado global da aplicação
 */
export async function initCampaignStep(state) {
  selectedCampaign = null;
  const confirmBtn = document.getElementById('btn-confirm-campaign');
  if (confirmBtn) confirmBtn.disabled = true;

  await loadCampaigns(state);

  // Botão confirmar
  if (confirmBtn) {
    confirmBtn.onclick = () => {
      if (!selectedCampaign) return;
      state.campaign = selectedCampaign;

      // Atualiza guia do próximo step
      const guiaText = document.getElementById('campaign-guia-text');
      if (guiaText && selectedCampaign.perguntas_guia?.length > 0) {
        guiaText.textContent = selectedCampaign.perguntas_guia[0];
      }

      // Atualiza placeholder dinamicamente
      const inputMessage = document.getElementById('input-message');
      if (inputMessage) {
        const placeholders = {
          'meio_ambiente': 'Ex: Crianças plantando árvores e cuidando de animais em uma floresta...',
          'bullying': 'Ex: Um grupo de alunos sorrindo e de mãos dadas no pátio da escola...',
          'inclusao': 'Ex: Várias crianças diferentes brincando juntas e felizes sob um arco-íris...',
          'setembro_amarelo': 'Ex: Duas pessoas dando um abraço caloroso sob uma luz amarela e suave...'
        };
        inputMessage.placeholder = placeholders[selectedCampaign.id] || 'Ex: Crianças brincando felizes em um parque ensolarado...';
      }

      import('./message.js').then(m => m.initMessageStep(state));
      showStep('step-message');
      setProgress(40, 2);
    };
  }

  // Botão voltar
  const backBtn = document.getElementById('btn-back-welcome');
  if (backBtn) {
    backBtn.onclick = () => {
      showStep('step-welcome');
      setProgress(0, 0);
    };
  }
}

async function loadCampaigns(state) {
  const grid = document.getElementById('campaigns-grid');
  if (!grid) return;

  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:rgba(255,255,255,0.5);padding:20px">Carregando campanhas...</div>';

  try {
    const campaigns = await API.listCampaigns();
    state.campaigns = campaigns;
    renderCampaignCards(campaigns);
  } catch (e) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:#FF8A80;padding:20px">Erro ao carregar campanhas. Verifique o backend.</div>';
    showError('Não foi possível carregar as campanhas.');
  }
}

function renderCampaignCards(campaigns) {
  const grid = document.getElementById('campaigns-grid');
  if (!grid) return;

  grid.innerHTML = '';

  campaigns.forEach(campaign => {
    const iconSvg = CAMPAIGN_ICONS[campaign.icone] || CAMPAIGN_ICONS.default;

    const card = document.createElement('div');
    card.className = 'campaign-card';
    card.dataset.id = campaign.id;
    card.innerHTML = `
      <span class="campaign-icon" style="color:${campaign.cor_tema}">${iconSvg}</span>
      <div class="campaign-name">${campaign.nome}</div>
      <div class="campaign-faixa">${campaign.faixa_etaria} anos</div>
      <div class="campaign-card-color-bar" style="background: ${campaign.cor_tema}"></div>
    `;

    card.addEventListener('click', () => {
      // Deseleciona os outros
      document.querySelectorAll('.campaign-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedCampaign = campaign;

      const confirmBtn = document.getElementById('btn-confirm-campaign');
      if (confirmBtn) confirmBtn.disabled = false;

      animateIn(card);
    });

    grid.appendChild(card);
  });
}

