let sType = "Coach's Workout", loc = 'Home';
let preSleep = 3, preEnergy = 3, preSoreness = 3;
let pendingProgressions = JSON.parse(localStorage.getItem('pendingProgressions') || '[]');
let appliedProgressions = new Set(JSON.parse(localStorage.getItem('appliedProgressions') || '[]'));

function adjustSignal(key, delta) {
  if (key === 'sleep')    { preSleep    = Math.min(5, Math.max(1, preSleep    + delta)); document.getElementById('sig-sleep').textContent    = preSleep; }
  if (key === 'energy')   { preEnergy   = Math.min(5, Math.max(1, preEnergy   + delta)); document.getElementById('sig-energy').textContent   = preEnergy; }
  if (key === 'soreness') { preSoreness = Math.min(5, Math.max(1, preSoreness + delta)); document.getElementById('sig-soreness').textContent = preSoreness; }
  const el = document.getElementById('sig-' + key);
  const val = key === 'sleep' ? preSleep : key === 'energy' ? preEnergy : preSoreness;
  el.style.color = val <= 2 ? 'var(--amber)' : val >= 4 ? 'var(--green)' : 'var(--text)';
  clearTimeout(window._signalTimer);
  window._signalTimer = setTimeout(() => autoRecommend(), 800);
}
let injuries = [], exercises = [], history = { sessions: [], sets: [] };
let plan = [], chatLog = [], sessionId = '', loggedSets = [], preNotes = '', coachMemo = '';
let bodyMetrics = [];
let isTyping = false;

async function loadBodyMetrics() {
  try { const r = await api('getBodyMetrics', { limit: 180 }); bodyMetrics = r.data || []; }
  catch (e) { console.log('bodyMetrics load failed:', e); }
}

function openWeighIn() {
  const latest = (bodyMetrics || []).find(m => m.weight_kg != null);
  const today = new Date().toISOString().slice(0, 10);
  const inp = 'width:100%;margin-top:6px;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-family:var(--font-display);font-size:20px;text-align:center;';
  const lbl = 'flex:1;font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.14em;';
  const ov = document.createElement('div');
  ov.className = 'modal-overlay';
  ov.id = 'weighin-overlay';
  ov.onclick = e => { if (e.target === ov) ov.remove(); };
  ov.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-title">Weigh-in</div>
      <div class="modal-sub">Saved against ${today}. Bodyfat is optional — log weight alone any day.</div>
      <div style="display:flex;gap:12px;margin-bottom:18px;">
        <label style="${lbl}">WEIGHT (KG)<input id="wi-weight" type="number" inputmode="decimal" step="0.1" value="${latest ? latest.weight_kg : ''}" style="${inp}"></label>
        <label style="${lbl}">BODYFAT %<input id="wi-bf" type="number" inputmode="decimal" step="0.1" placeholder="—" style="${inp}"></label>
      </div>
      <button class="modal-btn modal-btn-save" onclick="saveWeighIn()">Save</button>
      <button class="modal-btn modal-btn-cancel" onclick="document.getElementById('weighin-overlay').remove()">Cancel</button>
    </div>`;
  document.body.appendChild(ov);
  setTimeout(() => document.getElementById('wi-weight')?.focus(), 50);
}

async function saveWeighIn() {
  const w = parseFloat(document.getElementById('wi-weight').value);
  if (!w || isNaN(w)) { showToast('Enter a weight', 'error'); return; }
  const bfRaw = document.getElementById('wi-bf').value;
  const bf = bfRaw === '' ? null : parseFloat(bfRaw);
  try {
    const r = await apiPost({ action: 'logBodyMetric', data: { weight_kg: w, bodyfat_pct: bf } });
    if (r.error) throw new Error(typeof r.error === 'string' ? r.error : JSON.stringify(r.error));
    await loadBodyMetrics();
    document.getElementById('weighin-overlay')?.remove();
    showToast('Weigh-in saved', 'success');
    if (typeof renderBodyweightCard === 'function' && document.getElementById('s-progress')?.classList.contains('on')) {
      renderBodyweightCard();
    }
  } catch (e) {
    showToast('Save failed: ' + e.message, 'error');
  }
}

function buildHistStr() {
  if (!history.sets || !history.sets.length) return 'No recent history for ' + sType + '.';
  return 'Last ' + (history.sessions?.length || '?') + ' ' + sType + ' sessions:\n' +
    history.sets.map(s =>
      s.session_id.slice(0, 10) + ' | ' + s.exercise_id +
      ' S' + s.set_num + ': ' + s.reps + ' reps @ ' + s.weight_kg + 'kg' +
      (s.rir !== undefined && s.rir !== null ? ' RIR ' + s.rir : '') +
      (s.tempo ? ' ' + s.tempo : '') +
      (s.notes ? ' (' + s.notes + ')' : '')
    ).join('\n');
}

let sessionTimerInterval = null, sessionTimerStart = null;
let restTimerInterval = null, restTimerStart = null;
let lastRestDuration = null;

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return String(m).padStart(2,'0') + ':' + String(s % 60).padStart(2,'0');
}

function startSessionTimer() {
  sessionTimerStart = Date.now();
  sessionTimerInterval = setInterval(() => {
    const el = document.getElementById('session-timer');
    if (el) el.textContent = fmtTime(Date.now() - sessionTimerStart);
  }, 1000);
}

function stopSessionTimer() {
  clearInterval(sessionTimerInterval);
  sessionTimerInterval = null;
  document.getElementById('session-timer').textContent = '00:00';
}

function startRestTimer() {
  stopRestTimer();
  restTimerStart = Date.now();
  const el = document.getElementById('rest-timer');
  const btn = document.getElementById('rest-stop-btn');
  if (el) { el.textContent = '00:00'; el.classList.add('rest-active'); }
  if (btn) btn.style.display = 'block';
  restTimerInterval = setInterval(() => {
    if (el) el.textContent = fmtTime(Date.now() - restTimerStart);
  }, 1000);
}

function stopRestTimer() {
  if (restTimerStart) lastRestDuration = Math.floor((Date.now() - restTimerStart) / 1000);
  clearInterval(restTimerInterval);
  restTimerInterval = null;
  restTimerStart = null;
  const el = document.getElementById('rest-timer');
  const btn = document.getElementById('rest-stop-btn');
  if (el) { el.textContent = '--:--'; el.classList.remove('rest-active'); }
  if (btn) btn.style.display = 'none';
}

function stopAllTimers() {
  stopSessionTimer();
  stopRestTimer();
}

function isTrue(v) { return v === true || v === 1 || v === '1' || v === 'TRUE' || v === 'true'; }

const DEFAULT_USER_CONTEXT = `### Human Context & Identity
- Life State: Father of twin daughters. Sleep, recovery time, and schedule flexibility are highly volatile and unpredictable.
- Profession: Tech sales professional (Salesforce). High-stress, desk-bound individual contributor/leadership role. Days are dominated by screen time, deep focus, and strategic client management.
- Mindset: Training is a non-negotiable anchor for mental clarity and physical capability, not a chore. Pragmatic, data-literate, and values high-leverage efficiency.

### Environmental & Behavioral Realities
- The "Balcony Escape": Primary setup is a home balcony ring rack + kettlebells, though sessions also happen while travelling or at a gym — always defer to the session's stated Location and Kit over this default. Training is often squeezed into tight windows between work blocks or family duties, so it needs to be low-friction to start.
- Physical Stress Profile: Prolonged sitting from the desk job impacts hip and thoracic mobility. Mental fatigue from high-stakes sales cycles can heavily drain CNS energy, even if physical muscles are rested.

### Session Duration
- Hard cap: 45 minutes. This is a structural constraint, not a preference. At ~3 min/set including rest, that means 15 sets maximum per session. Plan density over volume.

### Coaching Directive (Contextual Application)
- Life-Adaptive Programming: Do not treat missed sessions or low-energy days as a lack of discipline. Contextualize performance against family and work stress.
- The "Desk Worker" Tax: Counteract desk-bound posture with hip, shoulder, and wrist prep — express this as an opening cue in the first exercise's notes, never as a separate plan exercise.`;

function getUserContext() {
  const stored = localStorage.getItem('user_context');
  return stored !== null ? stored : DEFAULT_USER_CONTEXT;
}
function userContextBlock() {
  const ctx = getUserContext();
  return ctx ? `\nATHLETE CONTEXT (always factor this in):\n${ctx}\n` : '';
}
function loadCoachBio() {
  const el = document.getElementById('coach-bio');
  if (el) el.value = getUserContext();
}

function goScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  document.getElementById(id).classList.add('on');
  if (id === 's-active' && sessionId) requestWakeLock();
  if (id === 's-idle') {
    const p = document.getElementById('override-panel');
    if (p) p.style.display = 'none';
  }
}

function toggleTheme() {
  const isB = document.documentElement.dataset.theme === 'b';
  document.documentElement.dataset.theme = isB ? '' : 'b';
  localStorage.setItem('jt-theme', isB ? 'a' : 'b');
  document.getElementById('theme-toggle').textContent = isB ? 'A' : 'B';
}
(function() {
  const stored = localStorage.getItem('jt-theme');
  if (stored === 'a') {
    document.documentElement.dataset.theme = '';
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = 'A';
  }
})();

function showToast(msg, type, duration) {
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' toast-' + type : '');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('on')));
  setTimeout(() => {
    t.classList.remove('on');
    setTimeout(() => t.remove(), 250);
  }, duration || 3500);
}
function selS(el, v) {
  sType = v;
  document.querySelectorAll('#session-pills .pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  loadIdleHistory();
  if (recommendedType && v !== recommendedType && v !== "Coach's Workout") {
    document.getElementById('rec-card').style.display = 'none';
  }
}
function selL(el, v) {
  loc = v;
  document.querySelectorAll('#loc-pills .pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  autoRecommend();
}

// ── Service Worker ────────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/jt-train/sw.js').catch(e => console.log('SW:', e));
}

// ── Wake Lock ─────────────────────────────────────────────────────────────────
let wakeLock = null;

async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    // The browser silently releases the lock whenever the page is hidden;
    // null the handle on release so visibilitychange knows to re-acquire.
    wakeLock.addEventListener('release', () => { wakeLock = null; });
    console.log('Wake lock active');
  } catch (e) {
    console.log('Wake lock failed:', e.message);
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch(() => {});
    wakeLock = null;
  }
}

document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && sessionId && !wakeLock) {
    await requestWakeLock();
  }
});

init();
