const W = 'https://jt-workout-worke.james-thornton88.workers.dev';
const SONNET = 'claude-sonnet-4-6';
const HAIKU  = 'claude-haiku-4-5-20251001';

async function api(action, params = {}) {
  const url = new URL(W);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url.toString());
  return r.json();
}

async function apiPost(body) {
  const r = await fetch(W, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}

async function claude(system, messages, model) {
  model = model || HAIKU;
  const r = await apiPost({ action: 'claude', system, messages, model });
  return r.text || '';
}
