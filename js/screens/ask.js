// ──────────────────────────────────────────────────────────────────────────
// Ask Gerald — ad-hoc coach chat, OUTSIDE a session.
//
// Free-form Q&A between workouts: "feedback on my last workout", "how much
// have I trained this week", "which patterns am I neglecting". Distinct from
// the mid-workout coach (session.js getCoachReply, tied to the live plan) and
// the idle recommendation card (coach.js autoRecommend, one-shot).
//
// Data model: FAST CONTEXT BUNDLE. On first open we fetch a rich snapshot
// (recent sessions + last-session detail, weekly minutes, debrief signals,
// stimulus, bodyweight) once and cache it, then send it with each question to
// a single Opus call. Conversational latency, no async job loop. If a question
// ever needs data outside this snapshot, that's the trigger to add the agentic
// tool path later — buildAskContext() is the seam.
//
// Keeps its OWN chat state (askLog / askTyping / askTypingEl) so it never
// collides with session.js's chatLog / isTyping / typingEl.
// Loaded after coach.js + doctrine.js so fmtDate, GERALD_PERSONA,
// summariseStimulus, bodyweightContext, latestBodyweight are all in scope.
// ──────────────────────────────────────────────────────────────────────────

let askLog = [];
let askTyping = false;
let askTypingEl = null;
let askCtxPromise = null; // cached context bundle (built once per app load)

function _askEsc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function openAsk() {
  goScreen('s-ask');
  if (!askLog.length) {
    const chat = document.getElementById('ask-chat');
    if (chat) chat.innerHTML = '';
    addAskMsg('coach', "What do you want to know? A session, your week, a lift, or how the bulk's tracking.");
    renderAskChips();
  }
  // Warm the bundle in the background so the first question doesn't wait on it.
  if (!askCtxPromise) askCtxPromise = buildAskContext();
  const input = document.getElementById('ask-input');
  if (input) setTimeout(() => input.focus(), 50);
}

function renderAskChips() {
  const el = document.getElementById('ask-chips');
  if (!el) return;
  const chips = [
    'Feedback on my last workout',
    'How much have I trained this week?',
    'Which movement patterns am I neglecting?',
    "How's my lean bulk tracking?",
  ];
  el.innerHTML = '';
  chips.forEach(c => {
    const b = document.createElement('button');
    b.className = 'quick-btn';
    b.textContent = c;
    b.onclick = () => { const i = document.getElementById('ask-input'); if (i) i.value = c; sendAsk(); };
    el.appendChild(b);
  });
}

function addAskMsg(role, text) {
  askLog.push({ role, text });
  const chat = document.getElementById('ask-chat');
  if (!chat) return;
  const div = document.createElement('div');
  div.className = 'msg ' + (role === 'you' ? 'you' : 'coach');
  const safe = _askEsc(text).replace(/\n/g, '<br>');
  div.innerHTML = `<div class="msg-label">${role === 'you' ? 'YOU' : 'GERALD'}</div><div class="msg-bubble">${safe}</div>`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

function showAskTyping() {
  const chat = document.getElementById('ask-chat');
  if (!chat) return;
  askTypingEl = document.createElement('div');
  askTypingEl.className = 'msg coach';
  askTypingEl.innerHTML = '<div class="msg-label">GERALD</div><div class="msg-bubble"><div class="typing"><span></span><span></span><span></span></div></div>';
  chat.appendChild(askTypingEl);
  chat.scrollTop = chat.scrollHeight;
  const b = document.getElementById('ask-send-btn');
  if (b) b.disabled = true;
}

function hideAskTyping() {
  if (askTypingEl) { askTypingEl.remove(); askTypingEl = null; }
  const b = document.getElementById('ask-send-btn');
  if (b) b.disabled = false;
}

async function sendAsk() {
  const input = document.getElementById('ask-input');
  if (!input) return;
  const msg = input.value.trim();
  if (!msg || askTyping) return;
  input.value = '';
  addAskMsg('you', msg);
  await getAskReply(msg);
}

async function getAskReply() {
  askTyping = true;
  showAskTyping();
  try {
    const ctx = await (askCtxPromise || (askCtxPromise = buildAskContext()));
    const injStr = (typeof injuries !== 'undefined' && injuries.length)
      ? injuries.map(i => `${i.body_part}: ${i.restrictions}`).join(', ')
      : 'None active';
    const system = `${GERALD_PERSONA}
${userContextBlock()}
You are answering James's ad-hoc questions BETWEEN sessions — not mid-workout, there is no plan to prescribe here. He might want feedback on a session, his weekly training load, how a specific lift is trending, how the lean bulk is going, or equipment guidance: what the next weight on a lift should be and which kettlebell to buy next.

${LOAD_PROTOCOL_BRIEF}

ACTIVE INJURIES: ${injStr}

YOU HAVE TOOLS — USE THEM. The snapshot below is only a starting point: it covers the last few sessions and nothing further back. Whenever the question reaches past it — how a lift is trending over months, why something has stalled, what's ready to progress, what the kit supports — call the tools instead of guessing or saying you lack data:
- check_progressions — what's met its target, what has STALLED at an unchanged load (load_stalled/load_note), and the intensity_levers for each lift. Use this for any "why am I stuck / what's next" question.
- get_exercise_history / get_multi_exercise_history — the real load and RIR history for specific lifts, far beyond the snapshot's few sessions.
- assess_training_state — pattern gaps and what's been neglected.
- get_weekly_load — hard sets per movement pattern this week vs last.
- get_equipment — owned bells, the single-bell ladder and the double-KB balanced ladder, for next-weight and purchase questions.
- get_body_metrics — bodyweight trend for lean-bulk questions.
Prefer ONE turn with several tools batched together over several sequential turns — this is a live chat and every extra round-trip is felt. You have a hard budget of ${3} model turns, so gather what you need in the first one.

Ground every answer in real figures. If the tools genuinely don't cover something, say so plainly rather than inventing numbers. For purchase advice, recommend a bell only to bridge a genuine gap, and flag it clearly as a purchase, never as kit he already owns.

${ctx}

Answer in 2-5 sentences. Lead with the number or the insight, not preamble. No motivation-poster talk.`;

    // Build the transcript, dropping any leading assistant turn (the greeting)
    // so the messages array starts with a user turn as the API requires.
    const msgs = askLog.map(m => ({ role: m.role === 'you' ? 'user' : 'assistant', content: m.text }));
    while (msgs.length && msgs[0].role !== 'user') msgs.shift();

    // Agentic path: the worker runs a short tool loop against D1 and returns prose.
    const res = await apiPost({
      action: 'askAgent',
      system,
      messages: msgs,
      context: {
        location: typeof loc !== 'undefined' ? loc : 'Home',
        injuries: typeof injuries !== 'undefined' ? injuries : [],
        // get_available_exercises is constrained to this list, so without it that
        // tool returns nothing.
        availableExerciseIds: (typeof exercises !== 'undefined' && typeof filterByEquipmentOnly === 'function')
          ? filterByEquipmentOnly(exercises, typeof loc !== 'undefined' ? loc : 'Home').map(e => e.id)
          : [],
      },
    });
    if (res && res.error) throw new Error(typeof res.error === 'string' ? res.error : JSON.stringify(res.error));
    const reply = (res && res.text) || '';
    hideAskTyping();
    addAskMsg('coach', reply.trim() || "Didn't catch that — ask again?");
  } catch (e) {
    hideAskTyping();
    addAskMsg('coach', 'Something broke pulling your data — ' + (e && e.message ? e.message : e) + '. Try again in a moment.');
    console.error('getAskReply failed:', e);
  } finally {
    askTyping = false;
  }
}

// Fetch + format the snapshot Gerald reasons over. Cached via askCtxPromise for
// the app's lifetime; call buildAskContext() again (reset askCtxPromise) to
// force a refresh. This is the seam to swap in agentic tool access later.
async function buildAskContext() {
  const [histR, debR, wkR, bmR] = await Promise.all([
    api('getSessionHistory', { limit: 4 }),
    api('getRecentDebriefs', { limit: 8 }),
    api('getWeeklyMinutes', { weeks: 8 }),
    api('getBodyMetrics', { limit: 30 }),
  ]);
  const sessions = histR.sessions || [];
  const sets     = histR.sets     || [];
  const debriefs = debR.data      || [];
  const weeks    = wkR.data       || [];
  const metrics  = bmR.data       || [];
  const exList   = (typeof exercises !== 'undefined' && exercises && exercises.length)
    ? exercises
    : ((await api('getExercises')).data || []);
  const bw = latestBodyweight(metrics);

  const sessLines = sessions.length
    ? sessions.map(s => {
        const dur = s.duration_min ? `${s.duration_min} min` : '—';
        return `${fmtDate(s.date)} · ${s.session_type} @ ${s.location} · ${dur}${s.rpe != null ? ` · RPE ${s.rpe}` : ''}`;
      }).join('\n')
    : 'No recent sessions logged.';

  // Last session, exercise-by-exercise — the "feedback on my last workout" spine.
  let lastBlock = 'No sessions to review.';
  if (sessions.length) {
    const last = sessions[0];
    const lastSets = sets.filter(x => x.session_id === last.id);
    const byEx = {};
    lastSets.forEach(s => { (byEx[s.display_name] = byEx[s.display_name] || []).push(s); });
    const exLines = Object.entries(byEx).map(([name, ss]) =>
      `  ${name}: ` + ss.map(s => `${s.reps}r@${s.weight_kg > 0 ? s.weight_kg + 'kg' : 'BW'}${s.rir != null ? ` RIR${s.rir}` : ''}`).join(', ')
    ).join('\n');
    const deb = debriefs.find(d => d.session_id === last.id);
    const debLine = deb
      ? `\n  Debrief: ${deb.performance_signal}${deb.headline ? ' — ' + deb.headline : ''}${deb.recommendation ? ' → ' + deb.recommendation : ''}`
      : '';
    lastBlock = `${fmtDate(last.date)} ${last.session_type} @ ${last.location}${last.duration_min ? ` (${last.duration_min} min)` : ''}:\n${exLines || '  (no sets logged)'}${debLine}`;
  }

  const wkLines = weeks.length
    ? weeks.map((w, i) =>
        `${i === 0 ? 'Most recent training week' : i + ' week(s) earlier'}: ${Math.round(w.mins || 0)} min across ${w.sessions} session${w.sessions == 1 ? '' : 's'}`
      ).join('\n')
    : 'No weekly minutes recorded.';

  const debLines = debriefs.length
    ? debriefs.map(d =>
        `${fmtDate(d.date)} ${d.session_type}: ${d.performance_signal}, ${d.total_sets} sets / ${Math.round(d.total_volume_kg || 0)}kg.${d.recommendation ? ' ' + d.recommendation : ''}`
      ).join('\n')
    : 'No debriefs yet.';

  const stim  = summariseStimulus(sets, exList, bw);
  const bwCtx = bodyweightContext(metrics);
  const eqBrief = typeof buildEquipmentBrief === 'function' && typeof loc !== 'undefined'
    ? buildEquipmentBrief(loc) : '';
  const today = new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short' });

  return `TODAY: ${today} · Location: ${typeof loc !== 'undefined' ? loc : ''}
${eqBrief ? `\nEQUIPMENT (for next-weight / purchase questions):\n${eqBrief}\n` : ''}

RECENT SESSIONS (newest first):
${sessLines}

LAST SESSION IN DETAIL (use for "feedback on my last workout"):
${lastBlock}

WEEKLY TRAINING TIME (resistance minutes per ISO week, newest first — the top row is the most recent week that has any training, which may be the current week or the last week trained):
${wkLines}

RECENT DEBRIEF SIGNALS:
${debLines}

RECENT ${sessions.length}-SESSION ${stim}

${bwCtx}`;
}
