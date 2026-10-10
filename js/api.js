const WORKERS = {
  prod:    'https://jt-workout-worke.james-thornton88.workers.dev',
  staging: 'https://jt-workout-worke-staging.james-thornton88.workers.dev',
};
// ?env=prod|staging overrides; otherwise local preview → staging, GitHub Pages → prod
const ENV = (() => {
  const q = new URLSearchParams(location.search).get('env');
  if (q === 'prod' || q === 'staging') return q;
  return /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? 'staging' : 'prod';
})();
const W = WORKERS[ENV];
// Separate token per env — staging has its own APP_TOKEN secret
const TOKEN_KEY = ENV === 'prod' ? 'appToken' : 'appToken_' + ENV;

if (ENV !== 'prod') {
  document.addEventListener('DOMContentLoaded', () => {
    const b = document.createElement('div');
    b.textContent = ENV.toUpperCase();
    b.style.cssText = 'position:fixed;top:4px;right:4px;z-index:9999;padding:2px 6px;border-radius:4px;background:var(--amber);color:#000;font:700 9px var(--font-ui);letter-spacing:1px;pointer-events:none;';
    document.body.appendChild(b);
  });
}
const SONNET = 'claude-opus-4-8';
const HAIKU  = 'claude-haiku-4-5-20251001';

async function api(action, params = {}) {
  const url = new URL(W);
  url.searchParams.set('action', action);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url.toString());
  return r.json();
}

// One shared prompt — concurrent 401s wait on it instead of each prompting
let tokenPrompt = null;
let tokenRejected = false;  // after one rejection, stop prompting until reload
function askForToken(rejected) {
  if (!tokenPrompt) {
    tokenPrompt = Promise.resolve().then(() => {
      const msg = (rejected ? 'Token rejected by the ' + ENV + ' worker — check it matches APP_TOKEN.\n' : '')
        + 'App token required for ' + ENV + ' (one-time per device):';
      const entered = (prompt(msg) || '').trim();
      if (entered) localStorage.setItem(TOKEN_KEY, entered);
      return entered;
    }).finally(() => { tokenPrompt = null; });
  }
  return tokenPrompt;
}

async function apiPost(body, retried = false) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers['X-App-Token'] = token;
  const r = await fetch(W, { method: 'POST', headers, body: JSON.stringify(body) });
  if (r.status === 401 && !retried && !tokenRejected) {
    // Another request may have just stored a fresh token — retry with it before prompting
    const fresh = localStorage.getItem(TOKEN_KEY);
    if (fresh && fresh !== token) return apiPost(body, true);
    if (token) localStorage.removeItem(TOKEN_KEY);
    if (await askForToken(!!token)) return apiPost(body, true);
  } else if (r.status === 401 && retried && !tokenRejected) {
    tokenRejected = true;
    localStorage.removeItem(TOKEN_KEY);
    alert('Token rejected by the ' + ENV + ' worker — it doesn\'t match APP_TOKEN. Reload to try again.');
  }
  return r.json();
}

async function claude(system, messages, model) {
  model = model || HAIKU;
  const r = await apiPost({ action: 'claude', system, messages, model });
  return r.text || '';
}
