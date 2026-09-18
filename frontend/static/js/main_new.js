import { showStep } from './ui.js';
import { API } from './api.js';
import { initChoiceEffects } from './effects.js'; // Adicione a importação

// ─── Animação do Robô Pintando ────────────────────────────────────────────────
const FRAME_BASE = '/static/img/robot_painting/frame_';
const FRAME_DELAY = 135; // ~7.4 fps — velocidade agradável e fluida para ver a pintura

// Timeline contínua com pinceladas de ida e volta:
// 1) 092 a 113: Pinta a paisagem verde
// 2) Pinceladas de acabamento no verde (vai e volta entre 108 e 113)
// 3) 114 a 120: Pinta a noite estrelada
// 4) Pinceladas de acabamento nas estrelas (vai e volta entre 115 e 120)
const PAINTING_TIMELINE = [
  // 1. Pinta a paisagem verde
  92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113,
  // 2. Movimento de pincelada no verde (indo e voltando para dar vida)
  112, 111, 110, 109, 108, 109, 110, 111, 112, 113,
  112, 111, 110, 109, 108, 109, 110, 111, 112, 113,
  // 3. Pinta a noite estrelada
  114, 115, 116, 117, 118, 119, 120,
  // 4. Movimento de pincelada nas estrelas (indo e voltando)
  119, 118, 117, 116, 115, 116, 117, 118, 119, 120,
  119, 118, 117, 116, 115, 116, 117, 118, 119, 120
];

let _robotRunning  = false;
let _timelineIndex = 0;
let _robotLastTime = null;
let _robotAccum    = 0;
const _frameCache  = new Map();

// Pré-carrega todos os frames para evitar qualquer atraso de rede/decodificação
function preloadAllFrames() {
  for (let i = 92; i <= 120; i++) {
    if (!_frameCache.has(i)) {
      const img = new Image();
      img.src = `${FRAME_BASE}${String(i).padStart(3, '0')}.png`;
      _frameCache.set(i, img);
    }
  }
}
// Inicia o pré-carregamento imediatamente
preloadAllFrames();

function startRobotAnimation() {
  _robotRunning  = true;
  _timelineIndex = 0;
  _robotLastTime = null;
  _robotAccum    = 0;

  _renderRobotFrame(PAINTING_TIMELINE[0]);
  requestAnimationFrame(_robotTick);
}

function stopRobotAnimation() {
  _robotRunning = false;
}

function _robotTick(timestamp) {
  if (!_robotRunning) return;

  if (_robotLastTime === null) {
    _robotLastTime = timestamp;
    requestAnimationFrame(_robotTick);
    return;
  }

  const delta = timestamp - _robotLastTime;
  _robotLastTime = timestamp;

  // Limita o delta para evitar saltos bruscos caso o navegador perca foco
  const safeDelta = Math.min(delta, 500);
  _robotAccum += safeDelta;

  let changed = false;
  while (_robotAccum >= FRAME_DELAY) {
    _robotAccum -= FRAME_DELAY;
    _timelineIndex = (_timelineIndex + 1) % PAINTING_TIMELINE.length;
    changed = true;
  }

  if (changed) {
    _renderRobotFrame(PAINTING_TIMELINE[_timelineIndex]);
  }

  requestAnimationFrame(_robotTick);
}

function _renderRobotFrame(num) {
  const imgEl = document.getElementById('gen-robot-frame');
  if (!imgEl) return;
  const cached = _frameCache.get(num);
  imgEl.src = (cached && cached.src) ? cached.src : `${FRAME_BASE}${String(num).padStart(3, '0')}.png`;
}

// ─── Mensagens rotativas no título ───────────────────────────────────────────
const GEN_MESSAGES = [
  'Sua ideia está ganhando vida...',
  'Criando a composição visual...',
  'Gerando sua arte com IA...',
  'Quase lá! Montando seu Polaroid...',
];
let _msgInterval = null;

function startMessageCycle() {
  let i = 0;
  const el = document.getElementById('generating-title');
  if (el) el.textContent = GEN_MESSAGES[0];
  _msgInterval = setInterval(() => {
    i = (i + 1) % GEN_MESSAGES.length;
    const t = document.getElementById('generating-title');
    if (t) t.textContent = GEN_MESSAGES[i];
  }, 4000);
}

function stopMessageCycle() {
  if (_msgInterval) { clearInterval(_msgInterval); _msgInterval = null; }
}
// ─────────────────────────────────────────────────────────────────────────────

const state = {
  sessionId: null,
  cause: null,
  idea: null,
  phrase: null,
  audience: null,
  style: null,
  emotion: null,
  participantName: null,
};

async function initSession() {
  if (state.sessionId) return;
  try {
    const session = await API.startSession();
    state.sessionId = session.session_id;
  } catch (e) {
    console.error('Session error', e);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initSession();
  setupNavigation();
  setupInteractions();
  initChoiceEffects(); // Inicializa os efeitos de coleta
});

function setupNavigation() {
  const goTo = (stepId) => showStep(stepId);

  document.getElementById('btn-start')?.addEventListener('click', () => goTo('step-pre-test'));

  // Pre-test logic
  const termoRadios = document.querySelectorAll('input[name="termo_aceito"]');
  const surveyQuestions = document.getElementById('survey-questions');
  const btnSubmitPreTest = document.getElementById('btn-submit-pre-test');

  termoRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      btnSubmitPreTest.style.display = 'inline-flex';
      setTimeout(() => btnSubmitPreTest.style.opacity = '1', 50);
      
      if (e.target.value === 'sim') {
        surveyQuestions.style.display = 'block';
        setTimeout(() => surveyQuestions.style.opacity = '1', 50);
      } else {
        surveyQuestions.style.opacity = '0';
        setTimeout(() => surveyQuestions.style.display = 'none', 500);
      }
    });
  });

  btnSubmitPreTest?.addEventListener('click', async () => {
    const termo = document.querySelector('input[name="termo_aceito"]:checked')?.value;
    if (!termo) return;
    
    state.termo_aceito = termo;
    const formData = {
      session_id: state.session_id || Date.now().toString(),
      termo_aceito: termo
    };
    
    if (termo === 'sim') {
      formData.idade = document.querySelector('select[name="idade"]').value;
      formData.escolaridade = document.querySelector('select[name="escolaridade"]').value;
      formData.genero = document.querySelector('select[name="genero"]').value;
      formData.uso_ia = document.querySelector('input[name="uso_ia"]:checked')?.value;
      
      const finalidades = [];
      document.querySelectorAll('input[name="finalidades_ia"]:checked').forEach(cb => finalidades.push(cb.value));
      formData.finalidades_ia = finalidades;
      
      formData.q6 = document.querySelector('input[name="q6"]:checked')?.value;
      formData.q7 = document.querySelector('input[name="q7"]:checked')?.value;
      formData.q8 = document.querySelector('input[name="q8"]:checked')?.value;
      formData.q9 = document.querySelector('input[name="q9"]:checked')?.value;
      formData.q10 = document.querySelector('input[name="q10"]:checked')?.value;
    }

    try {
      await fetch('/api/survey/pre-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
    } catch (e) {
      console.error('Error saving pre-test:', e);
    }

    goTo('step-cause');
  });

  document.getElementById('btn-submit-post-test')?.addEventListener('click', async () => {
    const formData = {
      session_id: state.session_id,
      campaign_id: state.campaignId,
      user_message: state.userMessage,
      user_phrase: state.userPhrase
    };
    
    for (let i = 1; i <= 23; i++) {
      const el = document.querySelector(`input[name="pq${i}"]:checked`);
      if (el) formData[`pq${i}`] = el.value;
    }

    try {
      await fetch('/api/survey/post-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
    } catch (e) {
      console.error('Error saving post-test:', e);
    }
    
    window.location.reload();
  });

  const BANNED_PATTERNS = [
    /sangue/i, /mort[ea]s?/i, /matar/i, /assassinato/i, /\btiros?\b/i, /\barmas?\b/i, /\bfacas?\b/i, /suicídio/i,
    /nudez/i, /\bsexo\b/i, /porn[oô]/i, /pornografia/i, /pelad[oa]s?/i, /erótic[oa]/i,
    /estupro/i, /violência/i, /espancar/i, /\bbater\b/i, /machucar/i, /tortura/i, /\bseios?\b/i, 
    /pênis/i, /vagina/i, /bunda/i, /\bputas?\b/i, /caralho/i, /buceta/i, /\bpica\b/i, /\b[ck]u\b/i, /foder/i,
    /tes[aã]o/i, /gostos[oa]s?/i, /\brolas?\b/i, /xoxota/i, /piroca/i, /nsfw/i, /gore/i, /violento/i,
    /assédio/i, /assediar/i, /abuso/i
  ];

  // Custom idea "Continuar" → step-style
  document.getElementById('btn-next-idea')?.addEventListener('click', () => {
    const customIdea = document.getElementById('input-idea').value;
    
    // Filtro de palavras inapropriadas
    const hasBannedWords = BANNED_PATTERNS.some(regex => regex.test(customIdea));
    if (hasBannedWords) {
      const modal = document.getElementById('nsfw-modal');
      if (modal) modal.classList.remove('hidden');
      return;
    }

    state.idea = customIdea;
    goTo('step-style');
  });

  // Fechar o modal
  document.getElementById('btn-close-modal')?.addEventListener('click', () => {
    const modal = document.getElementById('nsfw-modal');
    if (modal) modal.classList.add('hidden');
  });

  // Phrase step → step-name
  document.getElementById('btn-next-phrase')?.addEventListener('click', () => {
    state.phrase = document.getElementById('input-phrase')?.value || '';
    goTo('step-name');
  });

  document.getElementById('btn-skip-phrase')?.addEventListener('click', () => {
    state.phrase = '';
    goTo('step-name');
  });

  document.getElementById('btn-next-name')?.addEventListener('click', () => {
    state.participantName = document.getElementById('input-name').value;
    goTo('step-generating');
    startRobotAnimation();
    startMessageCycle();
    finishGeneration();
  });

  document.getElementById('btn-new-creation')?.addEventListener('click', () => window.location.reload());
}

function setupInteractions() {
  // === CARROSSEL 3D INFINITO (CAUSA) ===
  const causeCards = document.querySelectorAll('.cause-card-ui');
  const dots = document.querySelectorAll('.carousel-dots .dot');
  const btnLeft = document.querySelector('.carousel-nav-btn.left');
  const btnRight = document.querySelector('.carousel-nav-btn.right');
  
  let currentCauseIndex = 1;

  function updateCarousel(index) {
    if (!causeCards.length) return;
    const total = causeCards.length;
    if (index < 0) index = total - 1;
    if (index >= total) index = 0;
    currentCauseIndex = index;

    causeCards.forEach((card, i) => {
      card.classList.remove('active', 'card-center', 'card-left', 'card-right', 'card-back');
      if (dots[i]) dots[i].classList.remove('active');
      
      let diff = i - currentCauseIndex;
      if (diff < -1) diff += total;
      if (diff > 2) diff -= total;

      if (diff === 0) {
        card.classList.add('active', 'card-center');
        if (dots[i]) dots[i].classList.add('active');
      } else if (diff === -1) {
        card.classList.add('card-left');
      } else if (diff === 1) {
        card.classList.add('card-right');
      } else {
        card.classList.add('card-back');
      }
    });
  }

  updateCarousel(currentCauseIndex);

  if (btnLeft && btnRight) {
    btnLeft.addEventListener('click', () => updateCarousel(currentCauseIndex - 1));
    btnRight.addEventListener('click', () => updateCarousel(currentCauseIndex + 1));
  }

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => updateCarousel(i));
  });

  const makeSvg = (path) => `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

  const causeIdeas = {
    "Bullying": [
      { text: "Um aluno estendendo a mão para ajudar um colega caído a se levantar", icon: makeSvg('<path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16"/><path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><path d="m2 15 6 6"/><path d="M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.73 2.73 0 0 0 16 3.3c-1.2.5-2 1.2-2 1.2s-.8-.7-2-1.2a2.73 2.73 0 0 0-5 2.5c0 1.1.8 2 1.5 2.7L12 12l3.5-3.5Z"/>') },
      { text: "Dois estudantes sorrindo e se abraçando amigavelmente no pátio", icon: makeSvg('<path d="M18 21a8 8 0 0 0-16 0"/><circle cx="10" cy="8" r="5"/><path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3"/>') },
      { text: "Um menino compartilhando um brinquedo com um colega sorridente", icon: makeSvg('<rect width="18" height="14" x="3" y="8" rx="1"/><path d="M10 8V5c0-.6-.4-1-1-1H6a1 1 0 0 0-1 1v3"/><path d="M19 8V5c0-.6-.4-1-1-1h-3a1 1 0 0 0-1 1v3"/>') },
      { text: "Um estudante usando um escudo imaginário brilhante para proteger um amigo", icon: makeSvg('<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2-1 4-2 7-2 2.5 0 4.5 1 6.5 2a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>') },
      { text: "Uma garota entregando um presente surpresa para um colega de classe", icon: makeSvg('<polyline points="20 12 20 22 4 22 4 12"/><rect width="20" height="5" x="2" y="7"/><line x1="12" x2="12" y1="22" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>') },
      { text: "Um menino dividindo seu lanche com um amigo no recreio da escola", icon: makeSvg('<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/>') },
      { text: "Um aluno acolhendo calorosamente um novo estudante com um sorriso", icon: makeSvg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/>') },
      { text: "Duas crianças sentadas juntas lendo o mesmo livro pacificamente", icon: makeSvg('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>') }
    ],
    "Saúde Mental": [
      { text: "Uma pessoa respirando fundo e encontrando paz em um jardim iluminado", icon: makeSvg('<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>') },
      { text: "Uma pessoa com uma expressão de alívio sentada em um parque ensolarado", icon: makeSvg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>') },
      { text: "Um jovem regando uma pequena planta que cresce feliz na janela", icon: makeSvg('<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7 2.9 7 2.9s-2.29 6.16-2.29 6.16c-1.14.93-1.71 2.03-1.71 3.19C3 14.47 4.8 16.3 7 16.3Z"/><path d="M20.93 14.8c-.85-1.57-2.61-3.66-3.93-5-.85 1.57-2.61 3.66-3.93 5-1.32 1.34-1.32 3.52 0 4.86a3.55 3.55 0 0 0 4.86 0c1.32-1.34 1.32-3.52 0-4.86Z"/>') },
      { text: "Uma mulher caminhando por um campo florido após uma tempestade", icon: makeSvg('<path d="M12 2v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="M20 12h2"/><path d="m19.07 4.93-1.41 1.41"/><path d="M15.947 12.65a4 4 0 0 0-5.925-4.128"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>') },
      { text: "Um pássaro branco voando livremente em direção a um céu azul e limpo", icon: makeSvg('<path d="M12.67 19a2 2 0 0 0 1.416-.588l6.154-6.172a6 6 0 0 0-8.49-8.49L5.586 9.914A2 2 0 0 0 5 11.328V18a1 1 0 0 0 1 1z"/><path d="M16 8 2 22"/><path d="M17.5 15H9"/>') },
      { text: "Uma pessoa sentada em silêncio observando um belo e calmo pôr do sol", icon: makeSvg('<path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/>') },
      { text: "Um grande girassol brilhante e forte crescendo em meio a um campo cinza", icon: makeSvg('<path d="M12 5a3 3 0 1 1-3 3m3-3a3 3 0 1 0 3 3m-3-3v1M9 8a3 3 0 1 0 3 3m-3-3h1m5-3a3 3 0 1 1-3 3m3-3h-1m-5 3a3 3 0 1 0 3 3m-3-3v1m5-3a3 3 0 1 1-3 3m3-3v1m-3 3v8"/>') },
      { text: "Um jovem relaxando em uma cadeira confortável com um sorriso sereno", icon: makeSvg('<path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 11v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H7v-2a2 2 0 0 0-4 0Z"/><path d="M5 18v2"/><path d="M19 18v2"/>') }
    ],
    "Inclusão Social": [
      { text: "Uma criança feliz em uma cadeira de rodas empinando uma pipa colorida", icon: makeSvg('<circle cx="16" cy="4" r="1"/><path d="m18 19 1-7-6 1"/><path d="m5 8 3-3 5.5 3-2.36 3.5"/><path d="M4.24 14.5a5 5 0 0 0 6.88 6"/><path d="M13.76 17.5a5 5 0 0 0-6.88-6"/>') },
      { text: "Dois amigos construindo juntos um castelo de blocos muito alto", icon: makeSvg('<path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"/><path d="M18 11V4H6v7"/><path d="M15 22v-4a3 3 0 0 0-6 0v4"/><path d="M22 11V9"/><path d="M2 11V9"/><path d="M6 4V2"/><path d="M18 4V2"/><path d="M10 4V2"/><path d="M14 4V2"/>') },
      { text: "Um menino sorridente pintando um quadro cheio de cores vibrantes", icon: makeSvg('<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>') },
      { text: "Uma peça de quebra-cabeça dourada se encaixando perfeitamente", icon: makeSvg('<path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 0-.289.877c.18 1.182-.239 2.385-1.121 3.267s-2.085 1.301-3.267 1.121a.98.98 0 0 0-.877.289l-1.611 1.611c-.47.47-1.087.706-1.704.706s-1.233-.235-1.704-.706l-1.568-1.568a.98.98 0 0 0-.878-.289c-1.182.18-2.385-.239-3.267-1.121s-1.301-2.085-1.121-3.267a.98.98 0 0 0-.289-.877L.706 13.704A2.41 2.41 0 0 1 0 12c0-.617.235-1.233.706-1.704l1.568-1.568a.98.98 0 0 0 .289-.878C2.383 6.668 2.802 5.465 3.684 4.583s2.085-1.301 3.267-1.121a.98.98 0 0 0 .877-.289L9.439 1.562A2.41 2.41 0 0 1 11.143.856c.617 0 1.233.235 1.704.706l1.611 1.611c.23.23.554.34.877.289 1.182-.18 2.385.239 3.267 1.121s1.301 2.085 1.121 3.267z"/>') },
      { text: "Um estudante subindo uma rampa escolar colorida com muita alegria", icon: makeSvg('<path d="M13 5H19V11"/><path d="M19 5L5 19"/>') },
      { text: "Uma jovem plantando uma pequena árvore em um parque ensolarado", icon: makeSvg('<path d="M17.8 19.2c1.5-1.5 2.2-3.5 2.2-5.7 0-4.4-3.6-8-8-8s-8 3.6-8 8c0 2.2.7 4.2 2.2 5.7"/><path d="M12 22v-9"/>') },
      { text: "Uma menina sorrindo enquanto brinca em um balanço acessível", icon: makeSvg('<path d="M22 11v1a10 10 0 1 1-9-10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/><path d="M16 5h6"/><path d="M19 2v6"/>') },
      { text: "Uma pessoa e seu cão-guia caminhando felizes por uma praça florida", icon: makeSvg('<path d="M10 5.172C10 3.782 8.423 2.679 6.5 3c-2.823.47-4.113 6.006-4 7 .08.7.28 1.53 1 2+1.08.7 3 .2 4-.3v-.2"/><path d="M14 5.172C14 3.782 15.577 2.679 17.5 3c2.823.47 4.113 6.006 4 7-.08.7-.28 1.53-1 2-1.08.7-3 .2-4-.3v-.2"/><path d="M10 16.5V22h4v-5.5"/><path d="M7 14c-1.5 0-3 1.5-3 3v5h4v-3"/><path d="M17 14c1.5 0 3 1.5 3 3v5h-4v-3"/><path d="M12 11c1 0 2-1 2-2s-1-2-2-2-2 1-2 2 1 2 2 2Z"/>') }
    ],
    "Violência contra a Mulher": [
      { text: "Uma mulher caminhando com a cabeça erguida, sentindo-se segura e livre", icon: makeSvg('<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M3 5h4"/>') },
      { text: "Duas amigas de mãos dadas caminhando juntas com força e confiança", icon: makeSvg('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>') },
      { text: "Uma borboleta dourada saindo de uma gaiola aberta em direção ao sol", icon: makeSvg('<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>') },
      { text: "Uma mulher sorridente sendo abraçada com carinho por uma grande amiga", icon: makeSvg('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>') },
      { text: "Uma balança dourada brilhante e perfeitamente equilibrada na floresta", icon: makeSvg('<path d="M16 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"/><path d="M2 16l3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h18"/>') },
      { text: "Uma mulher forte e confiante admirando uma flor que acabou de brotar", icon: makeSvg('<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>') },
      { text: "Uma mulher destemida cruzando uma ponte iluminada pelo sol da manhã", icon: makeSvg('<polygon points="3 11 22 2 13 21 11 13 3 11"/>') },
      { text: "Uma garota abrindo os braços para o céu estrelado em um campo sereno", icon: makeSvg('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/><path d="M19 3v4"/><path d="M21 5h-4"/>') }
    ]
  };

  function updateIdeaCardsForCause(causeName) {
    const grid = document.getElementById('idea-cards-grid');
    if (!grid) return;
    
    // Get ideas for cause, fallback to a default array if not found
    const allIdeas = causeIdeas[causeName] || causeIdeas["Bullying"];
    
    // Shuffle ideas and pick 4
    const shuffled = [...allIdeas].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 4);
    
    grid.innerHTML = '';
    selected.forEach(idea => {
      const btn = document.createElement('button');
      btn.className = 'idea-card';
      btn.dataset.val = idea.text;
      
      btn.innerHTML = `<span class="idea-card-icon">${idea.icon}</span><span class="idea-card-text">${idea.text}</span>`;
      
      btn.addEventListener('click', () => {
        document.querySelectorAll('.idea-card').forEach(c => c.classList.remove('selected'));
        btn.classList.add('selected');
        state.idea = btn.dataset.val;
        const toggle = document.getElementById('idea-custom-toggle');
        if (toggle) toggle.classList.remove('expanded');
        setTimeout(() => showStep('step-style'), 600);
      });
      
      grid.appendChild(btn);
    });
  }

  causeCards.forEach((card, index) => {
    card.addEventListener('click', () => {
      if (index !== currentCauseIndex) {
        updateCarousel(index);
        return;
      }
      state.cause = card.dataset.val;
      updateIdeaCardsForCause(state.cause);
      setTimeout(() => showStep('step-idea'), 500);
    });
  });

  // Remove old static IDEA CARDS listeners since we recreate them dynamically
  // (We'll just keep the custom toggle logic below)

  // === TOGGLE "OU IMAGINE DO SEU JEITO..." ===
  const customToggle = document.getElementById('idea-custom-toggle');
  const customBtn = document.getElementById('idea-custom-btn');
  const customInput = document.getElementById('input-idea');
  const nextIdeaBtn = document.getElementById('btn-next-idea');

  customBtn?.addEventListener('click', () => {
    customToggle.classList.add('expanded');
    // Desmarca qualquer card selecionado
    document.querySelectorAll('.idea-card').forEach(c => c.classList.remove('selected'));
    state.idea = null;
    // Foca no textarea após a animação
    setTimeout(() => customInput?.focus(), 380);
  });

  customInput?.addEventListener('input', () => {
    if (nextIdeaBtn) nextIdeaBtn.disabled = customInput.value.trim().length < 5;
  });

  // === STYLE SELECTION ===
  setupStyleSelector();
}

let bgGenerationPromise = null;

function setupPillSelector(containerId, stateKey, nextBtnId, nextStepId) {
  const container = document.getElementById(containerId);
  const nextBtn = document.getElementById(nextBtnId);
  if(!container) return;
  const pills = container.querySelectorAll('.pill-btn');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('selected'));
      pill.classList.add('selected');
      state[stateKey] = pill.dataset.val;
      if(nextBtn) nextBtn.disabled = false;
      
      if(nextStepId) {
         setTimeout(() => { showStep(nextStepId); }, 800);
      }
    });
  });
}

function setupStyleSelector() {
  const styleThumbs = document.querySelectorAll('.style-thumb');
  styleThumbs.forEach(thumb => {
    thumb.addEventListener('click', () => {
      styleThumbs.forEach(t => t.classList.remove('selected'));
      thumb.classList.add('selected');
      state.style = thumb.dataset.val;
      
      // Start generating prompt and image in background immediately
      bgGenerationPromise = runBackgroundGeneration();
      
      // Proceed to phrase step
      setTimeout(() => { showStep('step-phrase'); }, 800);
    });
  });
}

async function runBackgroundGeneration() {
  const updatePayload = {
    campaign_id: state.cause,
    user_message: state.idea,
    visual_style: state.style,
  };
  try {
    await API.updateSession(state.sessionId, updatePayload);
    await API.generatePrompt(state.sessionId);
    await API.generateImage(state.sessionId);
  } catch (e) {
    console.error("Background generation error", e);
    throw e;
  }
}

async function finishGeneration() {
  // Tempo mínimo que o robô fica animando na tela (em ms)
  const MIN_DISPLAY_MS = 5000;
  const startedAt = Date.now();

  try {
    // Esconde mensagem de erro anterior se houver
    document.getElementById('gen-error')?.classList.add('hidden');

    // Aguarda a geração em background (prompt + imagem) se ainda não terminou
    if (bgGenerationPromise) {
      await bgGenerationPromise;
    }

    // Garante o tempo mínimo na tela para ver a arte do robô
    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_DISPLAY_MS) {
      await new Promise(r => setTimeout(r, MIN_DISPLAY_MS - elapsed));
    }

    // Atualiza frase e nome, depois monta o Polaroid
    await API.updateSession(state.sessionId, {
      user_phrase: state.phrase,
      participant_name: state.participantName || 'Anônimo'
    });

    const polData = await API.createPolaroid(state.sessionId, state.participantName || 'Anônimo');
    
    document.getElementById('polaroid-image').src = polData.polaroid_url;
    if (document.getElementById('polaroid-sketch-image')) {
      document.getElementById('polaroid-sketch-image').src = polData.polaroid_sketch_url;
    }
    stopRobotAnimation();
    stopMessageCycle();
    showStep('step-result');

    // Orquestra a animação Apple-style de revelação do Polaroid
    const resultStep = document.getElementById('step-result');

    if (resultStep) {
      // 1. Estado inicial camuflado (tudo escondido/para baixo)
      resultStep.className = 'step active state-init';

      // 2. Revela a Polaroid colorida com animação suave e lenta
      setTimeout(() => {
        resultStep.className = 'step active state-reveal';
      }, 1200);

      // 3. Divide as polaroids (Colorida menor p/ esquerda, sketch maior p/ direita)
      setTimeout(() => {
        resultStep.className = 'step active state-split';
      }, 5500); // Gives a nice 4.3 seconds to admire the main art before splitting

      // 4. Mostra o botão de nova arte (Roxo!)
      setTimeout(() => {
        resultStep.className = 'step active state-split state-done';
      }, 7000);
    }
  } catch(e) {
    console.error("Erro na geração:", e);
    // NÃO para a animação do robô! Ele continua pintando enquanto avisa o erro
    const errContainer = document.getElementById('gen-error');
    const errMsg = document.getElementById('gen-error-msg');
    if (errContainer) {
      errContainer.classList.remove('hidden');
      if (errMsg) {
        errMsg.textContent = (e && e.message) ? e.message : 'Não foi possível conectar ao gerador de imagens. Verifique se o Stable Diffusion está ativo.';
      }
    }
    const subtitle = document.getElementById('generating-subtitle');
    if (subtitle) {
      subtitle.textContent = 'Ops! Houve uma instabilidade na geração de imagem.';
    }

    const retryBtn = document.getElementById('btn-retry');
    if (retryBtn) {
      retryBtn.onclick = () => {
        if (errContainer) errContainer.classList.add('hidden');
        if (subtitle) {
          subtitle.textContent = 'Aguarde enquanto a IA cria algo incrível para você ✨';
        }
        bgGenerationPromise = runBackgroundGeneration();
        finishGeneration();
      };
    }
  }
}