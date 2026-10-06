// The same Robot accompanies choices, real generation stages and the result.
import { initRobotStory, robotSay } from './robot-story.js?v=3';
const ROOT = '/static/img/robot/';
const POSES = {
  happy: 'RobotFrontHappy.png',
  celebrate: 'RobotFrontSuperHappy.png',
  looking: 'RobotSideLooking.png',
  question: 'RobotSideQuestion.png',
  thinking: 'RobotSideThinking.png',
  wave: 'RobotWaving.png',
  inspired: 'RobotInspired.png',
  heart: 'RobotHeart.png',
  victory: 'RobotVictory.png',
};
const POSE_LABELS = {
  wave: 'Robot acenando',
  inspired: 'Robot tendo uma ideia',
  heart: 'Robot segurando um coração',
  victory: 'Robot celebrando sua conquista',
  celebrate: 'Robot comemorando',
};
const STAGES = {
  prompt: ['Organizando sua ideia...', 'O Robot está preparando a composição da sua causa.', 0],
  image: ['Sua ideia está ganhando vida...', 'A IA está desenhando sua arte. Pode levar um pouquinho.', 1],
  polaroid: ['Preparando seu Polaroid...', 'Agora estamos juntando a arte, a frase e sua assinatura.', 2],
  ready: ['Sua criação está pronta!', 'Uma ideia sua, uma faísca de transformação.', 3],
  error: ['Vamos tentar de novo?', 'Sua ideia continua aqui. Toque em tentar novamente para continuar.', -1],
};
const TIMELINE = [
  ...Array.from({ length: 22 }, (_, i) => 92 + i),
  112, 111, 110, 109, 108, 109, 110, 111, 112, 113,
  114, 115, 116, 117, 118, 119, 120,
  119, 118, 117, 116, 115, 116, 117, 118, 119, 120,
];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let paused = false;
let stage = 'prompt';
let activeStep = '';
let frameRequest = 0;
let frameTime = 0;
let poseTime = 0;
let frameIndex = 0;
let reactionUntil = 0;
let reactionPose = 'celebrate';
const frames = new Map();
const collected = new Set();

function setPose(img, pose) {
  if (!img || img.dataset.pose === pose) return;
  img.dataset.pose = pose;
  img.src = ROOT + POSES[pose];
  img.alt = POSE_LABELS[pose] || 'Robot, seu companheiro de criação';
}

function stepPose() {
  if (activeStep === 'step-cause') return 'wave';
  if (activeStep === 'step-idea') return 'question';
  if (activeStep === 'step-style') return 'inspired';
  if (activeStep === 'step-phrase') return 'heart';
  if (activeStep === 'step-result') return 'victory';
  return 'happy';
}

function paintPose(now) {
  const section = document.getElementById(activeStep);
  const reacting = now < reactionUntil;
  section?.querySelectorAll('.mascot-img').forEach(img => {
    setPose(img, reacting ? reactionPose : stepPose());
    img.classList.toggle('robot-cheering', reacting && ['celebrate', 'victory'].includes(reactionPose));
  });
  if (activeStep !== 'step-generating') return;
  const img = document.getElementById('gen-robot-frame');
  img.classList.toggle('robot-cheering', reacting && ['celebrate', 'victory'].includes(reactionPose));
  if (reacting) setPose(img, reactionPose);
  else if (stage === 'image' || stage === 'polaroid') {
    const frame = frames.get(TIMELINE[frameIndex]);
    if (frame?.complete && frame.naturalWidth) {
      img.dataset.pose = 'painting';
      if (img.getAttribute('src') !== frame.getAttribute('src')) img.src = frame.src;
      img.alt = 'Robot pintando sua arte';
    } else setPose(img, 'thinking');
  } else setPose(img, stage === 'error' ? 'question' : stage === 'ready' ? 'victory' : 'thinking');
}

function tick(now) {
  if (now - frameTime > 135) {
    frameTime = now;
    frameIndex = (frameIndex + 1) % TIMELINE.length;
    paintPose(now);
  }
  // A brief change of expression makes the static poses feel alive, too.
  if (now - poseTime > 4800 && now >= reactionUntil && activeStep !== 'step-generating') {
    poseTime = now;
    reactionUntil = now + 1100;
    const idlePoses = {
      'step-cause': 'looking',
      'step-idea': 'inspired',
      'step-style': 'happy',
      'step-phrase': 'thinking',
      'step-result': 'celebrate',
    };
    reactionPose = idlePoses[activeStep] || 'wave';
  }
  frameRequest = requestAnimationFrame(tick);
}

function syncMotion() {
  cancelAnimationFrame(frameRequest);
  const still = paused || reducedMotion.matches;
  document.documentElement.classList.toggle('robot-motion-off', still);
  const button = document.getElementById('robot-motion-toggle');
  button.textContent = still ? 'Robot pausado' : 'Pausar Robot';
  button.setAttribute('aria-pressed', String(still));
  button.disabled = reducedMotion.matches;
  if (!still && !document.hidden && document.querySelector(`#${activeStep} .mascot-img, #${activeStep} #gen-robot-frame`)) {
    frameTime = performance.now();
    poseTime = frameTime;
    frameRequest = requestAnimationFrame(tick);
  }
  paintPose(performance.now());
}

export function reactRobot(message, pose = 'celebrate') {
  reactionPose = POSES[pose] ? pose : 'celebrate';
  reactionUntil = performance.now() + 1400;
  if (message) robotSay(message);
  paintPose(performance.now());
}

export function setRobotStage(next) {
  if (!STAGES[next]) return;
  stage = next;
  const [title, subtitle, index] = STAGES[next];
  document.getElementById('generating-title').textContent = title;
  document.getElementById('generating-subtitle').textContent = subtitle;
  document.querySelectorAll('[data-robot-stage]').forEach((el, i) => {
    el.classList.toggle('is-done', i < index);
    el.classList.toggle('is-current', i === index);
    if (i === index) el.setAttribute('aria-current', 'step');
    else el.removeAttribute('aria-current');
  });
  document.getElementById('robot-game').hidden = next === 'error';
  reactionUntil = 0;
  paintPose(performance.now());
  document.dispatchEvent(new CustomEvent('kriart:robotstage', { detail: { line: subtitle } }));
}

export function initRobot() {
  Object.values(POSES).forEach(file => { const img = new Image(); img.src = ROOT + file; });
  document.querySelectorAll('.mascot-img').forEach(img => { img.draggable = false; });
  document.addEventListener('kriart:stepchange', ({ detail }) => {
    activeStep = detail.stepId;
    reactionUntil = 0;
    if (activeStep === 'step-style' && !frames.size) {
      for (let i = 92; i <= 120; i++) {
        const img = new Image();
        img.src = `/static/img/robot_painting/frame_${String(i).padStart(3, '0')}.png`;
        frames.set(i, img);
      }
    }
    syncMotion();
  });
  document.addEventListener('input', event => {
    if (!event.target.matches('#input-idea, #input-phrase')) return;
    reactionPose = 'thinking';
    reactionUntil = performance.now() + 1300;
    paintPose(performance.now());
  });
  document.querySelectorAll('[data-spark]').forEach(button => {
    button.addEventListener('click', () => {
      if (collected.has(button.dataset.spark)) return;
      collected.add(button.dataset.spark);
      button.setAttribute('aria-disabled', 'true');
      button.setAttribute('aria-label', `${button.dataset.spark}: faísca coletada`);
      button.classList.add('is-collected');
      const complete = collected.size === 5;
      document.getElementById('spark-feedback').textContent = complete
        ? '5 de 5 · Equipe da transformação! O Robot comemora com você.'
        : `${collected.size} de 5 faíscas · ${button.dataset.spark} faz a diferença!`;
      document.getElementById('robot-game').classList.toggle('is-complete', complete);
      reactRobot(complete ? 'Cinco faíscas! Essa equipe vai longe. Nossa arte continua sendo preparada!' : `${button.dataset.spark}! Essa faísca faz parte da nossa missão.`, complete ? 'victory' : collected.size % 2 ? 'inspired' : 'heart');
    });
  });
  document.getElementById('robot-motion-toggle').addEventListener('click', () => {
    paused = !paused;
    syncMotion();
  });
  reducedMotion.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', syncMotion);
  activeStep = document.querySelector('.step.active')?.id || 'step-welcome';
  syncMotion();
  initRobotStory();
}
