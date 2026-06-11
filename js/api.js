const W = 'https://jt-workout-worke.james-thornton88.workers.dev';
const SONNET = 'claude-opus-4-8';
const HAIKU  = 'claude-haiku-4-5-20251001';

async function api(action, params = {}) {
  const url = new URL(W);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url.toString());
  return r.json();
}

async function apiPost(body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('appToken');
  if (token) headers['X-App-Token'] = token;
  const r = await fetch(W, { method: 'POST', headers, body: JSON.stringify(body) });
  if (r.status === 401) {
    const entered = prompt('App token required (one-time per device):');
    if (entered && entered.trim()) {
      localStorage.setItem('appToken', entered.trim());
      return apiPost(body);
    }
  }
  return r.json();
}

async function claude(system, messages, model) {
  model = model || HAIKU;
  const r = await apiPost({ action: 'claude', system, messages, model });
  return r.text || '';
}
