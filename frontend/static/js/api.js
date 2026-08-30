/**
 * api.js — Camada de comunicação com o backend Faísca.
 */
const API_BASE = '';

async function apiPost(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Erro ${res.status}`);
  }
  return res.json();
}

async function apiGet(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`);
  if (!res.ok) throw new Error(`Erro ${res.status}`);
  return res.json();
}

async function apiPatch(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Erro ${res.status}`);
  }
  return res.json();
}

export const API = {
  startSession: () => apiPost('/api/session/start', {}),
  getSession: (id) => apiGet(`/api/session/${id}`),
  updateSession: (id, data) => apiPatch(`/api/session/${id}`, data),
  listCampaigns: () => apiGet('/api/campaigns/'),
  getCampaign: (id) => apiGet(`/api/campaigns/${id}`),
  chat: (sessionId, input, context) =>
    apiPost('/api/generate/chat', { session_id: sessionId, user_input: input, context }),
  generatePrompt: (sessionId) =>
    apiPost('/api/generate/prompt', { session_id: sessionId }),
  generateImage: (sessionId) =>
    apiPost('/api/generate/image', { session_id: sessionId }),
  createPolaroid: (sessionId, name) =>
    apiPost('/api/polaroid/create', { session_id: sessionId, participant_name: name }),
  getPolaroid: (id) => apiGet(`/api/polaroid/${id}`),
  printStatus: () => apiGet('/api/print/status'),
};
