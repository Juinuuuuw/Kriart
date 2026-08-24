/**
 * result.js — Step de resultado e Polaroid final.
 */
import { showToast, showError, animateIn } from '../ui.js';
import { API } from '../api.js';

/**
 * Exibe o resultado final com o Polaroid.
 * @param {object} state - Estado global da aplicação
 */
export async function showResult(state) {
  const polaroid = state.polaroidData;

  if (!polaroid) {
    showError('Erro ao carregar o Polaroid.');
    return;
  }

  // Atualiza preview do Polaroid
  const img = document.getElementById('polaroid-image');
  const sketchImg = document.getElementById('polaroid-sketch-image');
  
  if (img && polaroid.polaroid_url) {
    img.src = polaroid.polaroid_url;
  }
  
  if (sketchImg && polaroid.polaroid_sketch_url) {
    sketchImg.src = polaroid.polaroid_sketch_url;
  }

  // Frase e nome
  const phraseEl = document.getElementById('result-phrase');
  if (phraseEl) phraseEl.textContent = `"${polaroid.phrase || state.userPhrase || ''}"`;

  const nameEl = document.getElementById('result-name');
  if (nameEl) nameEl.textContent = polaroid.participant_name ? `— ${polaroid.participant_name}` : '';

  // Info da campanha
  const campaignEl = document.getElementById('result-campaign');
  if (campaignEl) {
    const campaign = state.campaigns?.find(c => c.id === polaroid.campaign_id);
    campaignEl.textContent = campaign?.nome || polaroid.campaign_id || '';
  }

  // Status de impressão
  try {
    const printSt = await API.printStatus();
    const printText = document.getElementById('print-status-text');
    if (printText) {
      if (printSt.ready_to_print) {
        printText.textContent = 'Pronto para imprimir!';
        printText.style.color = '#10B981';
      } else {
        const remaining = printSt.batch_size - printSt.pending;
        printText.textContent = `Faltam ${remaining} para imprimir em lote`;
      }
    }
  } catch (e) {
    console.warn('Status de impressão indisponível:', e.message);
  }

  // Botão de download
  const dlBtn = document.getElementById('btn-download');
  if (dlBtn && polaroid.polaroid_url) {
    dlBtn.href = polaroid.polaroid_url;
    dlBtn.download = `kriart_polaroid_${polaroid.id}.png`;
  }

  const dlSketchBtn = document.getElementById('btn-download-sketch');
  if (dlSketchBtn && polaroid.polaroid_sketch_url) {
    dlSketchBtn.href = polaroid.polaroid_sketch_url;
    dlSketchBtn.download = `kriart_polaroid_${polaroid.id}_sketch.png`;
  }

  // Toast de sucesso
  showToast('Sua arte foi criada com sucesso!', 'success', 5000);

  // Anima os polaroids
  const polaroidCards = document.querySelectorAll('.polaroid-card');
  polaroidCards.forEach((card, index) => {
    setTimeout(() => animateIn(card), index * 200);
  });

  // Botão nova criação
  const newBtn = document.getElementById('btn-new-creation');
  if (newBtn) {
    newBtn.onclick = () => {
      window.location.reload();
    };
  }
}

function getFilename(path) {
  if (!path) return '';
  return path.split(/[\\/]/).pop();
}
