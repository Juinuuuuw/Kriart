/**
 * mural.js — Lógica do Mural de Contribuições Faísca
 *
 * Responsabilidades:
 *  - Carregar campanhas e montar tabs + boards
 *  - Buscar polaroids existentes e renderizá-los
 *  - Conectar ao SSE e animar chegada de novos polaroids
 *  - Confete, toast, relógio e estatísticas ao vivo
 */

/* ============================================================
   DADOS DAS CAMPANHAS (espelhando os 4 JSONs)
   ============================================================ */
const CAMPAIGNS = [
  {
    id: 'bullying',
    nome: 'Combate ao Bullying',
    cor: '#4CAF50',
    svgIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>`,
  },
  {
    id: 'inclusao',
    nome: 'Inclusão e Respeito',
    cor: '#9C27B0',
    svgIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 12h8"/>
      <path d="M12 8v8"/>
    </svg>`,
  },
  {
    id: 'meio_ambiente',
    nome: 'Meio Ambiente',
    cor: '#2E7D32',
    svgIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22V12"/>
      <path d="M5 12a7 7 0 0 0 7-7 7 7 0 0 0 7 7H5z"/>
    </svg>`,
  },
  {
    id: 'setembro_amarelo',
    nome: 'Setembro Amarelo',
    cor: '#F5C518',
    svgIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="5"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>`,
  },
];

/* Rotações pré-definidas para consistência */
const ROTATIONS = [-3.2, 1.8, -1.2, 2.5, -2.0, 0.8, -1.6, 3.1, -2.7, 1.3];
let rotIdx = 0;

function nextRotation() {
  const r = ROTATIONS[rotIdx % ROTATIONS.length];
  rotIdx++;
  return r;
}

/* ============================================================
   ESTADO GLOBAL
   ============================================================ */
const state = {
  activeCampaign: CAMPAIGNS[0].id,
  counts: {},           // { campaignId: number }
  totalPolaroids: 0,
  totalParticipants: 0,
  knownIds: new Set(),  // IDs já renderizados
};

CAMPAIGNS.forEach(c => { state.counts[c.id] = 0; });

/* ============================================================
   DOM HELPERS
   ============================================================ */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

/* ============================================================
   RELÓGIO
   ============================================================ */
function startClock() {
  const el = $('#clock');
  function tick() {
    const now = new Date();
    el.textContent = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  tick();
  setInterval(tick, 10000);
}

/* ============================================================
   MONTAR INTERFACE: tabs e boards
   ============================================================ */
function buildUI() {
  const nav  = $('#campaign-nav');
  const main = $('#mural-main');

  CAMPAIGNS.forEach((c, i) => {
    // Tab
    const tab = document.createElement('button');
    tab.className = 'campaign-tab' + (i === 0 ? ' active' : '');
    tab.dataset.campaign = c.id;
    tab.style.setProperty('--tab-color', c.cor);
    tab.innerHTML = `
      <span class="tab-dot" style="background:${c.cor}"></span>
      ${c.nome}
      <span class="tab-count" id="count-${c.id}" style="background:${c.cor}22; color:${c.cor}">0</span>
    `;
    tab.addEventListener('click', () => switchCampaign(c.id));
    nav.appendChild(tab);

    // Active tab border
    if (i === 0) tab.style.borderBottomColor = c.cor;

    // Board
    const board = document.createElement('div');
    board.className = 'board' + (i === 0 ? ' active' : '');
    board.id = `board-${c.id}`;

    const grid = document.createElement('div');
    grid.className = 'board-grid';
    grid.id = `grid-${c.id}`;

    board.appendChild(grid);
    main.appendChild(board);

    renderEmptyState(c.id);
  });
}

function renderEmptyState(campaignId) {
  const grid = $(`#grid-${campaignId}`);
  if (grid && grid.children.length === 0) {
    grid.innerHTML = `
      <div class="board-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
          <path d="M3 9h18"/>
          <path d="M9 21V9"/>
        </svg>
        <p>Nenhuma contribuição ainda</p>
      </div>`;
  }
}

function clearEmptyState(campaignId) {
  const empty = $(`#grid-${campaignId} .board-empty`);
  if (empty) empty.remove();
}

/* ============================================================
   TROCAR CAMPANHA
   ============================================================ */
function switchCampaign(campaignId) {
  state.activeCampaign = campaignId;

  $$('.campaign-tab').forEach(tab => {
    const isActive = tab.dataset.campaign === campaignId;
    tab.classList.toggle('active', isActive);
    const c = CAMPAIGNS.find(x => x.id === campaignId);
    tab.style.borderBottomColor = isActive ? c.cor : 'transparent';
  });

  $$('.board').forEach(board => {
    board.classList.toggle('active', board.id === `board-${campaignId}`);
  });
}

/* ============================================================
   ATUALIZAR STATS
   ============================================================ */
function updateStats(bump = false) {
  const elMsg  = $('#stat-messages');
  const elPart = $('#stat-participants');

  elMsg.textContent  = state.totalPolaroids;
  elPart.textContent = state.totalParticipants;

  if (bump) {
    [elMsg, elPart].forEach(el => {
      el.classList.remove('bump');
      void el.offsetWidth; // reflow
      el.classList.add('bump');
    });
  }

  CAMPAIGNS.forEach(c => {
    const el = $(`#count-${c.id}`);
    if (el) el.textContent = state.counts[c.id] || 0;
  });
}

/* ============================================================
   RENDERIZAR POLAROID
   ============================================================ */
function renderPolaroid(data, animate = false) {
  if (state.knownIds.has(data.id)) return;
  state.knownIds.add(data.id);

  const grid = $(`#grid-${data.campaign_id}`);
  if (!grid) return;

  clearEmptyState(data.campaign_id);

  const rot = data._rot ?? nextRotation();
  const card = document.createElement('div');
  card.className = 'polaroid-card';
  card.dataset.id = data.id;
  card.style.setProperty('--drop-rot', `${rot}deg`);

  // Imagem
  const imgSrc = data.image_url || data.polaroid_url || '';
  const name   = data.participant_name || '';
  const phrase = data.phrase || '';

  card.innerHTML = `
    <svg class="polaroid-pin${animate ? ' ploc' : ''}" aria-hidden="true">
      <use href="#icon-pin"/>
    </svg>
    <img src="${imgSrc}" alt="Polaroid de ${name}" loading="lazy" onerror="this.style.background='#ddd'">
    <div class="polaroid-caption">
      <p class="polaroid-phrase">${escapeHtml(phrase)}</p>
      ${name ? `<p class="polaroid-name">— ${escapeHtml(name)}</p>` : ''}
    </div>
  `;

  if (animate) {
    // Insere no início do grid para aparecer em evidência
    grid.insertBefore(card, grid.firstChild);
    // Pequeno delay para CSS transition pegar
    requestAnimationFrame(() => {
      card.classList.add('dropping');
    });
  } else {
    grid.appendChild(card);
    card.style.transform = `rotate(${rot}deg)`;
  }

  // Atualiza contadores
  state.counts[data.campaign_id] = (state.counts[data.campaign_id] || 0) + 1;
  state.totalPolaroids++;
  state.totalParticipants = state.totalPolaroids; // 1:1 por ora
}

/* ============================================================
   CONFETE
   ============================================================ */
const CONFETTI_COLORS = ['#FF6B35','#F5C518','#4CAF50','#9C27B0','#1976D2','#FF4081','#00BCD4'];

function launchConfetti(count = 30) {
  const container = $('#confetti-container');
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';

    const x = Math.random() * window.innerWidth;
    const fallY = 200 + Math.random() * 250;
    const fallX = (Math.random() - 0.5) * 160;
    const rot   = Math.random() * 720 - 360;
    const dur   = 0.8 + Math.random() * 0.6;
    const delay = Math.random() * 0.35;
    const size  = 5 + Math.random() * 7;

    piece.style.cssText = `
      left: ${x}px;
      top: ${window.innerHeight - 100}px;
      width: ${size}px;
      height: ${size}px;
      background: ${CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]};
      --fall-y: -${fallY}px;
      --fall-x: ${fallX}px;
      --fall-rot: ${rot}deg;
      animation-duration: ${dur}s;
      animation-delay: ${delay}s;
      border-radius: ${Math.random() > 0.5 ? '50%' : '1px'};
    `;

    container.appendChild(piece);
    piece.addEventListener('animationend', () => piece.remove(), { once: true });
  }
}

/* ============================================================
   TOAST DE NOVA CONTRIBUIÇÃO
   ============================================================ */
let toastTimer = null;

function showContributionToast(data) {
  const toast   = $('#contribution-toast');
  const subText = $('#toast-sub-text');
  const name    = data.participant_name || 'Alguém';
  const campaign = CAMPAIGNS.find(c => c.id === data.campaign_id);
  const cName   = campaign ? campaign.nome : data.campaign_id;

  subText.textContent = `${name} acabou de participar da campanha "${cName}".`;

  toast.classList.remove('hidden');
  // Forçar reflow antes de adicionar visible
  void toast.offsetWidth;
  toast.classList.add('visible');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.classList.add('hidden'), 450);
  }, 5000);
}

/* ============================================================
   SSE — Server-Sent Events
   ============================================================ */
let sseRetryMs = 2000;

function connectSSE() {
  const es = new EventSource('/api/mural/stream');

  es.onmessage = (evt) => {
    try {
      const data = JSON.parse(evt.data);
      if (data.type === 'connected') return;

      // Novo polaroid chegou
      data._rot = nextRotation();
      renderPolaroid(data, true);
      updateStats(true);
      launchConfetti(28);
      showContributionToast(data);

      // Muda para a aba da campanha do polaroid recebido
      switchCampaign(data.campaign_id);

      sseRetryMs = 2000; // reset backoff
    } catch (e) {
      console.warn('SSE parse error:', e);
    }
  };

  es.onerror = () => {
    es.close();
    console.warn(`SSE desconectado. Reconectando em ${sseRetryMs / 1000}s...`);
    setTimeout(connectSSE, sseRetryMs);
    sseRetryMs = Math.min(sseRetryMs * 1.5, 30000);
  };
}

/* ============================================================
   CARREGAR POLAROIDS EXISTENTES (REST)
   ============================================================ */
async function loadExistingPolaroids() {
  try {
    const res  = await fetch('/api/mural/polaroids');
    if (!res.ok) return;
    const list = await res.json();
    // API retorna do mais recente ao mais antigo, inverter para montagem
    list.reverse().forEach(p => renderPolaroid(p, false));
    updateStats(false);
  } catch (e) {
    console.warn('Erro ao carregar polaroids:', e);
  }
}

async function loadStats() {
  try {
    const res  = await fetch('/api/mural/stats');
    if (!res.ok) return;
    const data = await res.json();
    state.totalPolaroids    = data.total_polaroids;
    state.totalParticipants = data.participants;
    updateStats(false);
  } catch (e) {
    console.warn('Erro ao carregar stats:', e);
  }
}

/* ============================================================
   UTILITÁRIOS
   ============================================================ */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ============================================================
   INIT
   ============================================================ */
async function init() {
  startClock();
  buildUI();
  await loadExistingPolaroids();
  await loadStats();
  connectSSE();
}

init();
