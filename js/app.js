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
let isTyping = false;

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
