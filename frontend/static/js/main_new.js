import { showStep } from './ui.js';
import { API } from './api.js';

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
});

function setupNavigation() {
  const goTo = (stepId) => {
    showStep(stepId);
  };

  document.getElementById('btn-start')?.addEventListener('click', () => goTo('step-cause'));
  
  document.getElementById('btn-next-idea')?.addEventListener('click', () => {
    state.idea = document.getElementById('input-idea').value;
    state.phrase = document.getElementById('input-phrase').value;
    goTo('step-audience');
  });

  document.getElementById('btn-next-emotion')?.addEventListener('click', () => {
    state.participantName = document.getElementById('input-name').value;
    goTo('step-generating');
    startGeneration();
  });

  document.getElementById('btn-new-creation')?.addEventListener('click', () => window.location.reload());
}

function setupInteractions() {
  // === CARROSSEL 3D INFINITO ===
  const causeCards = document.querySelectorAll('.cause-card-ui');
  const dots = document.querySelectorAll('.carousel-dots .dot');
  const btnLeft = document.querySelector('.carousel-nav-btn.left');
  const btnRight = document.querySelector('.carousel-nav-btn.right');
  
  let currentCauseIndex = 1; // Inicia focado no Setembro Amarelo

  function updateCarousel(index) {
    if (!causeCards.length) return;
    const total = causeCards.length;
    
    // Matemática para looping infinito
    if (index < 0) index = total - 1;
    if (index >= total) index = 0;
    currentCauseIndex = index;

    causeCards.forEach((card, i) => {
      // Limpa todas as classes
      card.classList.remove('active', 'card-center', 'card-left', 'card-right', 'card-back');
      if (dots[i]) dots[i].classList.remove('active');
      
      // Calcula a distância relativa entre o card atual (i) e o foco (currentCauseIndex)
      let diff = i - currentCauseIndex;
      if (diff < -1) diff += total; // Enrola pela direita
      if (diff > 2) diff -= total;  // Enrola pela esquerda

      // diff será: 0 (Centro), -1 (Esquerda), 1 (Direita), 2 ou -2 (Escondido atrás)
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

  // Inicializa a posição do carrossel
  updateCarousel(currentCauseIndex);

  if (btnLeft && btnRight) {
    btnLeft.addEventListener('click', () => updateCarousel(currentCauseIndex - 1));
    btnRight.addEventListener('click', () => updateCarousel(currentCauseIndex + 1));
  }

  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => updateCarousel(i));
  });

  causeCards.forEach((card, index) => {
    card.addEventListener('click', () => {
      // Se clicou em um que não é o do centro, primeiro traz ele pro centro
      if (index !== currentCauseIndex) {
        updateCarousel(index);
        return; 
      }
      
      // Se clicou no que JÁ ESTÁ no centro, escolhe e avança
      state.cause = card.dataset.val;
      setTimeout(() => showStep('step-idea'), 500);
    });
  });

  // === IDEA SELECTION ===
  const ideaBtns = document.querySelectorAll('.idea-btn');
  const ideaInput = document.getElementById('input-idea');
  const nextIdeaBtn = document.getElementById('btn-next-idea');
  
  ideaBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      ideaInput.value = btn.innerText.replace(/^[^\w\s]+/, '').trim();
      nextIdeaBtn.disabled = false;
    });
  });

  ideaInput.addEventListener('input', () => {
    nextIdeaBtn.disabled = ideaInput.value.length < 5;
  });

  // === AUDIENCE, STYLE & EMOTION SELECTION ===
  setupPillSelector('audience-selector', 'audience', null, 'step-style');
  setupStyleSelector();
  setupPillSelector('emotion-selector', 'emotion', 'btn-next-emotion', null);
}

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
      setTimeout(() => { showStep('step-emotion'); }, 800);
    });
  });
}

async function startGeneration() {
  const sequences = document.querySelectorAll('.gen-seq-item');
  sequences.forEach(s => { s.classList.remove('active', 'done'); });
  
  const nextSeq = (index, ms) => {
    return new Promise(resolve => {
      setTimeout(() => {
        if(index > 0) sequences[index-1].classList.replace('active', 'done');
        if(index < sequences.length) sequences[index].classList.add('active');
        resolve();
      }, ms);
    });
  };

  await nextSeq(0, 500); 
  
  const updatePayload = {
    campaign_id: state.cause,
    user_message: `Público-alvo: ${state.audience}. Cenário: ${state.idea}`,
    user_phrase: state.phrase,
    visual_style: state.style,
    mood: state.emotion,
    participant_name: state.participantName || 'Anônimo'
  };

  try {
    await API.updateSession(state.sessionId, updatePayload);
    await nextSeq(1, 1000);
    await API.generatePrompt(state.sessionId);
    await nextSeq(2, 1000); 
    await API.generateImage(state.sessionId);
    await nextSeq(3, 1000);
    const polData = await API.createPolaroid(state.sessionId, state.participantName || 'Anônimo');
    
    document.getElementById('polaroid-image').src = polData.polaroid_color_url;
    showStep('step-result');
  } catch(e) {
    console.error(e);
    document.getElementById('gen-error').classList.remove('hidden');
    document.getElementById('btn-retry').onclick = () => {
      document.getElementById('gen-error').classList.add('hidden');
      startGeneration();
    };
  }
}