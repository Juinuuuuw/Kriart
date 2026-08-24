/**
 * message.js — Step de criação de mensagem.
 */
import { showStep, setProgress, showError, showToast, animateIn } from '../ui.js';
import { API } from '../api.js';

/**
 * Inicializa o step de mensagem.
 * @param {object} state - Estado global da aplicação
 */
export function initMessageStep(state) {
  const messageInput = document.getElementById('input-message');
  const phraseInput = document.getElementById('input-phrase');
  const msgCount = document.getElementById('msg-count');
  const phraseCount = document.getElementById('phrase-count');
  const confirmBtn = document.getElementById('btn-confirm-message');
  const askAiBtn = document.getElementById('btn-ask-ai');
  const suggestionArea = document.getElementById('ai-suggestion-area');
  const suggestionText = document.getElementById('ai-suggestion-text');
  const useSuggestionBtn = document.getElementById('btn-use-suggestion');

  // Limpa campos anteriores
  if (messageInput) messageInput.value = '';
  if (phraseInput) phraseInput.value = '';
  if (confirmBtn) confirmBtn.disabled = true;
  if (suggestionArea) suggestionArea.classList.add('hidden');

  function updateCounts() {
    const msgLen = messageInput?.value.length || 0;
    const phraseLen = phraseInput?.value.length || 0;
    if (msgCount) msgCount.textContent = msgLen;
    if (phraseCount) phraseCount.textContent = phraseLen;

    const valid = msgLen >= 3 && phraseLen >= 3;
    if (confirmBtn) confirmBtn.disabled = !valid;
  }

  if (messageInput) messageInput.addEventListener('input', updateCounts);
  if (phraseInput) phraseInput.addEventListener('input', updateCounts);

  // Pedir ajuda à IA
  if (askAiBtn) {
    askAiBtn.onclick = async () => {
      const msg = messageInput?.value.trim();
      if (!msg || msg.length < 3) {
        showToast('Escreva pelo menos uma ideia antes de pedir ajuda à IA!', 'warning');
        return;
      }

      askAiBtn.disabled = true;
      const originalHTML = askAiBtn.innerHTML;
      askAiBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Pensando...`;

      try {
        const campaignContext = state.campaign ? `Campanha: ${state.campaign.nome}. Objetivo: ${state.campaign.objetivo}.` : '';
        const prompt = `${campaignContext}\n\nIdeia do participante: "${msg}"\n\nCrie uma frase curta e inspiradora (máximo 15 palavras) para esta campanha educativa.`;
        const result = await API.chat(state.sessionId, prompt);
        const suggestion = result.response?.trim();

        if (suggestion) {
          if (suggestionText) suggestionText.textContent = suggestion;
          if (suggestionArea) suggestionArea.classList.remove('hidden');
          animateIn(suggestionArea);
        }
      } catch (e) {
        showError('Não foi possível obter sugestão da IA. ' + e.message);
      } finally {
        askAiBtn.disabled = false;
        askAiBtn.innerHTML = originalHTML;
      }
    };
  }

  // Usar sugestão
  if (useSuggestionBtn) {
    useSuggestionBtn.onclick = () => {
      const suggestion = suggestionText?.textContent;
      if (suggestion && phraseInput) {
        phraseInput.value = suggestion.substring(0, 60);
        updateCounts();
        if (suggestionArea) suggestionArea.classList.add('hidden');
        showToast('Sugestão aplicada!', 'success');
      }
    };
  }

  // Confirmar mensagem
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      const message = messageInput?.value.trim();
      const phrase = phraseInput?.value.trim();

      if (!message || !phrase) return;

      state.userMessage = message;
      state.userPhrase = phrase;

      // Atualiza sessão no backend
      try {
        await API.updateSession(state.sessionId, {
          user_message: message,
          user_phrase: phrase,
          campaign_id: state.campaign?.id,
          step: 'visual_choices',
        });
      } catch (e) {
        console.warn('Aviso: não foi possível atualizar sessão:', e.message);
      }

      import('./visual.js').then(m => m.initVisualStep(state));
      showStep('step-visual');
      setProgress(60, 3);
    };
  }

  // Botão voltar
  const backBtn = document.getElementById('btn-back-campaign');
  if (backBtn) {
    backBtn.onclick = () => {
      showStep('step-campaign');
      setProgress(20, 1);
    };
  }
}
