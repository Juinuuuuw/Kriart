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

const roboldoTexts = {
  welcome: "Olá! Vamos criar algo incrível!",
  cause: "Ótima escolha! Uma causa importante.",
  idea: "Hmm... essa ideia é muito boa! Mas me conta uma coisa...",
  audience: "Entendi! E como queremos contar essa história?",
  style: "Uau, esse universo vai ficar lindo!",
  emotion: "Perfeito! Já consigo visualizar...",
  generating: "Deixa comigo! Estou criando a magia...",
  done: "Ficou sensacional! Olha só:"
};

function updateRoboldo(text) {
  const roboldo = document.getElementById('roboldo-companion');
  const bubble = document.getElementById('roboldo-text');
  if (roboldo && bubble) {
    roboldo.classList.remove('hidden');
    bubble.innerHTML = text;
  }
}

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
  const goTo = (stepId, roboldoKey) => {
    showStep(stepId);
    if(roboldoTexts[roboldoKey]) updateRoboldo(roboldoTexts[roboldoKey]);
  };

  document.getElementById('btn-start')?.addEventListener('click', () => goTo('step-cause', 'welcome'));
  document.getElementById('btn-back-welcome')?.addEventListener('click', () => goTo('step-welcome', 'welcome'));
  
  document.getElementById('btn-back-cause')?.addEventListener('click', () => goTo('step-cause', 'welcome'));
  document.getElementById('btn-next-idea')?.addEventListener('click', () => {
    state.idea = document.getElementById('input-idea').value;
    state.phrase = document.getElementById('input-phrase').value;
    goTo('step-audience', 'idea');
  });

  document.getElementById('btn-back-idea')?.addEventListener('click', () => goTo('step-idea', 'cause'));
  document.getElementById('btn-next-audience')?.addEventListener('click', () => goTo('step-style', 'audience'));

  document.getElementById('btn-back-audience')?.addEventListener('click', () => goTo('step-audience', 'idea'));
  document.getElementById('btn-next-style')?.addEventListener('click', () => goTo('step-emotion', 'style'));

  document.getElementById('btn-back-style')?.addEventListener('click', () => goTo('step-style', 'audience'));
  document.getElementById('btn-next-emotion')?.addEventListener('click', () => {
    state.participantName = document.getElementById('input-name').value;
    goTo('step-generating', 'generating');
    startGeneration();
  });

  document.getElementById('btn-new-creation')?.addEventListener('click', () => window.location.reload());
}

function setupInteractions() {
  // Cause Selection
  const causeCards = document.querySelectorAll('.cause-card');
  causeCards.forEach(card => {
    card.addEventListener('click', () => {
      causeCards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.cause = card.dataset.val;
      updateRoboldo(roboldoTexts.cause);
      setTimeout(() => showStep('step-idea'), 800);
    });
  });

  // Idea Selection
  const ideaBtns = document.querySelectorAll('.idea-btn');
  const ideaInput = document.getElementById('input-idea');
  const nextIdeaBtn = document.getElementById('btn-next-idea');
  
  ideaBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      ideaInput.value = btn.innerText.replace(/^[^\w\s]+/, '').trim();
      nextIdeaBtn.disabled = false;
      simulateAI();
    });
  });

  ideaInput.addEventListener('input', () => {
    nextIdeaBtn.disabled = ideaInput.value.length < 5;
    if (ideaInput.value.length > 10 && ideaInput.value.length % 15 === 0) {
       simulateAI();
    }
  });

  // Audience Selection
  setupPillSelector('audience-selector', 'audience', 'btn-next-audience');
  
  // Style Selection
  const styleThumbs = document.querySelectorAll('.style-thumb');
  const nextStyleBtn = document.getElementById('btn-next-style');
  styleThumbs.forEach(thumb => {
    thumb.addEventListener('click', () => {
      styleThumbs.forEach(t => t.classList.remove('selected'));
      thumb.classList.add('selected');
      state.style = thumb.dataset.val;
      nextStyleBtn.disabled = false;
      setTimeout(() => {
        showStep('step-emotion');
        updateRoboldo(roboldoTexts.style);
      }, 800);
    });
  });

  // Emotion Selection
  setupPillSelector('emotion-selector', 'emotion', 'btn-next-emotion');
}

function setupPillSelector(containerId, stateKey, nextBtnId) {
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
      
      // Auto advance for audience
      if(stateKey === 'audience') {
         setTimeout(() => {
            showStep('step-style');
            updateRoboldo(roboldoTexts.audience);
         }, 800);
      }
    });
  });
}

async function simulateAI() {
  const box = document.getElementById('ai-suggestion-box');
  const text = document.getElementById('ai-suggestion-text');
  if(!box.classList.contains('hidden')) return;
  
  const val = document.getElementById('input-idea').value;
  if(val.length < 5) return;
  
  box.classList.remove('hidden');
  text.innerText = 'Pensando...';
  
  try {
    const res = await API.chat(state.sessionId, `Imagine uma cena visual para: ${val}. Responda em 1 ou 2 frases curtas.`, "");
    text.innerText = res.response || res.reply || `Uma cena sobre: ${val}. É isso?`;
    
    document.getElementById('btn-accept-idea').onclick = () => {
      document.getElementById('input-idea').value = text.innerText;
      box.classList.add('hidden');
    };
    document.getElementById('btn-reject-idea').onclick = () => {
      box.classList.add('hidden');
    };
  } catch (e) {
    box.classList.add('hidden');
  }
}

async function startGeneration() {
  document.getElementById('seq-recap-idea').innerText = `Mensagem: ${state.idea}`;
  document.getElementById('seq-recap-style').innerText = `Estilo: ${state.style}`;
  
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
  
  // Define update payload
  const updatePayload = {
    campaign_id: state.cause,
    user_message: `Público-alvo: ${state.audience}. Cenário: ${state.idea}`,
    user_phrase: state.phrase,
    visual_style: state.style,
    mood: state.emotion,
    participant_name: state.participantName || 'Anônimo'
  };

  try {
    // Session state
    await API.updateSession(state.sessionId, updatePayload);
    
    // Generate prompt
    await nextSeq(1, 1000);
    await API.generatePrompt(state.sessionId);

    // Generate Image
    await nextSeq(2, 1000); 
    await API.generateImage(state.sessionId);

    // Create Polaroid
    await nextSeq(3, 1000);
    const polData = await API.createPolaroid(state.sessionId, state.participantName || 'Anônimo');
    
    document.getElementById('polaroid-image').src = polData.polaroid_color_url;
    
    showStep('step-result');
    updateRoboldo(roboldoTexts.done);
  } catch(e) {
    console.error(e);
    document.getElementById('gen-error').classList.remove('hidden');
    document.getElementById('btn-retry').onclick = () => {
      document.getElementById('gen-error').classList.add('hidden');
      startGeneration();
    };
  }
}
