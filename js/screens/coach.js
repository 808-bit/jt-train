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
    document.getElementById('gen-btn').disabled = false;

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
    history = await api('getSessionHistory', { session_type: sType, limit: 3 });
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

    const system = `You are a strength and conditioning coach prescribing today's session for James.

RECENT SESSIONS:
${sessionSummary}

RECENT DEBRIEFS:
${debriefSummary}

TODAY'S READINESS: Sleep ${preSleep}/5 · Energy ${preEnergy}/5 · Soreness ${preSoreness}/5
LOCATION: ${loc}
ACTIVE INJURIES: ${injuries.length ? injuries.map(i=>i.body_part+': '+i.restrictions).join(', ') : 'None'}
AVAILABLE: ${buildKitString(loc)}

Think about:
- Which muscle groups need recovery
- What movement patterns haven't been trained recently
- Readiness level and what it can support
- Any injury constraints
- What exercises are primed for progression

Return ONLY valid JSON, no markdown:
{
  "session_type": "Full Body A",
  "headline": "Max 6 words. The session in a phrase.",
  "brief": "Max 12 words. Overall session intent — movement patterns and focus.",
  "cues": ["Max 8 words cue 1", "Max 8 words cue 2"],
  "reason": "Max 10 words. Why this, why now."
}`;

    const raw = await claude(system, [{ role:'user', content:'What should I train today?' }], HAIKU);
    const jsonStart = raw.indexOf('{');
    const jsonEnd   = raw.lastIndexOf('}');
    const rec = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));

    recommendedType = rec.session_type;
    coachBrief = rec.brief;
    sType = rec.session_type;

    document.getElementById('rec-loading').style.display = 'none';
    document.getElementById('rec-content').style.display = 'block';
    document.getElementById('rec-type').textContent  = rec.headline || rec.session_type;
    document.getElementById('rec-brief').textContent = rec.brief;
    const cuesEl = document.getElementById('rec-cues');
    cuesEl.innerHTML = (rec.cues || []).map(c =>
      `<div style="display:flex;gap:8px;align-items:flex-start;font-family:var(--font);font-size:11px;color:var(--text2);line-height:1.4;"><span style="color:var(--green);flex-shrink:0;">→</span><span>${c}</span></div>`
    ).join('');
    document.getElementById('rec-reason').textContent = rec.reason ? '─  ' + rec.reason : '';

    document.querySelectorAll('#session-pills .pill').forEach(p => {
      p.classList.remove('active');
      if (p.textContent.trim() === rec.session_type) p.classList.add('active');
    });

  } catch(e) {
    document.getElementById('rec-loading').innerHTML = '<div style="font-family:var(--font);font-size:11px;color:var(--text3);">Could not load — <button type="button" onclick="autoRecommend()" style="font-family:var(--font-ui);font-size:10px;color:var(--text2);background:none;border:none;cursor:pointer;text-decoration:underline;padding:0;">retry</button></div>';
    console.log('Recommendation failed:', e);
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

async function generatePlan() {
  goScreen('s-generating');
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
    const userMsg = 'Generate my ' + sType + ' workout. Location: ' + loc + (preNotes ? '\n\nPre-session notes from athlete: ' + preNotes : '');
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
