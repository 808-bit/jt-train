async function init() {
  try {
    const [injR, exR, eqR] = await Promise.all([
      api('getActiveInjuries'),
      api('getExercises'),
      api('getEquipmentConfig'),
    ]);
    equipmentConfig = eqR.data || {};
    ['Home','Travel','Gym'].forEach(l => { if (!equipmentConfig[l]) equipmentConfig[l] = {...DEFAULT_CONFIG[l]}; });
    injuries = injR.data || [];
    exercises = exR.data || [];

    if (injuries.length) {
      const b = document.getElementById('inj-banner');
      b.textContent = '⚠ Active: ' + injuries.map(i => i.body_part).join(', ') + ' — tap to manage';
    }

    document.getElementById('dot').classList.add('live');
    document.getElementById('badge').textContent = '● LIVE';
    document.getElementById('status').textContent = exercises.length + ' exercises loaded';
    await loadIdleHistory();
    autoRecommend();
  } catch (e) {
    document.getElementById("badge").textContent = "offline";
    const errDetail = e?.message || String(e);
    document.getElementById("status").innerHTML =
      `fetch failed: ${errDetail} &nbsp;<button class="btn-sm" onclick="init()" style="margin-left:6px">Retry</button>`;
    console.error("init() failed:", e);
    showToast('Connection failed — check network', 'error');
  }
}

async function loadIdleHistory() {
  try {
    const params = sType === 'Coaches Workout' ? { limit: 6 } : { session_type: sType, limit: 3 };
    history = await api('getSessionHistory', params);
  } catch (e) {
    history = { sessions: [], sets: [] };
  }
}

let recommendedType = null;
let coachBrief = null;

async function autoRecommend() {
  document.getElementById('rec-loading').style.display = 'block';
  document.getElementById('rec-content').style.display = 'none';

  try {
    const [sessRes, debriefRes] = await Promise.all([
      api('getSessions', { limit: 5 }),
      api('getRecentDebriefs', { limit: 3 })
    ]);
    const recentSessions = sessRes.sessions || [];
    const debriefs       = debriefRes.data   || [];

    const sessionSummary = recentSessions.map(s =>
      `${s.date}: ${s.session_type} @ ${s.location}`
    ).join('\n') || 'No recent sessions';

    const debriefSummary = debriefs.map(d =>
      `${d.date} ${d.session_type}: ${d.performance_signal}, ${d.total_sets} sets, ${d.total_volume_kg}kg. ${d.recommendation}`
    ).join('\n') || 'No debrief data';

    const system = `You are a strength coach writing a session card for James. Be direct and specific. No filler.

RECENT SESSIONS:
${sessionSummary}

RECENT DEBRIEFS:
${debriefSummary}

READINESS: Sleep ${preSleep}/5 · Energy ${preEnergy}/5 · Soreness ${preSoreness}/5
LOCATION: ${loc}
INJURIES: ${injuries.length ? injuries.map(i=>i.body_part+': '+i.restrictions).join(', ') : 'None'}
KIT: ${buildKitString(loc)}

Return ONLY valid JSON. Every field has a hard word limit — count the words and stay under:
{
  "session_type": "Full Body A",
  "headline": "HARD LIMIT 5 WORDS. The session vibe, not a list. Example: 'Pull focus, earn it'",
  "brief": "HARD LIMIT 8 WORDS. ONE reason why these patterns today — no semicolons, no lists. Example: 'Pull patterns overdue, push stayed light'",
  "cues": ["HARD LIMIT 6 WORDS. One coaching focus, not an exercise prescription", "HARD LIMIT 6 WORDS. Second coaching focus"],
  "reason": "HARD LIMIT 5 WORDS. Readiness or timing rationale only. Example: 'Fresh legs, moderate energy'"
}`;

    const raw = await claude(system, [{ role:'user', content:'What should I train today?' }], SONNET);
    const jsonStart = raw.indexOf('{');
    const jsonEnd   = raw.lastIndexOf('}');
    const rec = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));

    recommendedType = rec.session_type;
    coachBrief = rec.brief;

    document.getElementById('rec-loading').style.display = 'none';
    document.getElementById('rec-content').style.display = 'block';
    document.getElementById('rec-type').textContent  = rec.headline || rec.session_type;
    document.getElementById('rec-brief').textContent = rec.brief;
    const cuesEl = document.getElementById('rec-cues');
    cuesEl.innerHTML = (rec.cues || []).map(c =>
      `<div style="display:flex;gap:8px;align-items:flex-start;font-family:var(--font);font-size:11px;color:var(--text2);line-height:1.4;"><span style="color:var(--green);flex-shrink:0;">→</span><span>${c}</span></div>`
    ).join('');
    document.getElementById('rec-reason').textContent = rec.reason ? '─  ' + rec.reason : '';

    renderCoachChips();

  } catch(e) {
    document.getElementById('rec-loading').innerHTML = '<div style="font-family:var(--font);font-size:11px;color:var(--text3);">Could not load — <button type="button" onclick="autoRecommend()" style="font-family:var(--font-ui);font-size:10px;color:var(--text2);background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">retry</button></div>';
    console.log('Recommendation failed:', e);
  }
}

function renderCoachChips() {
  const el = document.getElementById('rec-chips');
  if (!el) return;
  const chips = [
    { label: "Sounds good — let's go →", action: 'go', primary: true },
    { label: 'Push it harder', action: 'push', primary: false },
    { label: 'Dial it back', action: 'dial', primary: false },
  ];
  el.innerHTML = '';
  chips.forEach(chip => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = chip.label;
    btn.style.cssText = `font-family:var(--font-ui);font-size:10px;font-weight:600;letter-spacing:0.04em;padding:7px 12px;border-radius:20px;cursor:pointer;transition:opacity 0.15s;white-space:nowrap;` +
      (chip.primary
        ? `background:rgba(34,197,94,0.12);border:1px solid rgba(34,197,94,0.4);color:var(--green);`
        : `background:none;border:1px solid var(--border2);color:var(--text2);`);
    btn.onclick = () => quickCoachAction(chip.action);
    el.appendChild(btn);
  });
}

function quickCoachAction(action) {
  const notes = document.getElementById('pre-notes');
  if (action === 'go') {
    generatePlan();
  } else if (action === 'push') {
    if (notes) notes.value = 'High readiness today — push the load.';
    generatePlan();
  } else if (action === 'dial') {
    if (notes) notes.value = 'Feeling it a bit — dial back the volume, keep quality.';
    generatePlan();
  }
}

function toggleOverride() {
  const panel = document.getElementById('override-panel');
  panel.style.display = panel.style.display === 'none' ? '' : 'none';
}

function acceptRecommendation() {
  document.getElementById('rec-card').style.display = 'none';
}

async function fetchSSOContext(limit, sessionTypeFilter) {
  try {
    const params = { limit: limit || 3 };
    if (sessionTypeFilter) params.session_type = sessionTypeFilter;
    const res = await api('getRecentDebriefs', params);
    const debriefs = res.data || [];
    if (!debriefs.length) return 'No previous debrief data available.';
    return debriefs.map(d => {
      const flagged = (() => { try { return JSON.parse(d.exercises_flagged || '[]'); } catch { return []; } })();
      return `[${d.date} ${d.session_type}] Signal: ${d.performance_signal} | Volume: ${d.total_volume_kg}kg / ${d.total_sets} sets${d.shoulder_flag ? ' | ⚠ Shoulder flagged' : ''}${flagged.length ? ' | Flagged: ' + flagged.join(', ') : ''} | Rec: ${d.recommendation}`;
    }).join('\n');
  } catch(e) { return 'SSO context unavailable.'; }
}

async function generateCoachesWorkout() {
  const preNotes = document.getElementById('pre-notes').value.trim();
  document.getElementById('gen-status').textContent = 'Analysing your training data...';

  const [histRes, ssoContext, progRes, mpRes] = await Promise.all([
    api('getSessionHistory', { limit: 20 }),
    fetchSSOContext(10, null),
    api('getProgressionTree'),
    api('getMovementPatterns'),
  ]);

  const progRules = progRes.data || [];
  const progContext = progRules.length
    ? progRules.map(p => {
        const levers = (() => { try { return JSON.parse(p.intensity_levers || '[]'); } catch { return []; } })();
        return `${p.display_name}: target ${p.rep_target} @ RIR ${p.rir_target} for ${p.sessions_to_confirm} sessions → next: ${p.next_exercise_id || 'peak'}${p.next_requires ? ' (needs ' + p.next_requires + ')' : ''}. Levers: ${levers.slice(0, 2).join(', ')}`;
      }).join('\n')
    : 'No progression data.';

  const patterns = mpRes.patterns || [];
  const patternProgs = mpRes.progressions || [];
  const patternsStr = patterns.length
    ? patterns.map(p => {
        const chain = patternProgs
          .filter(pp => pp.pattern_id === p.id)
          .sort((a, b) => a.level - b.level)
          .map(pp => `  L${pp.level}: ${pp.exercise_name}${pp.rep_target ? ' (' + pp.rep_target + ' reps @ RIR' + pp.rir_target + ')' : ''}`)
          .join('\n');
        return `${p.name}${p.description ? ' — ' + p.description : ''}\n${chain || '  (no chain)'}`;
      }).join('\n\n')
    : 'No pattern data.';

  const sets = histRes.sets || [];
  const sessions = histRes.sessions || [];
  const histStr = sets.length
    ? 'Last ' + sessions.length + ' sessions (all types):\n' +
      sets.map(s =>
        s.session_id.slice(0, 10) + ' | ' + (s.session_type || '') + ' | ' + s.exercise_id +
        ' S' + s.set_num + ': ' + s.reps + ' reps @ ' + s.weight_kg + 'kg' +
        (s.rir != null ? ' RIR' + s.rir : '') + (s.tempo ? ' ' + s.tempo : '') + (s.notes ? ' (' + s.notes + ')' : '')
      ).join('\n')
    : 'No history yet.';

  const injStr = injuries.length ? injuries.map(i => i.body_part + ': ' + i.restrictions).join('\n') : 'None';
  const kitStr = buildKitString(loc);
  const availEx = filterExercises(exercises, loc, 'Coaches Workout')
    .map(e => e.id + ' | ' + e.display_name + ' (' + e.category + ', ' + e.equipment + (e.movement_pattern ? ', ' + e.movement_pattern : '') + (e.notes ? ', note: ' + e.notes : '') + ')')
    .join('\n');

  const readinessStr = (preSleep <= 2 || preEnergy <= 2)
    ? '⚠ LOW — reduce to 3-4 exercises, RIR 2-3, quality over output.'
    : (preSleep >= 4 && preEnergy >= 4)
    ? '✓ HIGH — 5-7 exercises, RIR 0-1, push loads.'
    : 'MODERATE — 4-5 exercises, RIR 1-2, standard dose.';

  const system = `You are The Tactical Partner — a precision strength coach with full autonomy to design today's hypertrophy session for James Thornton.
Operating principle: maintain the machine, respect the load, optimise for life. No fluff. Data drives decisions.

ATHLETE PROFILE:
Goal: Lean bulk / hypertrophy — Q2 2026.
Equipment: ${kitStr}
Active injuries: ${injStr}
Location: ${loc}

READINESS: Sleep ${preSleep}/5 · Energy ${preEnergy}/5 · Soreness ${preSoreness}/5
${readinessStr}

HYPERTROPHY PRINCIPLES (non-negotiable):
- Primary driver: mechanical tension. Work sets in 6-12 rep range.
- RIR 0-2 on work sets. First set conservative, final set close to failure.
- 3-5 hard sets per movement pattern trained.
- Compounds anchor the session. Isolation only where it fills a genuine gap.
- Base all loads on the most recent sets logged for each exercise — progressive overload.
- Tempo: note a 2-3s eccentric where it matters for tension.

MOVEMENT PATTERN ARCHITECTURE (scan this to identify what's overdue):
${patternsStr}

PROGRESSION TREE (use to determine if an exercise should advance to next tier):
${progContext}

${pendingProgressions.length ? `CONFIRMED PROGRESSIONS (athlete approved — use new exercise, not old):\n${pendingProgressions.map(p => `- SWAP ${p.fromName} → ${p.toName || 'peak tier'}`).join('\n')}\n\n` : ''}DEBRIEF INTELLIGENCE (last 10 sessions):
${ssoContext}

RAW SET HISTORY (last 20 sessions — use to assess per-pattern frequency, loads, and fatigue):
${histStr}

AVAILABLE EXERCISES (ONLY use these exercise_ids — never invent one):
${availEx}

DESIGN PROCESS:
1. Scan history. Which movement patterns were trained most/least recently?
2. Prioritise patterns 5+ days undertrained or absent from recent sessions.
3. Apply readiness signal to set exercise count and intensity ceiling.
4. Apply any confirmed progressions.
5. Set loads from the most recent logged sets — push if readiness allows.
6. session_notes: one sharp sentence on what you're targeting and why.

Return ONLY valid JSON, no markdown:
{
  "session_notes": "tactical rationale",
  "exercises": [
    { "exercise_id": "slug", "display_name": "Name", "sets": 4, "reps": "8-10", "weight": "32kg", "tempo": "3-0-1-0", "rir": 1, "notes": "cue" }
  ]
}`;

  document.getElementById('gen-status').textContent = 'Building your plan...';
  const userMsg = 'Design the optimal hypertrophy session for today. Location: ' + loc +
    (preNotes ? '\n\nPre-session notes: ' + preNotes : '');
  const raw = await claude(system, [{ role: 'user', content: userMsg }], SONNET);
  const clean = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);
  const allowedIds = new Set(filterExercises(exercises, loc, 'Coaches Workout').map(e => e.id));
  parsed.exercises = (parsed.exercises || []).filter(e => allowedIds.has(e.exercise_id));
  plan = parsed.exercises;
  const planIds = new Set(plan.map(e => e.exercise_id));
  pendingProgressions.forEach(p => { if (planIds.has(p.to)) appliedProgressions.add(p.from); });
  pendingProgressions = pendingProgressions.filter(p => !planIds.has(p.to));
  localStorage.setItem('pendingProgressions', JSON.stringify(pendingProgressions));
  localStorage.setItem('appliedProgressions', JSON.stringify([...appliedProgressions]));
  document.getElementById('review-title').textContent = 'Coaches Workout';
  document.getElementById('review-sub').textContent = loc + ' · ' + new Date().toLocaleDateString('en-AU');
  document.getElementById('review-chat').innerHTML = '';
  renderPlanCards(parsed);
  goScreen('s-review');
}

async function generatePlan() {
  goScreen('s-generating');
  if (sType === 'Coaches Workout') {
    try {
      await generateCoachesWorkout();
    } catch (e) {
      goScreen('s-idle');
      document.getElementById('status').textContent = 'Error: ' + e.message;
      showToast('Plan failed — ' + e.message, 'error');
    }
    return;
  }

  document.getElementById('gen-status').textContent = 'Reading your history...';
  await loadIdleHistory();
  const [ssoContext, progRes] = await Promise.all([
    fetchSSOContext(3, sType),
    api('getProgressionTree')
  ]);
  const progRules = progRes.data || [];
  const progContext = progRules.length
    ? progRules.map(p => {
        const levers = (() => { try { return JSON.parse(p.intensity_levers || '[]'); } catch { return []; } })();
        return `${p.display_name}: target ${p.rep_target} @ RIR ${p.rir_target} for ${p.sessions_to_confirm} sessions → next: ${p.next_exercise_id || 'peak'}${p.next_requires ? ' (needs '+p.next_requires+')' : ''}. Levers: ${levers.slice(0,2).join(', ')}`;
      }).join('\n')
    : 'No progression data.';
  const injStr = injuries.length ? injuries.map(i => i.body_part + ': ' + i.restrictions).join('\n') : 'None';
  const kitStr = buildKitString(loc);
  const availEx = filterExercises(exercises, loc, sType)
    .map(e => e.id + ' | ' + e.display_name + ' (' + e.category + ', ' + e.equipment + (e.notes ? ', note: ' + e.notes : '') + ')')
    .join('\n');
  const histStr = history.sets && history.sets.length
    ? 'Last ' + history.sessions.length + ' sessions:\n' +
      history.sets.map(s =>
        s.session_id.slice(0, 10) + ' | ' + s.exercise_id +
        ' S' + s.set_num + ': ' + s.reps + ' reps @ ' + s.weight_kg + 'kg' +
        (s.rir ? ' RIR' + s.rir : '') + (s.tempo ? ' ' + s.tempo : '') + (s.notes ? ' (' + s.notes + ')' : '')
      ).join('\n')
    : 'No recent history for ' + sType;
  const sessionFocus = {
    'Full Body A': 'Compound lower body + push + pull. Squat or hinge pattern, horizontal push, vertical or horizontal pull.',
    'Full Body B': 'Compound lower body + push + pull. Different pattern to Full Body A — hinge or lunge, different push/pull combo.',
    'Upper Body': 'Push and pull supersets. Horizontal push + vertical pull, vertical push + horizontal pull. No legs.',
    'Lower Body': 'Legs and hinge patterns only. Squat, hinge, lunge variations. No upper body pushing or pulling.',
    'Rings Only': 'All exercises on gymnastics rings. Push, pull, core — rings only. No KB.',
    'KB Only': 'All exercises with kettlebells only. No rings, no parallettes.',
  };
  const system = `You are The Tactical Partner — an intelligent, analytical training operator for James Thornton.
Your operating principle: maintain the machine, respect the load, optimise for life.
You are not a motivator. You are a precision instrument. No fluff, no toxic positivity, no filler.

${coachBrief ? `COACH PRESCRIPTION (follow this closely — it overrides generic session type):
${coachBrief}

` : ''}Phase: Lean bulk Q2 2026. Hypertrophy focus.
Session type: ${sType} — ${sessionFocus[sType] || ''}
Equipment available: ${kitStr}
Active injuries:\n${injStr}

RECENT DEBRIEF INTELLIGENCE (last 3 ${sType} sessions — use this to drive load, volume, and exercise selection):
${ssoContext}

PROGRESSION TREE (rep targets and next tiers — use to determine if an exercise should advance):
${progContext}

${pendingProgressions.length ? `CONFIRMED PROGRESSIONS (athlete has approved these — include the new exercise, not the old one):\n${pendingProgressions.map(p => `- SWAP ${p.fromName} → ${p.toName || 'consolidate at peak'}`).join('\n')}` : ''}

Available exercises (use ONLY these exercise_ids):\n${availEx}
Raw set history:\n${histStr}

PRE-SESSION SIGNALS (1=worst, 5=best):
Sleep: ${preSleep}/5 | Energy: ${preEnergy}/5 | Soreness: ${preSoreness}/5
${(preSleep <= 2 || preEnergy <= 2) ? '⚠ LOW READINESS — reduce volume, increase RIR, prioritise quality over output.' : (preSleep >= 4 && preEnergy >= 4) ? '✓ HIGH READINESS — push load and volume accordingly.' : 'MODERATE READINESS — standard prescription.'}

CONTEXT INTERPRETATION — if pre-session notes or signals indicate low energy, high stress, fatigue, or life load:
- Reduce volume (3-4 exercises, lower sets)
- Reduce intensity (higher RIR 2-3, lighter loads)
- Prioritise movement quality over output
- session_notes should reflect the tactical rationale, not platitudes

If notes indicate readiness or high energy — push accordingly. Match the dose to the state.

Generate a ${sType} workout. Return ONLY valid JSON, no markdown, no preamble:
{
  "session_notes": "one line tactical intent",
  "exercises": [
    { "exercise_id": "slug", "display_name": "Name", "sets": 4, "reps": "8-10", "weight": "32kg", "tempo": "3-0-1-0", "rir": 1, "notes": "cue" }
  ]
}
Rules: 4-6 exercises. Base load/volume on history. CRITICAL: Only use exercise_ids from the "Available exercises" list above — never invent or use an exercise_id not in that list.`;

  try {
    document.getElementById('gen-status').textContent = 'Building your plan...';
    const preNotes = document.getElementById('pre-notes').value.trim();
    const userMsg = 'Generate my ' + sType + ' workout. Location: ' + loc +
      (preNotes ? '\n\nPre-session notes from athlete: ' + preNotes : '');
    const raw = await claude(system, [{ role: 'user', content: userMsg }], SONNET);
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    const allowedIds = new Set(filterExercises(exercises, loc, sType).map(e => e.id));
    console.log('[plan] allowedIds:', [...allowedIds]);
    console.log('[plan] AI returned:', (parsed.exercises || []).map(e => e.exercise_id));
    parsed.exercises = (parsed.exercises || []).filter(e => allowedIds.has(e.exercise_id));
    console.log('[plan] after filter:', parsed.exercises.map(e => e.exercise_id));
    plan = parsed.exercises;
    const planIds = new Set(plan.map(e => e.exercise_id));
    pendingProgressions.forEach(p => { if (planIds.has(p.to)) appliedProgressions.add(p.from); });
    pendingProgressions = pendingProgressions.filter(p => planIds.has(p.to) ? false : true);
    localStorage.setItem('pendingProgressions', JSON.stringify(pendingProgressions));
    localStorage.setItem('appliedProgressions', JSON.stringify([...appliedProgressions]));
    document.getElementById('review-title').textContent = sType;
    document.getElementById('review-sub').textContent = loc + ' · ' + new Date().toLocaleDateString('en-AU');
    document.getElementById('review-chat').innerHTML = '';
    renderPlanCards(parsed);
    goScreen('s-review');
  } catch (e) {
    goScreen('s-idle');
    document.getElementById('status').textContent = 'Error: ' + e.message;
    showToast('Plan failed — ' + e.message, 'error');
  }
}
