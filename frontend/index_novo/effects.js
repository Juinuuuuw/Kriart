/**
 * effects.js — Animações de "alimentar o sistema".
 *
 * Em vez da troca abrupta de tela a cada escolha, cada seleção do usuário
 * (campanha, estilo, humor, mensagem, frase, nome) vira um pequeno "chip"
 * que voa da tela até um coletor flutuante. Quando a geração começa, todos
 * os chips coletados voam de volta e se fundem no orbe de IA.
 *
 * Módulo autocontido: não depende de nem altera campaign.js / message.js /
 * visual.js / generating.js — escuta os cliques via delegação de eventos
 * no document, então funciona com qualquer step já existente.
 */

const CHIP_META = {
  campaign: { icon: '🎯', label: 'Campanha' },
  style:    { icon: '🎨', label: 'Estilo' },
  mood:     { icon: '😊', label: 'Emoção' },
  message:  { icon: '💬', label: 'Cena' },
  phrase:   { icon: '✏️', label: 'Frase' },
  name:     { icon: '👤', label: 'Nome' },
};

const collectedChips = new Map(); // category -> chip element

/** Garante que a barra coletora exista no DOM (cria uma vez, na primeira chamada). */
function ensureCollector() {
  let el = document.getElementById('choice-collector');
  if (!el) {
    el = document.createElement('div');
    el.id = 'choice-collector';
    el.className = 'hidden';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <span class="collector-title">Alimentando a IA</span>
      <div class="collector-chips" id="collector-chips"></div>
    `;
    document.body.appendChild(el);
  }
  return el;
}

function getChipsContainer() {
  ensureCollector();
  return document.getElementById('collector-chips');
}

/**
 * Cria um "fantasma" visual que voa de um elemento de origem até um de destino.
 * @returns {Promise<void>} resolve quando a animação termina
 */
function flyGhost(fromEl, toEl, icon = '✨') {
  if (!fromEl || !toEl) return Promise.resolve();
  const fromRect = fromEl.getBoundingClientRect();
  const toRect = toEl.getBoundingClientRect();

  // Elemento fora da tela (ex: display:none) não tem posição válida — ignora
  if (fromRect.width === 0 && fromRect.height === 0) return Promise.resolve();

  const ghost = document.createElement('div');
  ghost.className = 'flying-chip';
  ghost.textContent = icon;
  ghost.style.left = `${fromRect.left + fromRect.width / 2 - 18}px`;
  ghost.style.top = `${fromRect.top + fromRect.height / 2 - 18}px`;
  document.body.appendChild(ghost);

  const dx = (toRect.left + toRect.width / 2) - (fromRect.left + fromRect.width / 2);
  const dy = (toRect.top + toRect.height / 2) - (fromRect.top + fromRect.height / 2);

  let anim;
  try {
    anim = ghost.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 50}px) scale(0.85)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.25)`, opacity: 0 },
      ],
      { duration: 650, easing: 'cubic-bezier(0.4,0,0.2,1)' }
    );
  } catch (e) {
    // Web Animations API indisponível: some o fantasma sem animar
    ghost.remove();
    return Promise.resolve();
  }

  return new Promise(resolve => {
    anim.onfinish = () => { ghost.remove(); resolve(); };
    anim.oncancel = () => { ghost.remove(); resolve(); };
  });
}

/** Cria ou atualiza o chip persistente de uma categoria dentro do coletor. */
function upsertChip(category, text) {
  const meta = CHIP_META[category] || { icon: '✨', label: category };
  const container = getChipsContainer();
  let chip = collectedChips.get(category);
  if (!chip) {
    chip = document.createElement('div');
    chip.className = 'collector-chip';
    container.appendChild(chip);
    collectedChips.set(category, chip);
  }
  const safeText = (text || meta.label).toString();
  chip.innerHTML = `<span class="chip-icon">${meta.icon}</span><span class="chip-text">${escapeHtml(safeText)}</span>`;
  chip.classList.remove('chip-pop');
  void chip.offsetWidth; // força reflow para reiniciar a animação
  chip.classList.add('chip-pop');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncate(str, n) {
  if (!str) return '';
  return str.length > n ? `${str.slice(0, n - 1)}…` : str;
}

/** Anima uma escolha saindo de `sourceEl` e chegando no coletor, como "alimentando o sistema". */
export async function collectChoice(category, sourceEl, text) {
  const collector = ensureCollector();
  collector.classList.remove('hidden');
  await flyGhost(sourceEl, collector, (CHIP_META[category] || {}).icon || '✨');
  upsertChip(category, text);
}

/** Faz todos os chips coletados voarem e se fundirem no orbe de geração. */
export function convergeIntoOrb() {
  const orb = document.querySelector('.ai-orb');
  const container = document.getElementById('collector-chips');
  if (!orb || !container) return;

  const chips = Array.from(container.children);
  if (chips.length === 0) return;

  chips.forEach((chip, i) => {
    setTimeout(() => {
      const icon = chip.querySelector('.chip-icon')?.textContent || '✨';
      flyGhost(chip, orb, icon).then(() => {
        orb.classList.remove('orb-absorb');
        void orb.offsetWidth;
        orb.classList.add('orb-absorb');
      });
      chip.style.transition = 'opacity 0.2s ease';
      chip.style.opacity = '0';
    }, i * 140);
  });

  setTimeout(() => {
    container.innerHTML = '';
    collectedChips.clear();
    ensureCollector().classList.add('hidden');
  }, chips.length * 140 + 700);
}

/** Limpa o coletor (usado ao voltar para o início/campanha). */
function resetCollector() {
  const container = document.getElementById('collector-chips');
  if (container) container.innerHTML = '';
  collectedChips.clear();
  const el = document.getElementById('choice-collector');
  if (el) el.classList.add('hidden');
}

/** Liga toda a delegação de eventos. Chame uma vez, na inicialização do app. */
export function initChoiceEffects() {
  ensureCollector();

  // Seleção de cartões (campanha, estilo) e botões (humor) — captura no clique
  document.addEventListener('click', (e) => {
    const campaignCard = e.target.closest('.campaign-card');
    if (campaignCard) {
      const name = campaignCard.querySelector('.campaign-name')?.textContent?.trim();
      collectChoice('campaign', campaignCard, name);
      return;
    }

    const styleCard = e.target.closest('.style-card');
    if (styleCard) {
      const name = styleCard.querySelector('.style-name')?.textContent?.trim();
      collectChoice('style', styleCard, name);
      return;
    }

    const moodBtn = e.target.closest('.mood-btn');
    if (moodBtn) {
      const name = moodBtn.textContent?.trim();
      collectChoice('mood', moodBtn, name);
      return;
    }
  }, true);

  // Mensagem/frase e nome são texto livre — coletamos ao confirmar cada etapa
  document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-confirm-message')) {
      const msgEl = document.getElementById('input-message');
      const phraseEl = document.getElementById('input-phrase');
      if (msgEl && msgEl.value.trim()) collectChoice('message', msgEl, truncate(msgEl.value.trim(), 26));
      if (phraseEl && phraseEl.value.trim()) collectChoice('phrase', phraseEl, truncate(phraseEl.value.trim(), 26));
    }
    if (e.target.closest('#btn-confirm-visual')) {
      const nameEl = document.getElementById('input-name');
      if (nameEl && nameEl.value.trim()) collectChoice('name', nameEl, truncate(nameEl.value.trim(), 20));
    }
  }, true);

  // Ao entrar na tela de geração, funde tudo no orbe. Ao voltar ao início, limpa.
  document.addEventListener('kriart:stepchange', (e) => {
    const stepId = e.detail && e.detail.stepId;
    if (stepId === 'step-generating') {
      setTimeout(() => convergeIntoOrb(), 380);
    } else if (stepId === 'step-welcome' || stepId === 'step-campaign') {
      resetCollector();
    }
  });
}
