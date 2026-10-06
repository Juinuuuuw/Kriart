// A short, skippable entrance and a character-led quest, independent of the AI.
const ART = '/static/img/robot/';
const ENTRANCE_POSES = {
  falling: 'RobotFalling.png',
  bracing: 'RobotBracing.png',
  landed: 'RobotLanded.png',
  rising: 'RobotGettingUp.png',
  inviting: 'RobotWaving.png',
};
const MISSIONS = ['Causa', 'Ideia', 'Estilo', 'Arte'];
const SCRIPT = {
  'step-cause': { progress: 0, line: 'Agora quero que você escolha uma causa. Qual delas a gente vai ajudar hoje?' },
  'step-idea': { progress: 1, line: 'Primeira missão cumprida! Agora me conta: que história vamos desenhar? Pode inventar a sua!' },
  'step-style': { progress: 2, line: 'Já consigo imaginar! Escolha um desses mundos para dar vida à nossa ideia.' },
  'step-phrase': { progress: 3, line: 'Nossa missão já tem forma! Quer colocar uma frase no cartaz? Se preferir, pode pular.' },
  'step-name': { progress: 3, line: 'Só falta a assinatura do meu parceiro de criação. Como você quer aparecer na sua arte?' },
  'step-generating': { progress: 3, line: 'Agora deixa comigo! Enquanto eu preparo sua arte, que tal acender algumas faíscas?' },
  'step-result': { progress: 4, line: 'Conseguimos! Você transformou uma ideia em arte. Missão cumprida, parceiro!' },
};
const CHOOSE_LINE = SCRIPT['step-cause'].line;
let activeStep = 'step-welcome';
let introSeen = false;
let voiceOn = false;
let currentLine = '';
let typingTimer = 0;
let introTimers = [];
let intro;
let quest;
let speech;
let entranceVersion = 0;
let entranceReady;
const entranceImages = new Map();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

function still() {
  return reduceMotion.matches || document.documentElement.classList.contains('robot-motion-off');
}

function cancelSpeech() {
  speech?.cancel();
}

function speak(line) {
  cancelSpeech();
  if (!line || !voiceOn || !speech || document.hidden) return;
  const utterance = new SpeechSynthesisUtterance(line);
  utterance.lang = 'pt-BR';
  utterance.rate = 1.04;
  utterance.pitch = 1.12;
  const voices = speech.getVoices();
  const voice = voices.find(v => v.lang.toLowerCase() === 'pt-br') || voices.find(v => v.lang.startsWith('pt'));
  if (voice) utterance.voice = voice;
  // Text remains the source of truth when a device has no usable voice.
  utterance.onerror = () => {};
  speech.speak(utterance);
}

function dialogueTarget() {
  if (intro.open) return intro.querySelector('.robot-dialogue');
  return document.querySelector(`#${activeStep} .robot-dialogue`);
}

export function robotSay(line) {
  if (!line) return;
  currentLine = line;
  clearInterval(typingTimer);
  document.querySelectorAll('.robot-talking').forEach(el => el.classList.remove('robot-talking'));
  const target = dialogueTarget();
  if (target) {
    const text = target.querySelector('.robot-dialogue-text');
    target.querySelector('.robot-dialogue-live').textContent = line;
    const actor = intro.open ? intro : target.closest('.cause-mascot');
    text.textContent = still() ? line : '';
    if (!still()) {
      let length = 0;
      actor?.classList.add('robot-talking');
      typingTimer = setInterval(() => {
        length += 2;
        text.textContent = line.slice(0, length);
        if (length >= line.length) {
          clearInterval(typingTimer);
          actor?.classList.remove('robot-talking');
        }
      }, 28);
    }
  }
  speak(line);
}

function prepareBubble(bubble) {
  bubble.classList.add('robot-dialogue');
  bubble.replaceChildren();
  const label = document.createElement('span');
  label.className = 'robot-speaker';
  label.textContent = 'ROBOT · SEU PARCEIRO';
  const text = document.createElement('span');
  text.className = 'robot-dialogue-text';
  text.setAttribute('aria-hidden', 'true');
  const live = document.createElement('span');
  live.className = 'robot-sr-only robot-dialogue-live';
  live.setAttribute('role', 'status');
  bubble.append(label, text, live);
}

function clearIntroTimers() {
  introTimers.forEach(clearTimeout);
  introTimers = [];
}

function entrancePose(phase) {
  const current = document.getElementById('robot-intro-img');
  const next = entranceImages.get(ENTRANCE_POSES[phase]);
  if (next?.complete && next.naturalWidth) {
    next.id = current.id;
    next.className = current.className;
    next.alt = '';
    next.draggable = false;
    if (current !== next) current.replaceWith(next);
  } else current.src = ART + ENTRANCE_POSES[phase];
  intro.dataset.phase = phase;
}

function invitation() {
  entranceVersion++;
  clearIntroTimers();
  entrancePose('inviting');
  document.getElementById('robot-intro-kicker').textContent = 'MISSÃO 01 · ENCONTRE SUA CAUSA';
  robotSay(CHOOSE_LINE);
}

function closeIntro(focusChoices = true) {
  entranceVersion++;
  clearIntroTimers();
  clearInterval(typingTimer);
  cancelSpeech();
  if (intro.open) intro.close();
  document.documentElement.classList.remove('robot-intro-open');
  if (activeStep === 'step-cause') {
    // Keep the instruction visible without repeating the same audio.
    const wasVoiceOn = voiceOn;
    voiceOn = false;
    robotSay(CHOOSE_LINE);
    voiceOn = wasVoiceOn;
    if (focusChoices) document.querySelector('.cause-card-ui')?.focus({ preventScroll: true });
  }
}

async function enterIntro() {
  const version = ++entranceVersion;
  introSeen = true;
  intro.dataset.phase = 'loading';
  intro.showModal();
  document.documentElement.classList.add('robot-intro-open');
  document.getElementById('robot-intro-skip').focus();
  if (still()) {
    invitation();
    return;
  }
  robotSay('Já estou chegando, parceiro!');
  // Decode the actual action poses before starting their short timeline.
  // A slow/missing asset never blocks the invitation or the skip button.
  const loaded = await Promise.race([
    entranceReady,
    new Promise(resolve => introTimers.push(setTimeout(() => resolve(false), 2500))),
  ]);
  if (version !== entranceVersion || !intro.open) return;
  clearIntroTimers();
  if (!loaded || still()) {
    invitation();
    return;
  }
  entrancePose('falling');
  robotSay('Uooopa! Chegueeei!');
  introTimers.push(setTimeout(() => entrancePose('bracing'), 650));
  introTimers.push(setTimeout(() => {
    entrancePose('landed');
    robotSay('Opa… acho que errei o pouso. Mas achei meu parceiro de missão!');
  }, 1050));
  introTimers.push(setTimeout(() => entrancePose('rising'), 2300));
  introTimers.push(setTimeout(invitation, 3900));
}

function showMission(stepId) {
  const config = SCRIPT[stepId];
  quest.hidden = !config;
  if (!config) return;
  document.getElementById(stepId).append(quest);
  quest.querySelector('.robot-quest-title').textContent = config.progress === 4 ? '✦ Missão cumprida!' : '✦ Missão: dar voz a uma causa';
  quest.querySelectorAll('li').forEach((item, i) => {
    item.classList.toggle('is-done', i < config.progress);
    item.classList.toggle('is-current', i === config.progress);
    item.querySelector('span').textContent = i < config.progress ? '✓' : i + 1;
    if (i === config.progress) item.setAttribute('aria-current', 'step');
    else item.removeAttribute('aria-current');
  });
}

export function initRobotStory() {
  intro = document.getElementById('robot-intro');
  entranceReady = Promise.all(Object.values(ENTRANCE_POSES).map(file => new Promise(resolve => {
    const image = new Image();
    entranceImages.set(file, image);
    image.onload = () => image.decode().then(() => resolve(true), () => resolve(false));
    image.onerror = () => resolve(false);
    image.src = ART + file;
  }))).then(loaded => loaded.every(Boolean));
  speech = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window ? window.speechSynthesis : null;
  document.querySelectorAll('.mascot-bubble, #robot-intro .robot-dialogue, .robot-stage-dialogue').forEach(prepareBubble);
  quest = document.getElementById('robot-quest');
  MISSIONS.forEach(label => {
    const item = document.createElement('li');
    const number = document.createElement('span');
    item.append(number, document.createTextNode(label));
    quest.querySelector('ol').append(item);
  });
  document.getElementById('robot-intro-skip').addEventListener('click', () => closeIntro());
  document.getElementById('robot-intro-choose').addEventListener('click', () => closeIntro());
  intro.addEventListener('cancel', event => {
    event.preventDefault();
    closeIntro();
  });
  document.querySelectorAll('[data-robot-voice]').forEach(button => {
    button.hidden = !speech;
    button.addEventListener('click', () => {
      voiceOn = !voiceOn;
      document.querySelectorAll('[data-robot-voice]').forEach(control => {
        control.textContent = voiceOn ? 'Silenciar Robot' : 'Ouvir Robot';
        control.setAttribute('aria-pressed', String(voiceOn));
      });
      if (voiceOn) speak(currentLine);
      else cancelSpeech();
    });
  });
  document.addEventListener('kriart:stepchange', ({ detail }) => {
    if (intro.open) closeIntro(false);
    clearInterval(typingTimer);
    cancelSpeech();
    activeStep = detail.stepId;
    showMission(activeStep);
    if (activeStep === 'step-cause' && !introSeen) enterIntro();
    else if (SCRIPT[activeStep]) robotSay(SCRIPT[activeStep].line);
  });
  document.addEventListener('kriart:robotstage', ({ detail }) => {
    if (activeStep === 'step-generating') robotSay(detail.line);
  });
  const settleMotion = () => {
    if (!still()) return;
    if (intro.open) invitation();
    else if (currentLine) robotSay(currentLine);
  };
  reduceMotion.addEventListener('change', settleMotion);
  document.getElementById('robot-motion-toggle').addEventListener('click', settleMotion);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelSpeech();
      clearInterval(typingTimer);
      const target = dialogueTarget();
      if (target) target.querySelector('.robot-dialogue-text').textContent = currentLine;
      // A returning visitor sees the invitation, never a delayed landing.
      if (intro.open) invitation();
    }
  });
  window.addEventListener('pagehide', () => { clearIntroTimers(); clearInterval(typingTimer); cancelSpeech(); });
}
