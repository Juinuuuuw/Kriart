/**
 * visual.js — Step de escolhas visuais.
 */
import { showStep, setProgress, showToast } from '../ui.js';
import { API } from '../api.js';

let selectedStyle = null;
let selectedMood = null;

/**
 * Inicializa o step de escolhas visuais.
 * @param {object} state - Estado global da aplicação
 */
export function initVisualStep(state) {
  selectedStyle = null;
  selectedMood = null;

  const confirmBtn = document.getElementById('btn-confirm-visual');
  if (confirmBtn) confirmBtn.disabled = true;

  setupStyleSelector();
  setupMoodSelector();

  function checkCanProceed() {
    if (confirmBtn) confirmBtn.disabled = !(selectedStyle && selectedMood);
  }

  function setupStyleSelector() {
    const cards = document.querySelectorAll('.style-card');
    cards.forEach(card => {
      card.onclick = () => {
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedStyle = card.dataset.value;
        checkCanProceed();
      };
    });
  }

  function setupMoodSelector() {
    const btns = document.querySelectorAll('.mood-btn');
    btns.forEach(btn => {
      btn.onclick = () => {
        btns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedMood = btn.dataset.value;
        checkCanProceed();
      };
    });
  }

  // Confirmar visual
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      if (!selectedStyle || !selectedMood) {
        showToast('Selecione um estilo e um humor antes de continuar!', 'warning');
        return;
      }

      const nameInput = document.getElementById('input-name');
      const participantName = nameInput?.value.trim() || null;

      state.visualStyle = selectedStyle;
      state.mood = selectedMood;
      state.participantName = participantName;

      // Atualiza sessão
      try {
        await API.updateSession(state.sessionId, {
          visual_style: selectedStyle,
          mood: selectedMood,
          participant_name: participantName,
          step: 'generating',
        });
      } catch (e) {
        console.warn('Aviso ao atualizar sessão:', e.message);
      }

      import('./generating.js').then(m => m.startGeneration(state));
      showStep('step-generating');
      setProgress(80, 4);
    };
  }

  // Botão voltar
  const backBtn = document.getElementById('btn-back-message');
  if (backBtn) {
    backBtn.onclick = () => {
      showStep('step-message');
      setProgress(40, 2);
    };
  }
}
