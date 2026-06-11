function fmtDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[m - 1]}`;
}

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
    const params = sType === "Coach's Workout" ? { limit: 6 } : { session_type: sType, limit: 3 };
    history = await api('getSessionHistory', params);
  } catch (e) {
    history = { sessions: [], sets: [] };
  }
}

let recommendedType = null;
let coachBrief = null;
let cachedDebriefs = null;

async function autoRecommend() {
  document.getElementById('rec-loading').style.display = 'block';
  document.getElementById('rec-content').style.display = 'none';

  try {
    const [sessRes, debriefRes] = await Promise.all([
      api('getSessions', { limit: 10 }),
      api('getRecentDebriefs', { limit: 20 })
    ]);
    const recentSessions = sessRes.sessions || [];
    const debriefs       = debriefRes.data   || [];
    cachedDebriefs = debriefs;

    const sessionSummary = recentSessions.map(s =>
      `${fmtDate(s.date)}: ${s.session_type} @ ${s.location}`
    ).join('\n') || 'No recent sessions';

    const debriefSummary = debriefs.map(d =>
      `${fmtDate(d.date)} ${d.session_type}: ${d.performance_signal}, ${d.total_sets} sets, ${d.total_volume_kg}kg. ${d.recommendation}`
    ).join('\n') || 'No debrief data';

    const system = `You are Gerald — a training partner who knows James's history better than he does. You've watched every session, every set, every stall and every breakthrough. You talk like someone who trains alongside him: straight, familiar, no performance. You don't motivate, you observe and advise. You know he has maybe 45 minutes before life intervenes — so you don't waste his time.

Rules: lead with the insight, not the preamble — never say "Great question" or "Based on your data". Use numbers, not vibes. If something looks off, say it plainly. Dry humour is fine. Motivation-poster energy is not.

RECENT SESSIONS (last 10):
${sessionSummary}

RECENT DEBRIEFS (last 20):
${debriefSummary}

READINESS: Sleep ${preSleep}/5 · Energy ${preEnergy}/5 · Soreness ${preSoreness}/5
LOCATION: ${loc}
INJURIES: ${injuries.length ? injuries.map(i=>i.body_part+': '+i.restrictions).join(', ') : 'None'}
KIT: ${buildKitString(loc)}

Write a session card. Fields:
- headline: 4-6 words. The session in a punchy phrase. Not a list of exercises.
- brief: 1-2 sentences. What patterns need work and why, based on the debrief data. Reference specifics — e.g. "Ring rows hit progression threshold last session" or "Hinge has been absent three sessions running."
- cues: 3-4 specific coaching points. Draw from debrief recommendations and readiness. Each cue is one focused instruction — technique, sequencing, load, rest. 10-15 words each. CRITICAL: any KB weights or double KB combinations mentioned must come exactly from the KIT list above — never invent a bell size.
- reason: 1 sentence. Why today's dose matches today's readiness.

Return ONLY valid JSON, no markdown:
{
  "session_type": "Full Body A",
  "headline": "...",
  "brief": "...",
  "cues": ["...", "...", "...", "..."],
  "reason": "..."
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

function formatSSOContext(debriefs, sTypeFilter, limit) {
  let filtered = sTypeFilter ? debriefs.filter(d => d.session_type === sTypeFilter) : debriefs;
  if (limit) filtered = filtered.slice(0, limit);
  if (!filtered.length) return 'No previous debrief data available.';
  return filtered.map(d => {
    const flagged = (() => { try { return JSON.parse(d.exercises_flagged || '[]'); } catch { return []; } })();
    return `[${fmtDate(d.date)} ${d.session_type}] Signal: ${d.performance_signal} | Volume: ${d.total_volume_kg}kg / ${d.total_sets} sets${d.shoulder_flag ? ' | ⚠ Shoulder flagged' : ''}${flagged.length ? ' | Flagged: ' + flagged.join(', ') : ''} | Rec: ${d.recommendation}`;
  }).join('\n');
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
      return `[${fmtDate(d.date)} ${d.session_type}] Signal: ${d.performance_signal} | Volume: ${d.total_volume_kg}kg / ${d.total_sets} sets${d.shoulder_flag ? ' | ⚠ Shoulder flagged' : ''}${flagged.length ? ' | Flagged: ' + flagged.join(', ') : ''} | Rec: ${d.recommendation}`;
    }).join('\n');
  } catch(e) { return 'SSO context unavailable.'; }
}

async function generateCoachesWorkout() {
  preNotes = document.getElementById('pre-notes').value.trim();
  document.getElementById('gen-status').textContent = 'Gerald is thinking...';

  const memoRes = await apiPost({ action: 'getMemo' }).catch(() => ({ memo: null }));
  coachMemo = memoRes.memo || '';

  // Equipment + injury filter runs on the frontend where the logic already lives.
  // We pass the resulting IDs to the worker so the agent's tool is constrained.
  const availableExerciseIds = filterByEquipmentOnly(exercises, loc)
    .filter(e => !injuries.length || isTrue(e.shoulder_safe))
    .map(e => e.id);

  const result = await apiPost({
    action: 'agent',
    context: {
      location: loc,
      readiness: { sleep: preSleep, energy: preEnergy, soreness: preSoreness },
      injuries: injuries.map(i => ({ body_part: i.body_part, restrictions: i.restrictions })),
      kit: buildKitString(loc),
      memo: coachMemo,
      pendingProgressions,
      preNotes,
      availableExerciseIds,
    }
  });

  if (!result.plan) throw new Error(result.error || 'No plan returned');
  const parsed = result.plan;

  // Safety net: strip any exercise Gerald hallucinated outside the allowed list
  const allowedIds = new Set(availableExerciseIds);
  parsed.exercises = (parsed.exercises || []).filter(e => allowedIds.has(e.exercise_id));

  plan = parsed.exercises;
  const planIds = new Set(plan.map(e => e.exercise_id));
  pendingProgressions.forEach(p => { if (planIds.has(p.to)) appliedProgressions.add(p.from); });
  pendingProgressions = pendingProgressions.filter(p => !planIds.has(p.to));
  localStorage.setItem('pendingProgressions', JSON.stringify(pendingProgressions));
  localStorage.setItem('appliedProgressions', JSON.stringify([...appliedProgressions]));

  document.getElementById('review-title').textContent = "Coach's Workout";
  document.getElementById('review-sub').textContent = loc + ' · ' + new Date().toLocaleDateString('en-AU');
  document.getElementById('review-chat').innerHTML = '';
  renderPlanCards(parsed);
  goScreen('s-review');
}

async function generatePlan() {
  goScreen('s-generating');
  if (sType === "Coach's Workout") {
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
  const ssoPromise = cachedDebriefs !== null
    ? Promise.resolve(formatSSOContext(cachedDebriefs, sType, 6))
    : fetchSSOContext(6, sType);
  const [ssoContext, progRes, histRes, mpRes, memoRes] = await Promise.all([
    ssoPromise,
    api('getProgressionTree'),
    api('getSessionHistory', { limit: 15 }),
    api('getMovementPatterns'),
    apiPost({ action: 'getMemo' }).catch(() => ({ memo: null })),
  ]);
  coachMemo = memoRes.memo || '';
  const progRules = progRes.data || [];
  const progContext = progRules.length
    ? progRules.map(p => {
        const levers = (() => { try { return JSON.parse(p.intensity_levers || '[]'); } catch { return []; } })();
        return `${p.display_name}: target ${p.rep_target} @ RIR ${p.rir_target} for ${p.sessions_to_confirm} sessions → next: ${p.next_exercise_id || 'peak'}${p.next_requires ? ' (needs '+p.next_requires+')' : ''}. Levers: ${levers.slice(0,2).join(', ')}`;
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
  const injStr = injuries.length ? injuries.map(i => i.body_part + ': ' + i.restrictions).join('\n') : 'None';
  const shoulderGuard = injuries.some(i => i.active && /shoulder/i.test(i.body_part)) ? ' Protect the right shoulder.' : '';
  const kitStr = buildKitString(loc);
  const availEx = filterByEquipmentOnly(exercises, loc)
    .filter(e => !injuries.length || isTrue(e.shoulder_safe))
    .map(e => `${e.id} | ${e.display_name} (${e.category}, L${e.matrix_level||'?'}, ${e.equipment}${e.notes ? ', note: ' + e.notes : ''})`)
    .join('\n');
  const rawSets = histRes.sets || [];
  const rawSessions = histRes.sessions || [];
  const histStr = rawSets.length
    ? 'Last ' + rawSessions.length + ' sessions (all types — use to assess per-pattern frequency and loads):\n' +
      rawSets.map(s =>
        s.session_id.slice(0, 10) + ' | ' + (s.session_type || '') + ' | ' + s.exercise_id +
        ' S' + s.set_num + ': ' + s.reps + ' reps @ ' + s.weight_kg + 'kg' +
        (s.rir != null ? ' RIR' + s.rir : '') + (s.tempo ? ' ' + s.tempo : '') + (s.notes ? ' (' + s.notes + ')' : '')
      ).join('\n')
    : 'No recent history';
  const sessionFocus = {
    'Full Body A': 'Compound lower body + push + pull. Squat or hinge pattern, horizontal push, vertical or horizontal pull.',
    'Full Body B': 'Compound lower body + push + pull. Different pattern to Full Body A — hinge or lunge, different push/pull combo.',
    'Upper Body': 'Push and pull supersets. Horizontal push + vertical pull, vertical push + horizontal pull. No legs.',
    'Lower Body': 'Legs and hinge patterns only. Squat, hinge, lunge variations. No upper body pushing or pulling.',
    'Rings Only': 'All exercises on gymnastics rings. Push, pull, core — rings only. No KB.',
    'KB Only': 'All exercises with kettlebells only. No rings, no parallettes.',
  };
  const system = `You are Gerald — a training partner who knows James's history better than he does. You've watched every session, every set, every stall and every breakthrough. You talk like someone who trains alongside him: straight, familiar, no performance. You don't motivate, you observe and advise. You know he has maybe 45 minutes before life intervenes — so you don't waste his time.

Rules: lead with the insight, not the preamble. Use numbers. If something looks off, say it plainly. Max 120 words per response. Dry humour is fine. Motivation-poster energy is not.
${coachMemo ? `\nCOACH'S RUNNING NOTES (your persistent memory — read this first, it supersedes generic defaults):\n${coachMemo}\n` : ''}
${coachBrief ? `COACH PRESCRIPTION (follow this closely — it overrides generic session type):
${coachBrief}

` : ''}Phase: Lean bulk Q2 2026. Hypertrophy focus.
Session type: ${sType} — ${sessionFocus[sType] || ''}
Equipment available: ${kitStr}
Active injuries:\n${injStr}

RECENT DEBRIEF INTELLIGENCE (last 6 ${sType} sessions — use this to drive load, volume, and exercise selection):
${ssoContext}

MOVEMENT PATTERN ARCHITECTURE (scan cross-type history to identify what's overdue within this session's scope):
${patternsStr}

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

LOAD PRESCRIPTION PROTOCOL — follow this strictly when setting reps and weight:

For each exercise, find the last logged sets in the raw history. Then:

1. RIR 0 last session → athlete was at true limit. Hold load, reduce reps slightly or same reps, recover before pushing.
2. RIR 1 last session → at target intensity. Small progression: +1-2 reps if below rep range ceiling, or +weight if at ceiling.
3. RIR 2 last session → room to push. Increase reps toward top of range, or if already there, increase load.
4. RIR 3+ last session → undertested, NOT limited. Do NOT anchor to the logged rep count as a ceiling. Prescribe significantly more reps. Low reps + high RIR means the athlete stopped well short of capacity — push them.
5. No history → start conservative (RIR 2-3) but do not default to lowest possible reps.

CRITICAL: A low rep count paired with a high RIR means the session was conservative, not that the athlete can't do more. Use estimated capacity = logged reps + RIR as a floor, then prescribe at RIR 1-2.

EXERCISE ORDER: sequence exercises as they should be performed. Compounds and high-skill movements first (rings, heavy KB), accessories and isolation last. If the coach brief calls out a specific exercise to open with — honour it, put it first.

Generate a ${sType} workout. Return ONLY valid JSON, no markdown, no preamble:
{
  "session_notes": "one line tactical intent",
  "exercises": [
    { "exercise_id": "slug", "display_name": "Name", "sets": 4, "reps": "8-10", "weight": "32kg", "tempo": "3-0-1-0", "rir": 1, "notes": "cue" }
  ]
}
Rules: 4-6 exercises. Base load/volume on history.${shoulderGuard} Only use exercise_ids from the provided list. Select exercises appropriate for ${sType} — choose by movement pattern balance, training history, and injury context. Do not rigidly filter by session type tag; use your judgement across the full equipment-matched library.`;

  try {
    document.getElementById('gen-status').textContent = 'Building your plan...';
    preNotes = document.getElementById('pre-notes').value.trim();
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
