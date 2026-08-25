/**
 * ui.js — Helpers de UI, animações e notificações do Kriart.
 */

/** SVG icons for toast notifications */
const TOAST_ICONS = {
  success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  warning: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
};

/** SVG status icons for generation steps */
const GEN_STATUS = {
  pending: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  active: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
  done: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
};

/**
 * Mostra um step e esconde os outros.
 * @param {string} stepId - ID do elemento do step (ex: 'step-welcome')
 */
export function showStep(stepId) {
  const allSteps = document.querySelectorAll('.step');
  allSteps.forEach(s => s.classList.remove('active'));
  const target = document.getElementById(stepId);
  if (target) {
    target.classList.add('active');
    // Timeout garante que o display: block foi aplicado antes de dar o scroll
    setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, 10);
  }
}

/**
 * Atualiza a barra de progresso e os indicadores de step.
 * @param {number} percent - Percentual (0-100)
 * @param {number} stepNumber - Step atual (1-5)
 */
export function setProgress(percent, stepNumber) {
  const bar = document.getElementById('progress-bar');
  if (bar) bar.style.width = `${percent}%`;

  const steps = document.querySelectorAll('.prog-step');
  steps.forEach((s, i) => {
    const sn = i + 1;
    s.classList.remove('active', 'done');
    if (sn < stepNumber) s.classList.add('done');
    else if (sn === stepNumber) s.classList.add('active');
  });
}

/**
 * Exibe um toast de notificação.
 * @param {string} message - Mensagem a exibir
 * @param {'info'|'success'|'error'|'warning'} type - Tipo do toast
 * @param {number} duration - Duração em ms (padrão: 4000)
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icon = TOAST_ICONS[type] || TOAST_ICONS.info;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Exibe mensagem de erro amigável.
 * @param {string} message
 */
export function showError(message) {
  showToast(message, 'error', 5000);
}

/**
 * Exibe mensagem de sucesso.
 * @param {string} message
 */
export function showSuccess(message) {
  showToast(message, 'success');
}

/**
 * Anima a entrada de um elemento.
 * @param {HTMLElement} element
 */
export function animateIn(element) {
  if (!element) return;
  element.style.opacity = '0';
  element.style.transform = 'translateY(16px)';
  element.style.transition = 'all 0.4s cubic-bezier(0.4,0,0.2,1)';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    });
  });
}

/**
 * Anima a saída de um elemento.
 * @param {HTMLElement} element
 * @param {Function} callback - Executado após a animação
 */
export function animateOut(element, callback) {
  if (!element) { if (callback) callback(); return; }
  element.style.transition = 'all 0.3s cubic-bezier(0.4,0,0.2,1)';
  element.style.opacity = '0';
  element.style.transform = 'translateY(-16px)';
  setTimeout(() => {
    if (callback) callback();
  }, 300);
}

/**
 * Marca um passo de geração como ativo.
 * @param {number} stepNum - 1 a 4
 */
export function setGenStep(stepNum, status = 'active') {
  const step = document.getElementById(`gen-step-${stepNum}`);
  if (!step) return;
  step.classList.remove('active', 'done');
  step.classList.add(status);
  const statusEl = step.querySelector('.gen-step-status');
  if (statusEl) {
    statusEl.innerHTML = GEN_STATUS[status] || GEN_STATUS.pending;
  }
}

/**
 * Atualiza a mensagem animada durante a geração.
 * @param {string} message
 */
export function setGeneratingMessage(message) {
  const el = document.getElementById('generating-message');
  if (el) {
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = message;
      el.style.opacity = '1';
    }, 200);
  }
}

/**
 * Mostra o painel de erro no step de geração.
 * @param {string} message
 */
export function showGenError(message) {
  const errDiv = document.getElementById('gen-error');
  const errMsg = document.getElementById('gen-error-msg');
  if (errDiv) errDiv.classList.remove('hidden');
  if (errMsg) errMsg.textContent = message;
}

/**
 * Esconde o painel de erro no step de geração.
 */
export function hideGenError() {
  const errDiv = document.getElementById('gen-error');
  if (errDiv) errDiv.classList.add('hidden');
}
