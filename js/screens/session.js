async function startSession() {
  sessionId = new Date().toLocaleDateString('en-CA') + '-A';
  loggedSets = [];
  chatLog = [];
  isDebriefMode = false;
  lastSSO = null;
  const logger = document.getElementById('set-logger');
  if (logger) logger.style.display = '';
  const msgInput = document.getElementById('msg-input');
  if (msgInput) msgInput.placeholder = 'Swap? Adjust? Ask anything...';
  document.getElementById('active-title').textContent = sType.toUpperCase();
  const chat = document.getElementById('chat');
  chat.innerHTML = '';
  goScreen('s-active');
  startSessionTimer();
  requestWakeLock();
  initSetLogger();
  renderQuickChips();
  apiPost({
    action: 'appendSession',
    data: {
      session_id: sessionId,
      date: new Date().toLocaleDateString("en-CA"),
      week_type: 'training',
      phase: 'Lean Bulk Q2 2026',
      session_type: sType,
      location: loc,
      ai_plan_used: true,
      pre_sleep: preSleep,
      pre_energy: preEnergy,
      pre_soreness: preSoreness,
    }
  }).then(r => {
    if (!r.ok) showToast('Session not saved — check connection', 'error');
  }).catch(e => {
    showToast('Session not saved — ' + e.message, 'error');
  });

  const planWrap = document.createElement('div');
  planWrap.style.cssText = 'display:flex;flex-direction:column;gap:8px;width:100%;';
  planWrap.innerHTML = `
    <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.2em;margin-bottom:2px;">${sType.toUpperCase()} — ${new Date().toLocaleDateString('en-AU')} — ${loc.toUpperCase()}</div>
    ${plan.map((e, i) => `
      <div style="background:var(--bg2);border:1px solid var(--border);border-left:2px solid rgba(34,197,94,0.25);border-radius:8px;padding:10px 12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
          <span style="font-family:var(--font-ui);font-size:12px;font-weight:600;color:var(--text);">${i+1}. ${e.display_name}</span>
          <span style="font-family:var(--font);font-size:10px;color:var(--text2);background:var(--bg3);padding:2px 8px;border-radius:4px;border:1px solid var(--border);">${e.sets}×${e.reps}</span>
        </div>
        <div style="font-family:var(--font);font-size:11px;color:var(--text2);letter-spacing:0.04em;margin-bottom:${e.notes ? '5px' : '0'};">${e.weight} &nbsp;·&nbsp; ${e.reps} reps &nbsp;·&nbsp; ${e.rir} left</div>
        ${e.notes ? `<div style="font-family:var(--font);font-size:11px;color:var(--text2);font-style:italic;line-height:1.6;margin-top:4px;">${e.notes}</div>` : ''}
      </div>`).join('')}
    <div style="font-family:var(--font);font-size:11px;color:var(--text2);padding:4px 2px;">Start with ${plan[0]?.display_name}. Log each set as you go.</div>`;
  chat.appendChild(planWrap);
  chat.scrollTop = 0;
  setTimeout(() => { chat.scrollTop = 0; }, 50);
}

async function sendMsg() {
  const input = document.getElementById('msg-input');
  const msg = input.value.trim();
  if (!msg || isTyping) return;
  input.value = '';
  addMsg('you', msg);
  if (msg.toLowerCase() === 'done') { await generateDebrief(); return; }
  await getCoachReply(msg);
}

async function getCoachReply(userMsg) {
  isTyping = true;
  showTyping();
  const injStr = injuries.map(i => i.body_part + ': ' + i.restrictions).join('\n') || 'None';
  const activeShoulderInjury = injuries.some(i => i.active && /shoulder/i.test(i.body_part));
  let system;
  if (isDebriefMode && lastSSO) {
    system = `You are a post-session coach reviewing this session with James. Direct, insightful, no filler.

Session: ${sType}
Signal: ${lastSSO.performance_signal} | Outcome: ${lastSSO.outcome}
Summary: ${lastSSO.headline}
Next session rec: ${lastSSO.recommendation}
Volume: ${lastSSO.total_sets} sets, ${Math.round(lastSSO.total_volume_kg)}kg
${lastSSO.exercises_flagged?.length ? 'Flagged: ' + lastSSO.exercises_flagged.join(', ') : ''}
${lastSSO.shoulder_flag ? '⚠ Shoulder flagged this session.' : ''}
${activeShoulderInjury ? 'Active shoulder injury — no overhead, apply corkscrew cue on pushes.' : ''}
Injuries: ${injStr}
Full set log: ${JSON.stringify(loggedSets)}

2-3 sentences max. Conversational but precise. No motivation speak.`;
  } else {
    const cfg = (equipmentConfig[loc] || DEFAULT_CONFIG[loc] || {});
    const availKB = cfg.kb_weights || [16,20,24,32,44];
    const hasPairs = cfg.kb_pairs || false;
    const kbStr = hasPairs
      ? `Matching pairs available: ${availKB.map(w=>w+'kg').join(', ')}`
      : `Single bells only (no pairs): ${availKB.map(w=>w+'kg').join(', ')} — double KB load = two different bells combined`;
    const shoulderRule = activeShoulderInjury
      ? `SHOULDER RULE: Right shoulder impingement is ACTIVE. On every push/press movement, cue the corkscrew technique and flag if any overhead loading occurs. Never suggest overhead movements.`
      : `SHOULDER NOTE: No active shoulder injury. Standard movement cues apply. No overhead restrictions.`;
    system = `You are The Tactical Partner — a precision training operator, mid-session.
Operating principle: maintain the machine, respect the load, optimise for life.
No filler. No motivation speak. Analytical, brief, direct — like a high-end consultant who also trains.

Session: ${sType} | Location: ${loc}
Active injuries: ${injStr}
${shoulderRule}
Available KB equipment: ${kbStr}
Today's plan (prescribed): ${JSON.stringify(plan)}
Sets logged so far (ACTUAL performance — use this for load recommendations, not the plan): ${JSON.stringify(loggedSets)}

RESPONSE RULES:
- The athlete can already see their set data — DO NOT echo it back. No "Set 2 logged: X reps @ Ykg".
- Give ONE directive only: what to do next and why. 1-2 sentences max.
- Plain language. No jargon. Say "2 reps left" not "RIR 2". Say "slow the lowering" not "increase eccentric tempo".
- Load suggestions MUST use actual logged weights, not prescribed plan weights.
- For double KB, suggest two specific bells from the available list.
- If load or rest was wrong: say what to fix, briefly.
- If pain or injury reported: swap immediately, state the replacement.
- Use James's name only for a decisive correction — not every message.
- When all sets done: one line telling him to hit Done — debrief.`;
  }
  const messages = chatLog.map(m => ({ role: m.role === 'you' ? 'user' : 'assistant', content: m.text }));
  messages.push({ role: 'user', content: userMsg });
  try {
    const reply = await claude(system, messages, SONNET);
    hideTyping();
    addMsg('coach', reply);
  } catch (e) {
    hideTyping();
    addMsg('coach', 'Error: ' + e.message);
  }
  isTyping = false;
}

async function generateDebrief() {
  console.log('generateDebrief — sessionId:', sessionId, 'sets:', loggedSets.length);
  isTyping = true;
  showTyping();
  const system = `You are a training coach. Generate a post-session summary for James.
Plain language only — no jargon, no "RIR", no "tactical", no "SSO". Write like a smart coach texting after a session.

Session: ${sType} | Plan: ${JSON.stringify(plan)} | Logged sets: ${JSON.stringify(loggedSets)}

Return ONLY the JSON object. No working out. No explanation. No markdown. Just the JSON, starting with { and ending with }.
{
  "total_volume_kg": 320,
  "total_sets": 12,
  "performance_signal": "stable",
  "outcome": "maintained",
  "shoulder_flag": false,
  "exercises_flagged": [],
  "headline": "One plain-English sentence. The single most important thing about this session. What happened and why it matters.",
  "recommendation": "One plain-English sentence. What to do differently or focus on next session."
}

performance_signal: "improving" | "stable" | "declining"
outcome: "progressed" | "maintained" | "declined" | "incomplete"
  - progressed: load or reps increased vs last session
  - maintained: consistent output, no regression
  - declined: load or reps dropped, or form broke down
  - incomplete: significant sets missed or session cut short
exercises_flagged: exercise_ids where form broke down, sets were missed, or load was wrong
shoulder_flag: true only if right shoulder was loaded in a risky way`;
  try {
    const raw = await claude(system, [{ role: 'user', content: 'Summarise my session.' }], SONNET);
    const jsonStart = raw.indexOf('{');
    const jsonEnd = raw.lastIndexOf('}');
    const clean = (jsonStart >= 0 && jsonEnd > jsonStart) ? raw.slice(jsonStart, jsonEnd + 1) : raw.replace(/```json|```/g, '').trim();
    let sso;
    try { sso = JSON.parse(clean); } catch(e) { addMsg('coach', raw); hideTyping(); isTyping = false; return; }

    apiPost({ action: 'saveDebrief', data: {
      session_id: sessionId,
      date: new Date().toLocaleDateString("en-CA"),
      session_type: sType,
      total_volume_kg: sso.total_volume_kg,
      total_sets: sso.total_sets,
      performance_signal: sso.performance_signal,
      outcome: sso.outcome || 'maintained',
      shoulder_flag: sso.shoulder_flag,
      exercises_flagged: sso.exercises_flagged,
      recommendation: sso.recommendation,
      raw_json: clean
    }}).then(r => { if (!r.ok) console.error('saveDebrief failed:', r); })
      .catch(e => console.error('saveDebrief error:', e));

    const signalColour = { improving: 'var(--green)', stable: 'var(--text2)', declining: 'var(--amber)' }[sso.performance_signal] || 'var(--text2)';
    const signalIcon = { improving: '↑', stable: '→', declining: '↓' }[sso.performance_signal] || '→';
    const signalLabel = { improving: 'Looking stronger', stable: 'Holding steady', declining: 'Needs attention' }[sso.performance_signal] || '';

    const debriefEl = document.createElement('div');
    debriefEl.className = 'msg coach';
    debriefEl.innerHTML = `
      <div class="msg-label">SESSION SUMMARY</div>
      <div class="msg-bubble" style="padding:0;overflow:hidden;min-width:240px;">
        <div style="padding:12px 14px 10px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;">
          <span style="font-family:var(--font-display);font-size:22px;color:${signalColour};letter-spacing:0.04em;">${signalIcon} ${signalLabel.toUpperCase()}</span>
          ${sso.shoulder_flag ? '<span style="font-family:var(--font-ui);font-size:10px;font-weight:700;color:var(--amber);background:rgba(245,158,11,0.1);padding:3px 8px;border-radius:4px;">⚠ SHOULDER</span>' : ''}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border-bottom:1px solid var(--border);">
          <div style="padding:10px 12px;border-right:1px solid var(--border);text-align:center;">
            <div style="font-family:var(--font-display);font-size:28px;color:var(--text);line-height:1.1;">${sso.total_sets}</div>
            <div style="font-family:var(--font-ui);font-size:8px;font-weight:700;color:var(--text3);letter-spacing:0.16em;margin-top:3px;">SETS</div>
          </div>
          <div style="padding:10px 12px;border-right:1px solid var(--border);text-align:center;">
            <div style="font-family:var(--font-display);font-size:28px;color:var(--text);line-height:1.1;">${Math.round(sso.total_volume_kg)}</div>
            <div style="font-family:var(--font-ui);font-size:8px;font-weight:700;color:var(--text3);letter-spacing:0.16em;margin-top:3px;">KG</div>
          </div>
          <div style="padding:10px 12px;text-align:center;">
            <div style="font-family:var(--font-display);font-size:28px;color:var(--text);line-height:1.1;">${plan.length}</div>
            <div style="font-family:var(--font-ui);font-size:8px;font-weight:700;color:var(--text3);letter-spacing:0.16em;margin-top:3px;">EXERCISES</div>
          </div>
        </div>
        <div style="padding:14px;border-bottom:1px solid var(--border);font-family:var(--font);font-size:14px;color:var(--text);line-height:1.55;">${sso.headline}</div>
        <div style="padding:12px 14px;background:var(--bg3);">
          <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.16em;margin-bottom:5px;">NEXT SESSION</div>
          <div style="font-family:var(--font);font-size:13px;color:var(--text2);line-height:1.5;">${sso.recommendation}</div>
        </div>
      </div>`;
    document.getElementById('chat').appendChild(debriefEl);
    document.getElementById('chat').scrollTop = 9999;

    if (sso.exercises_flagged && sso.exercises_flagged.length > 0) {
      lastSSO = sso;
      setTimeout(() => {
        const btn = document.createElement('button');
        btn.className = 'quick-btn debrief';
        btn.style.cssText = 'margin:8px 0 0 0;';
        btn.textContent = '⚡ Analyse trends →';
        btn.onclick = () => { btn.remove(); analyseExerciseTrends(sso.exercises_flagged); };
        document.getElementById('chat').appendChild(btn);
        document.getElementById('chat').scrollTop = 9999;
      }, 400);
    }
    hideTyping();
    setTimeout(() => showPostSession(), 500);
  } catch (e) {
    hideTyping();
    addMsg('coach', 'Debrief error: ' + e.message);
  }
  isTyping = false;
}

function quickMsg(msg) {
  document.getElementById('msg-input').value = msg;
  sendMsg();
}

function renderQuickChips() {
  const container = document.getElementById('quick-btns-container');
  if (!container) return;
  const hasShoulderInjury = injuries.some(i => i.active && /shoulder/i.test(i.body_part));
  const setsLogged = loggedSets.length;
  const chips = [];
  if (hasShoulderInjury) chips.push({ label: 'Shoulder pain', msg: 'Shoulder hurting — swap it' });
  chips.push({ label: 'Easier', msg: 'Need an easier option' });
  if (setsLogged > 0) chips.push({ label: 'How am I doing?', msg: 'Quick progress check' });
  chips.push({ label: 'Done — debrief', msg: 'done', cls: 'debrief' });
  container.innerHTML = chips.map(c =>
    `<button class="quick-btn ${c.cls||''}" onclick="quickMsg('${c.msg}')">${c.label}</button>`
  ).join('');
}

function updateProgress() {
  const totalSets = plan.reduce((s, e) => s + (e.sets || 4), 0);
  const doneSets = loggedSets.length;
  const totalVol = loggedSets.reduce((s, e) => s + (e.weight_kg * e.reps || 0), 0);
  const pct = totalSets > 0 ? Math.min(100, Math.round((doneSets / totalSets) * 100)) : 0;
  const pbar = document.getElementById('progress-bar');
  const plbl = document.getElementById('progress-label');
  const vlbl = document.getElementById('volume-label');
  if (pbar) pbar.style.width = pct + '%';
  if (plbl) plbl.textContent = `${doneSets} / ${totalSets} sets`;
  if (vlbl) vlbl.textContent = totalVol > 0 ? Math.round(totalVol) + ' kg' : '0 kg';
  renderQuickChips();
}

let lastSSO = null;
let isDebriefMode = false;

async function analyseExerciseTrends(flaggedIds) {
  isTyping = true;
  showTyping();
  try {
    const [debriefRes, ...progResults] = await Promise.all([
      api('getRecentDebriefs', { limit: 5 }),
      ...flaggedIds.map(id => api('getProgressionData', { exercise_id: id, limit: 15 }))
    ]);
    const recentDebriefs = debriefRes.data || [];
    const progData = {};
    flaggedIds.forEach((id, i) => { progData[id] = progResults[i].data || []; });

    const availEx = filterExercises(exercises, loc, sType)
      .map(e => `${e.id}: ${e.display_name} (${e.equipment})`)
      .join('\n');

    const system = `You are The Tactical Partner. Analyse exercise trends and determine if a swap is warranted.
Operating principle: maintain the machine, respect the load, optimise for life.
Be surgical and data-driven. No fluff.

Current session type: ${sType}
Flagged exercises: ${flaggedIds.join(', ')}
Recent debriefs (last 5): ${JSON.stringify(recentDebriefs.map(d => ({ date: d.date, signal: d.performance_signal, flagged: d.exercises_flagged, rec: d.recommendation })))}
Progression data per exercise: ${JSON.stringify(progData)}
Available swap candidates: ${availEx}

Analyse each flagged exercise. For each one determine:
1. Is the trend genuinely declining (3+ sessions of drop, incomplete sets, or consistent shoulder flag)?
2. If yes — generate a swap recommendation.
3. If no — state why it does not yet warrant a swap.

Return ONLY valid JSON, no markdown:
{
  "analysis": [
    {
      "exercise_id": "slug",
      "verdict": "swap",
      "reason": "one line clinical rationale",
      "apply_block": {
        "from": "old_exercise_id",
        "to": "new_exercise_id",
        "display_name": "New Exercise Name",
        "sets": 4,
        "reps": "8-10",
        "weight": "24kg",
        "tempo": "3-0-1-0",
        "rir": 2,
        "notes": "cue"
      }
    }
  ],
  "summary": "one line tactical summary"
}
verdict options: "swap" | "monitor" | "hold"
apply_block only included when verdict is "swap". Use exercise_ids exactly from the available swap candidates list.`;

    const raw = await claude(system, [{ role: 'user', content: 'Analyse my flagged exercises.' }], SONNET);
    const clean = raw.replace(/```json|```/g, '').trim();
    let result;
    try { result = JSON.parse(clean); } catch(e) { addMsg('coach', raw); hideTyping(); isTyping = false; return; }

    hideTyping();
    result.analysis.forEach(item => {
      const icon = { swap:'🔄', monitor:'👁', hold:'✓' }[item.verdict] || '→';
      addMsg('coach', `${icon} ${item.exercise_id.replace(/_/g,' ').toUpperCase()}\n${item.reason}`);
      if (item.verdict === 'swap' && item.apply_block) {
        const ab = item.apply_block;
        const btn = document.createElement('button');
        btn.className = 'quick-btn debrief';
        btn.style.cssText = 'margin:8px 0 0 0;background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.4);';
        btn.textContent = `Apply: swap → ${ab.display_name}`;
        btn.onclick = () => {
          const idx = plan.findIndex(p => p.exercise_id === item.exercise_id);
          if (idx > -1) plan[idx] = { exercise_id: ab.to, display_name: ab.display_name, sets: ab.sets, reps: ab.reps, weight: ab.weight, tempo: ab.tempo, rir: ab.rir, notes: ab.notes };
          btn.textContent = `✓ Applied — ${ab.display_name} queued for next session`;
          btn.disabled = true;
          btn.style.opacity = '0.5';
        };
        document.getElementById('chat').appendChild(btn);
      }
    });
    if (result.summary) addMsg('coach', result.summary);
    document.getElementById('chat').scrollTop = 9999;
  } catch(e) {
    hideTyping();
    addMsg('coach', 'Trend analysis error: ' + e.message);
  }
  isTyping = false;
}

function addMsg(role, text) {
  chatLog.push({ role, text });
  const chat = document.getElementById('chat');
  const div = document.createElement('div');
  div.className = 'msg ' + (role === 'you' ? 'you' : 'coach');
  div.innerHTML = `<div class="msg-label">${role === 'you' ? 'YOU' : 'COACH'}</div><div class="msg-bubble">${text}</div>`;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

let typingEl = null;
function showTyping() {
  const chat = document.getElementById('chat');
  typingEl = document.createElement('div');
  typingEl.className = 'msg coach';
  typingEl.innerHTML = '<div class="msg-label">COACH</div><div class="msg-bubble"><div class="typing"><span></span><span></span><span></span></div></div>';
  chat.appendChild(typingEl);
  chat.scrollTop = chat.scrollHeight;
  document.getElementById('send-btn').disabled = true;
}
function hideTyping() {
  if (typingEl) { typingEl.remove(); typingEl = null; }
  document.getElementById('send-btn').disabled = false;
}

function renderPlanCards(parsed) {
  const cards = document.getElementById('plan-cards');
  cards.innerHTML = '';
  if (parsed.session_notes) {
    const note = document.createElement('div');
    note.style.cssText = 'font-size:12px;color:var(--text2);margin-bottom:16px;font-style:italic;line-height:1.6;';
    note.textContent = parsed.session_notes;
    cards.appendChild(note);
  }
  (parsed.exercises || plan).forEach((ex, i) => {
    const card = document.createElement('div');
    card.className = 'exercise-card';
    card.innerHTML = `
      <div class="ex-header">
        <div class="ex-name">${i + 1}. ${ex.display_name}</div>
        <div class="ex-vol">${ex.sets}×${ex.reps}</div>
      </div>
      <div class="ex-meta">
        <span>${ex.weight}</span>
        <span>${ex.tempo}</span>
        <span>RIR ${ex.rir}</span>
      </div>
      ${ex.notes ? `<div class="ex-note">${ex.notes}</div>` : ''}
    `;
    cards.appendChild(card);
  });
}

let reviewTyping = false;

function reviewQuick(msg) {
  document.getElementById('review-input').value = msg;
  sendReviewMsg();
}

function addReviewMsg(role, text) {
  const chat = document.getElementById('review-chat');
  const div = document.createElement('div');
  div.style.cssText = 'display:flex;flex-direction:column;align-items:' + (role === 'you' ? 'flex-end' : 'flex-start');
  div.innerHTML = '<div style="font-size:10px;color:#333;margin-bottom:2px;letter-spacing:0.07em">' + (role === 'you' ? 'YOU' : 'COACH') + '</div><div style="max-width:92%;padding:8px 12px;background:' + (role === 'you' ? '#111' : '#0d0d0d') + ';border:1px solid #1a1a1a;border-radius:' + (role === 'you' ? '10px 10px 3px 10px' : '10px 10px 10px 3px') + ';font-size:12px;line-height:1.6;color:#e8e4dc;white-space:pre-wrap">' + text + '</div>';
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

async function sendReviewMsg() {
  const input = document.getElementById('review-input');
  const msg = input.value.trim();
  if (!msg || reviewTyping) return;
  input.value = '';
  reviewTyping = true;
  addReviewMsg('you', msg);
  const availableExList = filterExercises(exercises, loc, sType)
    .map(e => e.id + ' (' + e.display_name + ', ' + e.category + ', ' + e.equipment + ')')
    .join(', ');
  const chat = document.getElementById('review-chat');
  const typingDiv = document.createElement('div');
  typingDiv.id = 'review-typing';
  typingDiv.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start';
  typingDiv.innerHTML = '<div style="font-size:10px;color:#333;margin-bottom:2px">COACH</div><div style="padding:8px 12px;background:#0d0d0d;border:1px solid #1a1a1a;border-radius:10px 10px 10px 3px;"><div class="typing"><span></span><span></span><span></span></div></div>';
  chat.appendChild(typingDiv);
  chat.scrollTop = chat.scrollHeight;
  const injStr = injuries.length ? injuries.map(i => i.body_part + ': ' + i.restrictions).join('\n') : 'None';
  const kitStr2 = buildKitString(loc);
  const system = `You are The Tactical Partner — adjusting a workout plan pre-session for James Thornton.
Operating principle: maintain the machine, respect the load, optimise for life.
Make the requested change surgically. Don't restructure what wasn't asked about.

Current plan: ${JSON.stringify(plan)}
Available kit: ${kitStr2}
Available exercises to substitute from (use exercise_id slugs): ${availableExList}
Active injuries: ${injStr}
Phase: Lean bulk Q2 2026, hypertrophy.

Return ONLY valid JSON — same format, no markdown, no preamble:
{
  "session_notes": "updated tactical intent",
  "exercises": [
    { "exercise_id": "slug", "display_name": "Name", "sets": 4, "reps": "8-10", "weight": "32kg", "tempo": "3-0-1-0", "rir": 1, "notes": "cue" }
  ]
}
Keep what works. Only change what was asked. Protect the right shoulder.`;
  try {
    const raw = await claude(system, [{ role: 'user', content: msg }], SONNET);
    const clean = raw.replace(/\`\`\`json|\`\`\`/g, '').trim();
    const parsed = JSON.parse(clean);
    plan = parsed.exercises || [];
    renderPlanCards(parsed);
    document.getElementById('review-typing').remove();
    const contextReply = await claude(
      `You are The Tactical Partner. You just adjusted a workout plan based on the athlete's input.
Respond in 1-2 sentences max. Acknowledge what you heard, state what you changed and why — analytically, no fluff.
Use James's name only if delivering a decisive recalibration. No motivation speak.`,
      [{ role: 'user', content: msg }],
      SONNET
    );
    addReviewMsg('coach', contextReply);
  } catch (e) {
    document.getElementById('review-typing')?.remove();
    addReviewMsg('coach', 'Could not parse update. Try rephrasing.');
  }
  reviewTyping = false;
}

function showDebriefMode() {
  isDebriefMode = true;
  const logger = document.getElementById('set-logger');
  if (logger) logger.style.display = 'none';
  const input = document.getElementById('msg-input');
  if (input) input.placeholder = 'Ask the coach about this session...';
  const container = document.getElementById('quick-btns-container');
  if (container) container.innerHTML = [
    ['What to focus on next?',    'What should I focus on next session?'],
    ['Anything to watch out for?','Anything to watch out for going forward?'],
    ['How did this compare?',     'How does this compare to my recent sessions?'],
  ].map(([lbl, msg]) => `<button class="quick-btn" onclick="quickMsg(${JSON.stringify(msg)})">${lbl}</button>`).join('');
}

function showPostSession() {
  showDebriefMode();
  const chat = document.getElementById('chat');
  const div = document.createElement('div');
  div.style.cssText = 'margin-top:16px;padding:14px 16px;background:#111;border:1px solid #222;border-radius:10px;';
  div.innerHTML = `
    <div style="font-size:11px;color:#444;letter-spacing:0.12em;margin-bottom:12px;">SESSION RATING</div>
    <div style="margin-bottom:12px;">
      <div style="font-size:11px;color:#666;margin-bottom:6px;">Overall RPE (1-10)</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;" id="rpe-btns">
        ${[1,2,3,4,5,6,7,8,9,10].map(n => `<button onclick="selectRPE(${n})" style="font-family:inherit;width:36px;height:36px;border-radius:6px;border:1px solid #222;background:none;color:#888;font-size:13px;cursor:pointer;" id="rpe-${n}">${n}</button>`).join('')}
      </div>
    </div>
    <div style="margin-bottom:12px;">
      <div style="font-size:11px;color:#666;margin-bottom:6px;">Session notes</div>
      <textarea id="post-notes" placeholder="How did it feel? Anything to flag for next session..." style="width:100%;background:#0a0a0a;border:1px solid #222;border-radius:6px;padding:8px 12px;color:#e8e4dc;font-size:12px;font-family:'DM Mono','Courier New',monospace;resize:none;height:70px;outline:none;line-height:1.6;"></textarea>
    </div>
    <div style="display:flex;gap:8px;">
      <button onclick="savePostSession()" style="flex:1;padding:10px;background:#e8e4dc;color:#0a0a0a;border:none;border-radius:6px;font-size:11px;letter-spacing:0.12em;font-family:inherit;cursor:pointer;font-weight:bold;">SAVE & FINISH</button>
      <button onclick="discardSession()" style="padding:10px 16px;background:none;color:#555;border:1px solid #222;border-radius:6px;font-size:11px;letter-spacing:0.12em;font-family:inherit;cursor:pointer;">DISCARD</button>
    </div>
  `;
  chat.appendChild(div);
  chat.scrollTop = chat.scrollHeight;
}

let selectedRPE = null;
function selectRPE(n) {
  selectedRPE = n;
  document.querySelectorAll('[id^="rpe-"]').forEach(b => {
    b.style.background = 'none'; b.style.color = '#888'; b.style.borderColor = '#222';
  });
  const btn = document.getElementById('rpe-' + n);
  btn.style.background = '#e8e4dc'; btn.style.color = '#0a0a0a'; btn.style.borderColor = '#e8e4dc';
}

async function savePostSession() {
  const notes = document.getElementById('post-notes')?.value.trim() || '';
  try {
    await apiPost({
      action: 'appendSession',
      data: {
        session_id: sessionId,
        date: new Date().toLocaleDateString("en-CA"),
        week_type: 'training',
        phase: 'Lean Bulk Q2 2026',
        session_type: sType,
        location: loc,
        rpe_session: selectedRPE || '',
        notes: notes,
        ai_plan_used: true,
      }
    });
    stopAllTimers();
    loggedSets = []; sessionId = ''; selectedRPE = null;
    goScreen('s-idle');
  } catch(e) {
    showToast('Save failed — ' + e.message, 'error');
  }
}

function discardSession() {
  if (confirm('Discard this session? No data will be saved.')) goScreen('s-idle');
}
