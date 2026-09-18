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

  document.getElementById('btn-start')?.addEventListener('click', () => goTo('step-cause'));

  // Custom idea "Continuar" → step-style
  document.getElementById('btn-next-idea')?.addEventListener('click', () => {
    state.idea = document.getElementById('input-idea').value;
    goTo('step-style');
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

  const causeIdeas = {
    "Bullying": [
      "Uma criança convidando um colega solitário para brincar no parquinho",
      "Dois alunos que antes brigavam, agora sorrindo e se abraçando",
      "Um aluno ajudando outro a se levantar do chão com um sorriso",
      "Um grupo de crianças brincando felizes enquanto incluem um novo estudante",
      "Um menino protegendo seu amigo com um escudo imaginário brilhante",
      "Estudantes de mãos dadas formando um grande círculo no pátio da escola",
      "Uma criança dividindo seu lanche com um colega no recreio",
      "Várias crianças cercando um aluno novo com abraços e sorrisos"
    ],
    "Saúde Mental": [
      "Uma pessoa respirando fundo e encontrando paz em um jardim iluminado",
      "Alguém com uma expressão de enorme alívio ao ser abraçado por um amigo",
      "Um jovem regando uma pequena planta que cresce na janela",
      "Uma pessoa caminhando em um parque ensolarado após uma longa tempestade",
      "Uma mente calma representada por pássaros brancos voando no céu azul",
      "Duas pessoas sentadas em silêncio observando um belo pôr do sol",
      "Um grande girassol brilhante crescendo em meio a um campo cinza",
      "Um abraço caloroso e reconfortante em um ambiente tranquilo"
    ],
    "Inclusão Social": [
      "Uma criança em cadeira de rodas sorrindo enquanto empina uma pipa com os amigos",
      "Crianças de diferentes origens montando juntas um grande castelo de blocos",
      "Uma criança com Síndrome de Down pintando um quadro colorido na escola",
      "Mãos de diferentes cores se juntando para montar um quebra-cabeça gigante",
      "Uma rampa escolar colorida cheia de estudantes caminhando e sorrindo",
      "Um grupo diverso de jovens plantando uma árvore juntos em um parque",
      "Crianças brincando juntas em um balanço gigante e acessível",
      "Uma pessoa com um cão-guia caminhando feliz por uma praça florida"
    ],
    "Violência contra a Mulher": [
      "Uma mulher caminhando com a cabeça erguida, sentindo-se segura e livre",
      "Um grupo de mulheres de mãos dadas, mostrando união e força",
      "Uma borboleta dourada saindo de uma gaiola aberta em direção ao sol",
      "Uma rede de apoio formada por amigas abraçando uma mulher de forma acolhedora",
      "Uma balança dourada brilhante perfeitamente equilibrada na natureza",
      "Uma mulher forte e confiante plantando uma semente que floresce",
      "Várias mulheres construindo juntas uma ponte sobre um rio",
      "Uma garota abrindo os braços para o céu em um campo florido"
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
    selected.forEach(ideaText => {
      const btn = document.createElement('button');
      btn.className = 'idea-card';
      btn.dataset.val = ideaText;
      // Removido o span do emoji, apenas o texto
      btn.innerHTML = `<span class="idea-card-text">${ideaText}</span>`;
      
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