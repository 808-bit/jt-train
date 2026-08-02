/**
 * JT.TRAIN — Cloudflare Worker (D1 edition)
 *
 * GET  ?action=getActiveInjuries
 * GET  ?action=getExercises
 * GET  ?action=getSessionHistory&session_type=X&limit=3
 * GET  ?action=getProgressionData&exercise_id=X&limit=20
 * GET  ?action=getEquipmentConfig
 * GET  ?action=getAllProgressionData&limit=2000
 * GET  ?action=companionDigest    (read-only Companion bridge; X-Companion-Token)
 * POST { action: 'appendSession', data: {...} }
 * POST { action: 'appendSet', data: {...} }
 * POST { action: 'appendPlan', data: { session_id, exercises: [...] } }
 * POST { action: 'saveEquipmentConfig', location, config }
 * POST { action: 'deleteSession', session_id }
 * POST { action: 'claude', system, messages }
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-App-Token',
};

// ── Coaching constants — keep in sync with js/doctrine.js (separate runtime) ──
const TRAINING_PHASE = 'Lean bulk Q2 2026. Hypertrophy focus.';

const GERALD_PERSONA = `You are Gerald — a training partner who knows James's history better than he does. You've watched every session, every set, every stall and every breakthrough. You talk like someone who trains alongside him: straight, familiar, no performance. You don't motivate, you observe and advise. You know he has maybe 45 minutes before life intervenes — so you don't waste his time.

Rules: lead with the insight, not the preamble — never say "Great question" or "Based on your data". Use numbers, not vibes. If something looks off, say it plainly. Dry humour is fine. Motivation-poster energy is not.`;

const MODALITY_DOCTRINE = `EVIDENCE-BASED MODALITY CONTEXT (reference for judgement — apply where relevant, never recite papers verbatim or lecture):
James trains rings + kettlebells + calisthenics + parallettes. This stack is evidence-supported on its own terms — not a compromise for lacking a barbell:
- PROXIMITY TO FAILURE IS THE STIMULUS: Low-load and bodyweight training drive hypertrophy comparable to heavy-load training when sets are taken close to failure (Sports Medicine 2022 meta-analysis; push-up vs bench-press trials show comparable chest/triceps growth at matched effort). The decisive variable is RIR, not the implement or the kg. Judge a set by how close it ran to failure, not by tonnage.
- LONGEVITY: Large 30-year cohorts (BJSM 2026, n≈147k; BMJ Medicine 2026, n≈111k) link resistance training and calisthenics to lower all-cause mortality, with calisthenics measured comparably to weight training. Roughly 90–120 min/week of resistance work is the all-cause-mortality sweet spot; past ~120 min/week there is little added all-cause benefit, so pivot to quality and intensity rather than piling on volume. Variety across modalities is itself an independent longevity lever. (These cohorts did not all isolate calisthenics cleanly — treat the modality-specific figures as directional, not precise, and don't overstate a "ranking" between modalities.)
- STRENGTH → LONGEVITY: Greater muscular strength is inversely associated with mortality across populations and is highly trainable at any age. Getting stronger on the rings and bells is a direct longevity investment, not just an aesthetic one.
- KETTLEBELLS FILL THE LOWER-BODY GAP: KB training builds muscle, grip and lower-limb strength and lowers systemic inflammation markers (12-month trial in older adults). Bodyweight lower-body work drifts into cardio at high reps, so KB hinge/squat loading (swings, deadlifts, goblet/front squats) is the most evidence-critical slot in the week — it covers the lower-body hypertrophy that calisthenics leaves open.
PRACTICAL IMPLICATION: prize proximity to failure and consistency over raw tonnage; protect recovery rather than chasing minutes past the weekly sweet spot; keep modality variety high; treat KB lower-body loading as non-negotiable.`;

const BW_PROGRESSION_RULE = `BODYWEIGHT PROGRESSION: pure calisthenics has no "+weight" lever — progress it by harder leverage (e.g. ring push-up → RTO → archer → one-arm), slower tempo / longer eccentric, added pause, or unilateral variation. Add external load (vest/belt, KB) only where the movement allows it. For KB and weighted work, progress by load or reps per the RIR protocol.`;

// The agentic Coach's Workout path used to ship with no load-progression rule at
// all — its only guidance was the one-line RIR protocol, which says what an RIR
// value means but never says to compare against last session's load and move it.
// Result: double_kb_front_squat sat at 8 reps @ 44kg from Apr-Aug 2026, clearing
// its 3x8 target at RIR 1 five sessions running while the load never budged.
const LOAD_PROTOCOL = `LOAD PRESCRIPTION PROTOCOL — follow this strictly when setting reps and weight.

You are given each exercise's logged history (get_multi_exercise_history). For EVERY loaded exercise you prescribe, first read the last session's weight and RIR, then decide the step:

1. RIR 0 last session → at true limit. Hold load, same or slightly fewer reps.
2. RIR 1 last session → at target intensity. Small step: +1-2 reps.
3. RIR 2 last session → room to push. More reps still.
4. RIR 3+ last session → undertested, NOT limited. Do not treat the logged rep count as a ceiling. Estimated capacity = logged reps + RIR; prescribe from there at RIR 1-2.
5. No history → start conservative (RIR 2-3), but do not default to the lowest plausible reps.

REPS BEFORE LOAD (read this before touching a weight number): rep_target in this DB ("3x8" etc) is a FLOOR, not a ceiling — there is no stored rep range to "reach the top of" before adding load, so riding reps up past target at the current load IS the progression, and it's the default move whenever RIR allows it. Only step the load once reps have climbed for 2+ sessions and either plateaued (stopped increasing at RIR ≤1) or reached a point where more reps would tip the set into a different (endurance) stimulus — roughly 1.5x the rule's target reps. A load step is the LAST resort per exercise, not the first.

THE STALL RULE (this is the one that gets missed): if an exercise has MET its rep target at the SAME load for two or more sessions, prescribing that same load again is a mistake. But "something must change" means reps/tempo/pause/leverage FIRST — reach for a load change only once those are exhausted per REPS BEFORE LOAD above. check_progressions reports the stall directly as load_stalled / load_note; when you see it, act on it in the plan you return, reps first. Repeating a cleared prescription completely unchanged is the single worst failure mode here — jumping straight to a heavier load without trying reps first is the second worst.

check_progressions also returns intensity_levers for each ruled exercise — the sanctioned ways to make THAT lift harder without changing the movement. Where the DB lists both a rep-based lever and a load-based one ("Heavier bells"), the rep-based lever comes first per REPS BEFORE LOAD above, regardless of the order listed. Advancing to next_exercise_id is only one option, and the last one: exhaust the intensity levers on the current exercise before swapping it out, and never swap away from a lift purely because its target was met.

Never prescribe a load that isn't buildable from the owned kit. For double-KB work, when a load step is genuinely warranted, call get_equipment and step along its balanced ladder — a combo with a bigger total but a much bigger imbalance is a harder movement, not a heavier one, and it will fail on reps. This is exactly why reps come first: the next combo up is rarely an even step.`;

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    try {
      if (request.method === 'GET')  return await handleGet(request, env);
      if (request.method === 'POST') return await handlePost(request, env, ctx);
      return json({ error: 'Method not allowed' }, 405);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }
};

async function handleGet(request, env) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'getAgentJob') {
    const jobId = searchParams.get('job_id');
    if (!jobId) return json({ error: 'job_id required' }, 400);
    const row = await env.DB.prepare('SELECT status, result, error FROM agent_jobs WHERE id = ?').bind(jobId).first();
    if (!row) return json({ error: 'Job not found' }, 404);
    let result = null;
    if (row.result) { try { result = JSON.parse(row.result); } catch { /* leave null */ } }
    return json({ status: row.status, result, error: row.error });
  }

  if (action === 'getExercises') {
    const { results } = await env.DB.prepare(
      'SELECT e.*, mp.name AS pattern_name FROM exercises e LEFT JOIN movement_patterns mp ON e.movement_pattern_id = mp.id ORDER BY e.display_name'
    ).all();
    const data = results.map(e => ({
      ...e,
      home_available: e.home_available === 1 || e.home_available === true,
      shoulder_safe:  e.shoulder_safe  === 1 || e.shoulder_safe  === true,
      requires_pair:  e.requires_pair  === 1 || e.requires_pair  === true,
      session_type:   e.session_types || '',
    }));
    return json({ data });
  }

  if (action === 'getActiveInjuries') {
    const { results } = await env.DB.prepare(
      'SELECT * FROM injuries WHERE active = 1 ORDER BY date_start DESC'
    ).all();
    return json({ data: results });
  }

  if (action === 'getSessionHistory') {
    const sessionType = searchParams.get('session_type') || '';
    const limit = parseInt(searchParams.get('limit') || '3');
    const sessions = sessionType
      ? await env.DB.prepare(`SELECT * FROM sessions WHERE session_type = ? ORDER BY date DESC LIMIT ?`).bind(sessionType, limit).all()
      : await env.DB.prepare(`SELECT * FROM sessions ORDER BY date DESC LIMIT ?`).bind(limit).all();
    if (!sessions.results.length) return json({ sessions: [], sets: [] });
    const ids = sessions.results.map(s => `'${s.id}'`).join(',');
    const sets = await env.DB.prepare(`
      SELECT st.*, e.display_name, s.session_type FROM sets st
      JOIN exercises e ON st.exercise_id = e.id
      JOIN sessions s ON st.session_id = s.id
      WHERE st.session_id IN (${ids})
      ORDER BY st.session_id, st.id
    `).all();
    return json({ sessions: sessions.results, sets: sets.results });
  }

  if (action === 'getProgressionData') {
    const exerciseId = searchParams.get('exercise_id');
    const limit = parseInt(searchParams.get('limit') || '20');
    if (!exerciseId) return json({ error: 'exercise_id required' }, 400);
    const { results } = await env.DB.prepare(`
      SELECT s.date, s.session_type, st.set_num, st.reps, st.weight_kg, st.rir, st.tempo, st.notes,
             ROUND(st.weight_kg * (1 + st.reps / 30.0), 2) AS estimated_1rm
      FROM sets st JOIN sessions s ON st.session_id = s.id
      WHERE st.exercise_id = ? AND s.id NOT LIKE '%-H' ORDER BY s.date DESC, st.set_num ASC LIMIT ?
    `).bind(exerciseId, limit).all();
    return json({ data: results });
  }

  if (action === 'getEquipmentConfig') {
    const { results } = await env.DB.prepare(
      'SELECT location, config FROM location_config'
    ).all();
    const data = {};
    results.forEach(r => {
      try { data[r.location] = JSON.parse(r.config); } catch { data[r.location] = {}; }
    });
    return json({ data });
  }

  if (action === 'getAllProgressionData') {
    const limit = parseInt(searchParams.get('limit') || '2000');
    const { results } = await env.DB.prepare(`
      SELECT s.date, st.exercise_id, e.display_name,
             CAST(e.shoulder_safe AS INTEGER) AS shoulder_safe,
             e.bw_load_factor,
             st.set_num, st.reps, st.weight_kg, st.rir,
             bw.weight_kg AS bodyweight_kg,
             ROUND(st.weight_kg + e.bw_load_factor * COALESCE(bw.weight_kg, 0), 2) AS effective_load_kg,
             ROUND((st.weight_kg + e.bw_load_factor * COALESCE(bw.weight_kg, 0)) * (1 + st.reps / 30.0), 2) AS estimated_1rm
      FROM sets st
      JOIN sessions s ON st.session_id = s.id
      JOIN exercises e ON st.exercise_id = e.id
      LEFT JOIN body_metrics bw ON bw.id = (
        SELECT b.id FROM body_metrics b WHERE b.date <= s.date ORDER BY b.date DESC LIMIT 1
      )
      WHERE s.id NOT LIKE '%-H'
      ORDER BY s.date ASC, st.exercise_id, st.set_num
      LIMIT ?
    `).bind(limit).all();
    return json({ data: results });
  }

  if (action === 'getBodyMetrics') {
    const limit = parseInt(searchParams.get('limit') || '180');
    const { results } = await env.DB.prepare(
      'SELECT date, weight_kg, bodyfat_pct, notes FROM body_metrics ORDER BY date DESC LIMIT ?'
    ).bind(limit).all();
    return json({ data: results });
  }

  if (action === 'getWeeklyMinutes') {
    // Resistance minutes per ISO week. Real timer duration where we have it,
    // else the set-timestamp working span. Excludes historical imports (-H).
    const weeks = parseInt(searchParams.get('weeks') || '12');
    const { results } = await env.DB.prepare(`
      SELECT week, SUM(mins) AS mins, COUNT(*) AS sessions
      FROM (
        SELECT strftime('%Y-%W', s.date) AS week, s.id,
               COALESCE(s.duration_min,
                        (julianday(MAX(st.logged_at)) - julianday(MIN(st.logged_at))) * 1440.0) AS mins
        FROM sessions s
        LEFT JOIN sets st ON st.session_id = s.id
        WHERE s.id NOT LIKE '%-H'
        GROUP BY s.id
      )
      GROUP BY week
      ORDER BY week DESC
      LIMIT ?
    `).bind(weeks).all();
    return json({ data: results });
  }

  if (action === 'getPace') {
    // Minutes-per-set from recent sessions with real timestamps.
    // Backfilled imports have identical logged_at on every set (0-min span),
    // so the BETWEEN filter drops them along with abandoned sessions.
    const { results } = await env.DB.prepare(`
      SELECT COUNT(*) AS n,
             (julianday(MAX(logged_at)) - julianday(MIN(logged_at))) * 1440.0 AS mins
      FROM sets
      GROUP BY session_id
      HAVING COUNT(*) >= 5 AND mins BETWEEN 15 AND 150
      ORDER BY MAX(logged_at) DESC
      LIMIT 10
    `).all();
    const totSets = results.reduce((s, r) => s + r.n, 0);
    const totMins = results.reduce((s, r) => s + r.mins, 0);
    return json({
      minPerSet: totSets ? Math.round((totMins / totSets) * 100) / 100 : null,
      sessions: results.length,
    });
  }

  if (action === 'getSessions') {
    const sessionType = searchParams.get('session_type') || '';
    const limit  = parseInt(searchParams.get('limit')  || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    // Exclude historical CSV imports (-H suffix) from the history view
    const sessQuery = sessionType
      ? "SELECT * FROM sessions WHERE session_type = ? AND id NOT LIKE '%-H' ORDER BY date DESC LIMIT ? OFFSET ?"
      : "SELECT * FROM sessions WHERE id NOT LIKE '%-H' ORDER BY date DESC LIMIT ? OFFSET ?";
    const sessResult = sessionType
      ? await env.DB.prepare(sessQuery).bind(sessionType, limit, offset).all()
      : await env.DB.prepare(sessQuery).bind(limit, offset).all();
    const sessions = sessResult.results;
    if (!sessions.length) return json({ sessions: [], sets: [] });
    const ids = sessions.map(s => "'" + s.id + "'").join(',');
    const setsResult = await env.DB.prepare(
      'SELECT st.*, COALESCE(e.display_name, st.exercise_id) AS display_name, ROUND(st.weight_kg * (1 + st.reps / 30.0), 2) AS estimated_1rm ' +
      'FROM sets st LEFT JOIN exercises e ON st.exercise_id = e.id ' +
      'WHERE st.session_id IN (' + ids + ') ORDER BY st.session_id, st.exercise_id, st.set_num'
    ).all();
    const pbResult = await env.DB.prepare(
      'SELECT st.exercise_id, MAX(ROUND(st.weight_kg * (1 + st.reps / 30.0), 2)) AS best_e1rm FROM sets st GROUP BY st.exercise_id'
    ).all();
    const allTimeBest = {};
    pbResult.results.forEach(r => { allTimeBest[r.exercise_id] = r.best_e1rm; });
    const stats = {};
    setsResult.results.forEach(s => {
      if (!stats[s.session_id]) stats[s.session_id] = { volume: 0, setCount: 0, pbs: new Set() };
      stats[s.session_id].volume += (s.reps || 0) * (s.weight_kg || 0);
      stats[s.session_id].setCount++;
      const e1rm = parseFloat(s.estimated_1rm) || 0;
      if (e1rm > 0 && e1rm >= (allTimeBest[s.exercise_id] || 0)) stats[s.session_id].pbs.add(s.exercise_id);
    });
    const enriched = sessions.map(s => ({
      ...s,
      volume: Math.round(stats[s.id]?.volume || 0),
      set_count: stats[s.id]?.setCount || 0,
      pb_exercises: [...(stats[s.id]?.pbs || [])],
    }));
    return json({ sessions: enriched, sets: setsResult.results });
  }


  if (action === 'getMovementPatterns') {
    const { results: patterns } = await env.DB.prepare(
      'SELECT * FROM movement_patterns ORDER BY display_order'
    ).all();
    const { results: progressions } = await env.DB.prepare(
      'SELECT * FROM pattern_progressions ORDER BY pattern_id, level'
    ).all();
    return json({ patterns, progressions });
  }

  if (action === 'getProgressionTree') {
    const exerciseId = searchParams.get('exercise_id');
    if (exerciseId) {
      const { results } = await env.DB.prepare(
        'SELECT pr.*, e.display_name, e.matrix_level, e.modality FROM progression_rules pr JOIN exercises e ON pr.exercise_id = e.id WHERE pr.exercise_id = ?'
      ).bind(exerciseId).all();
      return json({ data: results });
    }
    const { results } = await env.DB.prepare(
      'SELECT pr.*, e.display_name, e.matrix_level, e.modality FROM progression_rules pr JOIN exercises e ON pr.exercise_id = e.id ORDER BY e.modality, e.matrix_level'
    ).all();
    return json({ data: results });
  }

  // Same stall/progression numbers the check_progressions tool returns, exposed
  // as a GET so the mid-workout coach can inject them without a tool loop —
  // latency matters when James is standing between sets.
  if (action === 'getProgressions') {
    return json({ data: await computeProgressions(env) });
  }

  // Recent sets for several exercises at once, for the same mid-workout inject.
  if (action === 'getMultiExerciseHistory') {
    const ids = (searchParams.get('exercise_ids') || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!ids.length) return json({ data: {} });
    const perEx = Math.min(parseInt(searchParams.get('limit_per_exercise')) || 6, 20);
    const placeholders = ids.map(() => '?').join(',');
    const { results } = await env.DB.prepare(`
      SELECT * FROM (
        SELECT st.exercise_id, s.date, st.set_num, st.reps, st.weight_kg, st.rir, st.notes,
               ROW_NUMBER() OVER (PARTITION BY st.exercise_id ORDER BY s.date DESC, st.set_num ASC) AS rn
        FROM sets st JOIN sessions s ON st.session_id = s.id
        WHERE st.exercise_id IN (${placeholders}) AND s.id NOT LIKE '%-H'
      ) WHERE rn <= ?
      ORDER BY exercise_id, rn
    `).bind(...ids, perEx).all();
    const out = {};
    for (const r of results) {
      (out[r.exercise_id] = out[r.exercise_id] || []).push({
        date: fmtD(r.date), set: r.set_num, reps: r.reps, kg: r.weight_kg, rir: r.rir, notes: r.notes,
      });
    }
    return json({ data: out });
  }

  if (action === 'getBenchmarks') {
    const exerciseId = searchParams.get('exercise_id');
    const query = exerciseId
      ? 'SELECT * FROM benchmarks WHERE exercise_id = ? ORDER BY CASE level WHEN \'beginner\' THEN 1 WHEN \'intermediate\' THEN 2 WHEN \'advanced\' THEN 3 END'
      : 'SELECT * FROM benchmarks ORDER BY exercise_id, CASE level WHEN \'beginner\' THEN 1 WHEN \'intermediate\' THEN 2 WHEN \'advanced\' THEN 3 END';
    const { results } = exerciseId
      ? await env.DB.prepare(query).bind(exerciseId).all()
      : await env.DB.prepare(query).all();
    return json({ data: results });
  }

  if (action === 'getAnalytics') {
    return await getAnalytics(env);
  }

  if (action === 'getRecentDebriefs') {
    const exerciseId   = searchParams.get('exercise_id');
    const sessionType  = searchParams.get('session_type') || '';
    const limit        = parseInt(searchParams.get('limit') || '5');
    let query, binds;
    if (sessionType) {
      query = 'SELECT * FROM debriefs WHERE session_type = ? ORDER BY date DESC LIMIT ?';
      binds = [sessionType, limit];
    } else {
      query = 'SELECT * FROM debriefs ORDER BY date DESC LIMIT ?';
      binds = [limit];
    }
    const { results } = await env.DB.prepare(query).bind(...binds).all();
    return json({ data: results });
  }

  // ── Companion bridge ───────────────────────────────────────────────────────
  // One consolidated read for the Companion app's "ask anything" brain. Companion
  // never touches jt-train-db directly — it fetches this JSON over HTTP and treats
  // it as one tool result. Gated behind COMPANION_TOKEN (a shared secret set on
  // both workers) via the X-Companion-Token header. If the secret is unset the
  // bridge stays closed. Everything here is read-only.
  if (action === 'companionDigest') {
    if (!env.COMPANION_TOKEN) return json({ error: 'Companion bridge not configured' }, 503);
    if (request.headers.get('X-Companion-Token') !== env.COMPANION_TOKEN) {
      return json({ error: 'Unauthorized' }, 401);
    }
    return await companionDigest(env);
  }

  return json({ error: 'Unknown action: ' + action }, 400);
}

// Assembles the Companion digest: bodyweight trend, last session + recency,
// this-week volume, training cadence, progression readiness, active injuries.
// Reuses the same queries as getBodyMetrics / getWeeklyMinutes / check_progressions
// so the numbers match the JT.TRAIN app exactly. Excludes historical imports (-H).
async function companionDigest(env) {
  const today = new Date().toISOString().slice(0, 10);

  // ── Bodyweight trend ──
  const bw = (await env.DB.prepare(
    'SELECT date, weight_kg, bodyfat_pct FROM body_metrics ORDER BY date DESC LIMIT 30'
  ).all()).results;
  const latest = bw[0] || null;
  // Closest weigh-in ≥28 days before the latest, for a monthly delta.
  let delta30 = null, ref30 = null;
  if (latest) {
    const cutoff = new Date(new Date(latest.date).getTime() - 28 * 864e5).toISOString().slice(0, 10);
    ref30 = bw.find((r) => r.date <= cutoff) || bw[bw.length - 1];
    if (ref30 && ref30.date !== latest.date) delta30 = +(latest.weight_kg - ref30.weight_kg).toFixed(1);
  }
  const bwTrend = delta30 == null ? 'flat' : delta30 > 0.3 ? 'up' : delta30 < -0.3 ? 'down' : 'flat';

  // ── Sessions (recent, non-historical) ──
  const sessions = (await env.DB.prepare(
    `SELECT id, date, session_type, location, rpe FROM sessions WHERE id NOT LIKE '%-H' ORDER BY date DESC LIMIT 60`
  ).all()).results;
  const last = sessions[0] || null;
  const daysSince = last ? Math.floor((new Date(today) - new Date(last.date)) / 864e5) : null;
  const since7  = new Date(new Date(today).getTime() - 7  * 864e5).toISOString().slice(0, 10);
  const since28 = new Date(new Date(today).getTime() - 28 * 864e5).toISOString().slice(0, 10);
  const last7  = sessions.filter((s) => s.date >= since7);
  const last28 = sessions.filter((s) => s.date >= since28);
  // Average gap over the last ~28 days of sessions.
  let avgGap = null;
  if (last28.length >= 2) {
    const span = (new Date(last28[0].date) - new Date(last28[last28.length - 1].date)) / 864e5;
    avgGap = +(span / (last28.length - 1)).toFixed(1);
  }

  // ── This-week volume (ISO week of the latest session's calendar) ──
  const weekRow = (await env.DB.prepare(`
    SELECT COUNT(DISTINCT s.id) AS sessions,
           ROUND(SUM(mins)) AS minutes
    FROM (
      SELECT s.id, s.date,
             COALESCE(s.duration_min,
                      (julianday(MAX(st.logged_at)) - julianday(MIN(st.logged_at))) * 1440.0) AS mins
      FROM sessions s
      LEFT JOIN sets st ON st.session_id = s.id
      WHERE s.id NOT LIKE '%-H' AND strftime('%Y-%W', s.date) = strftime('%Y-%W', 'now')
      GROUP BY s.id
    ) s
  `).first().catch(() => null));

  // ── Progression readiness (same logic as the check_progressions tool) ──
  const progRows = (await env.DB.prepare(`
    SELECT * FROM (
      SELECT pr.exercise_id, pr.rep_target, pr.rir_target, pr.sessions_to_confirm,
             pr.next_exercise_id, e.display_name,
             s.date, st.reps, st.weight_kg, st.rir,
             ROW_NUMBER() OVER (PARTITION BY pr.exercise_id ORDER BY s.date DESC, st.set_num DESC) AS rn
      FROM progression_rules pr
      JOIN exercises e ON pr.exercise_id = e.id
      JOIN sets st ON st.exercise_id = pr.exercise_id
      JOIN sessions s ON st.session_id = s.id
      WHERE s.id NOT LIKE '%-H'
    ) WHERE rn <= 5
    ORDER BY exercise_id, rn
  `).all()).results;
  const byExercise = new Map();
  for (const r of progRows) {
    if (!byExercise.has(r.exercise_id)) byExercise.set(r.exercise_id, []);
    byExercise.get(r.exercise_id).push(r);
  }
  const progression = [];
  for (const recent of byExercise.values()) {
    const rule = recent[0];
    // rep_target is 'SETSxREPS' ('3x10') or 'SETSxHOLDs' ('3x20s') — the per-set
    // target reps/seconds is the part after the 'x'. (The check_progressions tool
    // compares against the raw string, which coerces to NaN and never qualifies —
    // parse it properly here so readiness is real.)
    const targetReps = parseInt(String(rule.rep_target).split("x").pop());
    const qualifying = recent.filter((s) => s.reps >= targetReps && (s.rir ?? 99) <= rule.rir_target).length;
    progression.push({
      exercise: rule.display_name,
      target: `${rule.rep_target} @ RIR ≤${rule.rir_target} × ${rule.sessions_to_confirm}`,
      qualifying_sessions: qualifying,
      sessions_to_confirm: rule.sessions_to_confirm,
      ready: qualifying >= rule.sessions_to_confirm,
      next: rule.next_exercise_id || 'peak',
    });
  }
  // Ready first, then closest to ready.
  progression.sort((a, b) => (b.ready - a.ready) || (b.qualifying_sessions - a.qualifying_sessions));

  const injuries = (await env.DB.prepare(
    'SELECT body_part, restrictions FROM injuries WHERE active = 1 ORDER BY date_start DESC'
  ).all()).results;

  return json({
    generated_at: new Date().toISOString(),
    bodyweight: latest
      ? { latest_kg: latest.weight_kg, latest_date: latest.date, bodyfat_pct: latest.bodyfat_pct,
          delta_28d_kg: delta30, trend: bwTrend,
          points: bw.slice(0, 8).map((r) => ({ date: r.date, weight_kg: r.weight_kg })) }
      : null,
    last_session: last ? { ...last, days_ago: daysSince } : null,
    // Recent sessions (id/date/type/location/rpe) so the Companion can sync them into
    // its own life_log for briefings/chat. id is the stable dedup key on that side.
    recent_sessions: sessions.slice(0, 14),
    cadence: { days_since_last: daysSince, sessions_last_7d: last7.length, sessions_last_28d: last28.length, avg_gap_days: avgGap },
    this_week: { sessions: weekRow?.sessions ?? 0, minutes: weekRow?.minutes ?? 0 },
    progression_ready: progression,
    active_injuries: injuries,
  });
}

async function handlePost(request, env, ctx) {
  const body = await request.json();
  const { action } = body;

  // Anthropic-backed actions burn API credits — require the app token.
  // Other POST actions (set logging etc.) stay open so a lost token can't
  // block a workout mid-session.
  if (action === 'agent' || action === 'claude' || action === 'askAgent') {
    if (!env.APP_TOKEN || request.headers.get('X-App-Token') !== env.APP_TOKEN) {
      return json({ error: 'Unauthorized' }, 401);
    }
  }

  if (action === 'askAgent') {
    return json(await runAskAgent(body, env));
  }

  if (action === 'claude') {
    const { system, messages, model = 'claude-haiku-4-5-20251001', max_tokens = 2000 } = body;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model, max_tokens, system, messages }),
    });
    const data = await response.json();
    if (!response.ok) return json({ error: data }, response.status);
    const text = data.content?.map(b => b.text || '').join('') || '';
    return json({ text });
  }

  if (action === 'agent') {
    // Gerald's multi-iteration tool loop routinely takes 30-55s — long enough
    // that mobile Safari kills the client fetch ("Load failed") before the
    // response arrives, even though the Worker completes fine server-side.
    //
    // The client generates its own job_id, fires this POST fire-and-forget,
    // and polls ?action=getAgentJob for the result. We run the loop INSIDE the
    // live request (await) — a running request gets the full duration budget,
    // whereas ctx.waitUntil() AFTER returning a response is killed early (its
    // post-response grace window is far shorter than 55s). ctx.waitUntil(work)
    // additionally keeps the request alive if the phone disconnects mid-flight.
    const jobId = (typeof body.jobId === 'string' && body.jobId) ? body.jobId : crypto.randomUUID();
    await env.DB.prepare('INSERT OR IGNORE INTO agent_jobs (id, status) VALUES (?, ?)').bind(jobId, 'pending').run();
    ctx.waitUntil(env.DB.prepare("DELETE FROM agent_jobs WHERE created_at < datetime('now', '-1 day')").run());
    const work = runGeraldAgentJob(jobId, body, env);
    ctx.waitUntil(work);
    await work;
    return json({ job_id: jobId });
  }

  if (action === 'appendSession') {
    const r = body.data || {};
    const archetype = ['strength', 'power', 'restoration'].includes(r.archetype) ? r.archetype : null;
    await env.DB.prepare(`
      INSERT INTO sessions (id, phase_id, date, session_type, location, rpe, notes, ai_plan_used, pre_sleep, pre_energy, pre_soreness, duration_min, archetype)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET rpe = excluded.rpe, notes = excluded.notes,
        duration_min = COALESCE(excluded.duration_min, sessions.duration_min),
        archetype = COALESCE(excluded.archetype, sessions.archetype)
    `).bind(
      r.session_id || '', r.phase_id || 'lean-bulk-q2-2026',
      r.date || new Date().toISOString().slice(0, 10),
      r.session_type || '', r.location || 'Home',
      r.rpe_session || null, r.notes || null, r.ai_plan_used ? 1 : 0,
      r.pre_sleep || null, r.pre_energy || null, r.pre_soreness || null,
      (r.duration_min != null && !isNaN(parseFloat(r.duration_min))) ? parseFloat(r.duration_min) : null,
      archetype,
    ).run();
    return json({ ok: true });
  }

  if (action === 'appendSet') {
    const r = body.data || {};
    await env.DB.prepare(`
      INSERT INTO sets (session_id, exercise_id, set_num, reps, weight_kg, rir, tempo, notes, tut_seconds, rest_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      r.session_id || '', r.exercise_id || '', r.set_num || 1,
      r.reps || null, r.weight_kg || 0, r.rir || null, r.tempo || null, r.notes || null, r.tut_seconds || null, r.rest_seconds || null,
    ).run();
    return json({ ok: true });
  }

  if (action === 'appendPlan') {
    const { session_id, exercises = [] } = body.data || {};
    const stmts = exercises.map((e, i) =>
      env.DB.prepare(`
        INSERT INTO session_plan
          (session_id, exercise_id, order_num, prescribed_sets, prescribed_reps, prescribed_weight, tempo, rir, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(session_id, e.exercise_id, i + 1, e.sets || null, e.reps || null,
              e.weight || null, e.tempo || null, e.rir || null, e.notes || null)
    );
    await env.DB.batch(stmts);
    return json({ ok: true });
  }

  if (action === 'saveEquipmentConfig') {
    const { location, config } = body;
    await env.DB.prepare(`
      INSERT INTO location_config (location, config) VALUES (?, ?)
      ON CONFLICT(location) DO UPDATE SET config = excluded.config
    `).bind(location, JSON.stringify(config)).run();
    return json({ ok: true });
  }

  if (action === 'updateSession') {
    const { session_id, rpe, notes, pre_notes, auto_notes } = body;
    await env.DB.prepare(
      'UPDATE sessions SET rpe = COALESCE(?, rpe), notes = COALESCE(?, notes), pre_notes = COALESCE(?, pre_notes), auto_notes = COALESCE(?, auto_notes) WHERE id = ?'
    ).bind(rpe ?? null, notes ?? null, pre_notes ?? null, auto_notes ?? null, session_id).run();
    return json({ ok: true });
  }

  if (action === 'deleteSession') {
    const { session_id } = body;
    if (!session_id) return json({ error: 'session_id required' }, 400);
    await env.DB.prepare('DELETE FROM sets WHERE session_id = ?').bind(session_id).run();
    await env.DB.prepare('DELETE FROM session_plan WHERE session_id = ?').bind(session_id).run();
    await env.DB.prepare('DELETE FROM debriefs WHERE session_id = ?').bind(session_id).run();
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(session_id).run();
    return json({ ok: true });
  }




  if (action === 'saveDebrief') {
    const d = body.data || {};
    await env.DB.prepare(
      'INSERT INTO debriefs (session_id, date, session_type, total_volume_kg, total_sets, performance_signal, outcome, shoulder_flag, exercises_flagged, recommendation, raw_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(d.session_id, d.date, d.session_type, d.total_volume_kg||0, d.total_sets||0, d.performance_signal||'stable', d.outcome||'maintained', d.shoulder_flag?1:0, JSON.stringify(d.exercises_flagged||[]), d.recommendation||'', d.raw_json||'').run();
    return json({ ok: true });
  }


  if (action === 'addInjury') {
    const { body_part, restrictions } = body;
    const r = await env.DB.prepare(
      'INSERT INTO injuries (body_part, restrictions, active, date_start) VALUES (?, ?, 1, ?)'
    ).bind(body_part, restrictions||'', new Date().toISOString().slice(0,10)).run();
    return json({ ok: true, id: r.meta?.last_row_id });
  }

  if (action === 'updateInjury') {
    const { id, active } = body;
    await env.DB.prepare('UPDATE injuries SET active = ?, date_end = ? WHERE id = ?')
      .bind(active, active===0 ? new Date().toISOString().slice(0,10) : null, id).run();
    return json({ ok: true });
  }

  if (action === 'getMemo') {
    const r = await env.DB.prepare('SELECT memo, updated_at FROM coach_memo WHERE id = ?').bind('singleton').first();
    return json({ memo: r?.memo || null, updated_at: r?.updated_at || null });
  }

  if (action === 'saveMemo') {
    const { memo } = body;
    if (!memo) return json({ error: 'memo required' }, 400);
    await env.DB.prepare('INSERT OR REPLACE INTO coach_memo (id, memo, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)')
      .bind('singleton', memo).run();
    return json({ ok: true });
  }

  if (action === 'logBodyMetric') {
    const r = body.data || body;
    const date = r.date || new Date().toISOString().slice(0, 10);
    const weight = parseFloat(r.weight_kg);
    if (!weight || isNaN(weight)) return json({ error: 'weight_kg required' }, 400);
    const bf = (r.bodyfat_pct === '' || r.bodyfat_pct == null) ? null : parseFloat(r.bodyfat_pct);
    await env.DB.prepare(`
      INSERT INTO body_metrics (date, weight_kg, bodyfat_pct, notes)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        weight_kg = excluded.weight_kg,
        bodyfat_pct = COALESCE(excluded.bodyfat_pct, body_metrics.bodyfat_pct),
        notes = COALESCE(excluded.notes, body_metrics.notes),
        logged_at = CURRENT_TIMESTAMP
    `).bind(date, weight, bf, r.notes || null).run();
    return json({ ok: true });
  }

  return json({ error: 'Unknown action: ' + action }, 400);

}

// ─── Analytics ───────────────────────────────────────────────────────────────

async function getAnalytics(env) {
  const [sessRes, setsRes, planRes, injRes, debriefRes] = await env.DB.batch([
    env.DB.prepare(`SELECT id, date, session_type, pre_sleep, pre_energy FROM sessions ORDER BY date`),
    env.DB.prepare(`
      SELECT s.date, st.session_id, st.exercise_id, st.reps, st.weight_kg, st.rir, st.notes,
             e.display_name, e.movement_pattern
      FROM sets st
      JOIN sessions s ON st.session_id = s.id
      JOIN exercises e ON st.exercise_id = e.id
      ORDER BY s.date`),
    env.DB.prepare(`
      SELECT sp.session_id, sp.exercise_id, sp.prescribed_sets,
             COALESCE(e.display_name, sp.exercise_id) AS display_name, s.date, s.session_type
      FROM session_plan sp
      JOIN sessions s ON sp.session_id = s.id
      LEFT JOIN exercises e ON sp.exercise_id = e.id
      ORDER BY s.date DESC`),
    env.DB.prepare(`SELECT id, body_part, active, date_start, date_end FROM injuries WHERE date_start IS NOT NULL ORDER BY date_start DESC`),
    env.DB.prepare(`SELECT session_id, performance_signal, outcome FROM debriefs`),
  ]);
  const sessions = sessRes.results, sets = setsRes.results, plans = planRes.results,
        injuries = injRes.results, debriefs = debriefRes.results;

  const today = sydneyToday();
  const dayNum = d => Math.floor(new Date(d).getTime() / 86400000);
  const todayN = dayNum(today);

  // ── Recency + frequency ──
  const sessionDates = [...new Set(sessions.map(s => s.date))].sort();
  const lastDate = sessionDates[sessionDates.length - 1] || null;
  const daysSince = lastDate ? todayN - dayNum(lastDate) : null;
  const sessionsPerWeek = +(sessionDates.filter(d => todayN - dayNum(d) < 56).length / 8).toFixed(1);

  // ── Heatmap: sets per day, last 119 days (17 weeks) ──
  const setsPerDay = {};
  sets.forEach(s => { if (todayN - dayNum(s.date) < 119) setsPerDay[s.date] = (setsPerDay[s.date] || 0) + 1; });
  sessionDates.forEach(d => { if (todayN - dayNum(d) < 119 && !setsPerDay[d]) setsPerDay[d] = 1; });

  // ── Pattern dose: hard sets (RIR ≤ 2) per week + share, last 28 days ──
  const recent = sets.filter(s => todayN - dayNum(s.date) < 28);
  const pat = {};
  recent.forEach(s => {
    const p = s.movement_pattern || 'other';
    pat[p] = pat[p] || { total: 0, hard: 0 };
    pat[p].total++;
    if (s.rir != null && s.rir <= 2) pat[p].hard++;
  });
  const totalRecent = recent.length || 1;
  const patterns = Object.entries(pat)
    .map(([pattern, v]) => ({
      pattern,
      hardPerWeek: +(v.hard / 4).toFixed(1),
      sharePct: Math.round((v.total / totalRecent) * 100),
    }))
    .sort((a, b) => b.sharePct - a.sharePct);

  // ── Adherence: prescribed vs logged sets, last 10 planned sessions ──
  // prescribed_sets counts L+R as one set for unilateral lifts, but those log
  // one row per side ("L side"/"R side" in notes) — count sided rows as half
  // so actual is in the same unit as prescribed.
  const actualSets = {};
  sets.forEach(s => {
    const k = s.session_id + '|' + s.exercise_id;
    actualSets[k] = (actualSets[k] || 0) + (/^[LR] side/.test(s.notes || '') ? 0.5 : 1);
  });
  const planBySession = new Map();
  plans.forEach(p => {
    if (!planBySession.has(p.session_id)) planBySession.set(p.session_id, { date: p.date, type: p.session_type, items: [] });
    planBySession.get(p.session_id).items.push(p);
  });
  const skipCounts = {};
  const adherenceSessions = [...planBySession.entries()].slice(0, 10).map(([sid, sess]) => {
    let prescribed = 0, done = 0;
    const items = sess.items.map(p => {
      const planned = p.prescribed_sets || 0;
      const actual = actualSets[sid + '|' + p.exercise_id] || 0;
      prescribed += planned;
      done += Math.min(actual, planned);
      const status = actual === 0 ? 'skipped' : actual >= planned ? 'done' : 'partial';
      if (status === 'skipped') skipCounts[p.display_name] = (skipCounts[p.display_name] || 0) + 1;
      return { name: p.display_name, planned, actual, status };
    });
    return { date: sess.date, type: sess.type, pct: prescribed ? Math.round((done / prescribed) * 100) : null, items };
  }).filter(s => s.pct != null);
  const avgAdherence = adherenceSessions.length
    ? Math.round(adherenceSessions.reduce((s, x) => s + x.pct, 0) / adherenceSessions.length) : null;
  const mostSkipped = Object.entries(skipCounts).sort((a, b) => b[1] - a[1])[0] || null;

  // ── Readiness vs results ──
  const debriefBySession = {};
  debriefs.forEach(d => { debriefBySession[d.session_id] = d; });
  const volBySession = {};
  sets.forEach(s => { volBySession[s.session_id] = (volBySession[s.session_id] || 0) + (s.reps || 0) * (s.weight_kg || 0); });
  const bands = { low: [], moderate: [], high: [] };
  sessions.forEach(s => {
    if (s.pre_sleep == null && s.pre_energy == null) return;
    const band = (s.pre_sleep <= 2 || s.pre_energy <= 2) ? 'low'
               : (s.pre_sleep >= 4 && s.pre_energy >= 4) ? 'high' : 'moderate';
    const d = debriefBySession[s.id];
    bands[band].push({
      volume: volBySession[s.id] || 0,
      progressed: d ? (d.outcome === 'progressed' || d.performance_signal === 'improving') : null,
    });
  });
  const readiness = Object.entries(bands).map(([band, arr]) => {
    const rated = arr.filter(x => x.progressed != null);
    return {
      band,
      sessions: arr.length,
      avgVolume: arr.length ? Math.round(arr.reduce((s, x) => s + x.volume, 0) / arr.length) : 0,
      progressedPct: rated.length ? Math.round(rated.filter(x => x.progressed).length / rated.length * 100) : null,
    };
  });

  // ── Injury impact: best set before vs during vs after each injury ──
  // Best value per exercise per day: e1RM when loaded, reps when bodyweight.
  // (Best-set comparison, not regression slope — at 1-2 sessions/week the
  // windows are too sparse for slopes to mean anything.)
  const daily = {};
  sets.forEach(s => {
    const loaded = s.weight_kg > 0;
    const val = loaded ? s.weight_kg * (1 + (s.reps || 0) / 30) : (s.reps || 0);
    if (val <= 0) return;
    const ex = daily[s.exercise_id] = daily[s.exercise_id] || { name: s.display_name, unit: loaded ? 'kg' : 'reps', days: {} };
    if (!ex.days[s.date] || val > ex.days[s.date]) ex.days[s.date] = val;
  });
  const bestIn = (ex, from, to) => {
    const vals = Object.entries(ex.days).filter(([d]) => d >= from && d <= to).map(([, v]) => v);
    return vals.length ? Math.max(...vals) : null;
  };
  const addDays = (dateStr, n) => new Date(new Date(dateStr).getTime() + n * 86400000).toISOString().slice(0, 10);

  const injuryImpact = injuries
    .filter(inj => inj.active || dayNum(inj.date_end || today) - dayNum(inj.date_start) >= 2)
    .map(inj => {
      const start = inj.date_start;
      const end = inj.date_end || today;
      const preFrom = addDays(start, -56);
      const freq = range => {
        const ds = sessionDates.filter(d => d >= range[0] && d <= range[1]);
        const weeks = Math.max((dayNum(range[1]) - dayNum(range[0])) / 7, 1);
        return +(ds.length / weeks).toFixed(1);
      };
      const exercises = Object.values(daily).map(ex => {
        const pre = bestIn(ex, preFrom, addDays(start, -1));
        const during = bestIn(ex, start, end);
        const post = inj.date_end ? bestIn(ex, addDays(end, 1), addDays(end, 56)) : null;
        if (pre == null || during == null) return null;
        return {
          name: ex.name, unit: ex.unit,
          pre: +pre.toFixed(1), during: +during.toFixed(1), post: post != null ? +post.toFixed(1) : null,
          deltaPct: Math.round(((during - pre) / pre) * 100),
        };
      }).filter(Boolean).sort((a, b) => a.deltaPct - b.deltaPct).slice(0, 8);
      return {
        body_part: inj.body_part,
        active: !!inj.active,
        date_start: start,
        date_end: inj.date_end,
        days: dayNum(end) - dayNum(start),
        freqPre: freq([preFrom, addDays(start, -1)]),
        freqDuring: freq([start, end]),
        exercises,
      };
    });

  return json({
    daysSince, sessionsPerWeek,
    heatmap: setsPerDay,
    patterns,
    adherence: {
      avgPct: avgAdherence,
      mostSkipped: mostSkipped ? { name: mostSkipped[0], times: mostSkipped[1], outOf: adherenceSessions.length } : null,
      sessions: adherenceSessions,
    },
    readiness,
    injuries: injuryImpact,
  });
}

// ─── Gerald Agent ────────────────────────────────────────────────────────────

const GERALD_TOOLS = [
  {
    name: 'assess_training_state',
    description: 'Scan recent training to identify which movement patterns are overdue, days since each was last trained, and what recent debrief signals say. Call this first.',
    input_schema: {
      type: 'object',
      properties: { days_back: { type: 'number', description: 'Days of history to scan. Default 21.' } }
    }
  },
  {
    name: 'get_available_exercises',
    description: 'List exercises available today, optionally filtered by movement pattern(s), annotated with each exercise\'s own last-trained date and how many times it\'s been logged in the last 42 days — use this to avoid defaulting to the same exercise every session when a fresher, equally-valid option satisfies the same pattern gap. Pass every pattern you want to target in ONE call via movement_patterns — do not call this once per pattern.',
    input_schema: {
      type: 'object',
      properties: {
        movement_pattern: { type: 'string', description: 'Deprecated single-pattern filter — prefer movement_patterns.' },
        movement_patterns: { type: 'array', items: { type: 'string' }, description: 'Filter by one or more pattern_ids from assess_training_state, e.g. ["mp_horiz_pull","mp_anterior_squat"]. One of "mp_horiz_push", "mp_vert_push", "mp_horiz_pull", "mp_vert_pull", "mp_posterior_hinge", "mp_anterior_squat", "mp_carry", "mp_core", "mp_rehab", "mp_power_conditioning". Omit for all.' }
      }
    }
  },
  {
    name: 'get_exercise_history',
    description: 'Get recent sets for a specific exercise — dates, reps, weight, RIR. Use to set precise load and rep targets for exercises you plan to include.',
    input_schema: {
      type: 'object',
      properties: {
        exercise_id: { type: 'string', description: 'Exercise ID, e.g. "ring_rows"' },
        limit: { type: 'number', description: 'Sets to return. Default 8.' }
      },
      required: ['exercise_id']
    }
  },
  {
    name: 'check_progressions',
    description: 'Check which exercises are approaching or ready to advance to the next tier based on recent performance vs targets.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'get_weekly_load',
    description: 'Get hard sets logged per movement pattern this ISO week and last week, plus total sessions this week. Call this after assess_training_state to understand accumulated fatigue before sizing today\'s volume.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'get_multi_exercise_history',
    description: 'Get recent sets for multiple exercises in one call. Use instead of calling get_exercise_history repeatedly — pass all the exercise_ids you need load data for at once.',
    input_schema: {
      type: 'object',
      properties: {
        exercise_ids: { type: 'array', items: { type: 'string' }, description: 'Array of exercise IDs to fetch history for, e.g. ["ring_rows", "kb_deadlift"]' },
        limit_per_exercise: { type: 'number', description: 'Sets to return per exercise. Default 6.' }
      },
      required: ['exercise_ids']
    }
  },
  {
    name: 'get_body_metrics',
    description: 'Get recent bodyweight and body composition trend. Use when you need to calculate effective load for calisthenics or assess whether lean bulk is tracking.',
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of recent entries to return. Default 8.' }
      }
    }
  },
  {
    name: 'get_equipment',
    description: 'Read the equipment inventory for today\'s location straight from the DB: owned kettlebell weights, whether matching pairs exist, other kit, and a KB LADDER analysis — internal gaps (a jump to the next owned bell that skips a rung) and the next rung above the top bell. Use this when sizing loads near a progression threshold or when advising on next-weight jumps and which bell to buy next. Recommend a purchase ONLY to bridge a genuine gap, and label it as a purchase, never as owned kit.',
    input_schema: { type: 'object', properties: {} }
  }
];

// James trains in Australia — date math must use Sydney "today", not UTC,
// or every morning session before ~10am AEST computes gaps against yesterday.
function sydneyToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' });
}

function fmtD(dateStr) {
  if (!dateStr) return '';
  const [, m, d] = dateStr.slice(0, 10).split('-').map(Number);
  return `${d} ${'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[m - 1]}`;
}

// progression_rules.intensity_levers is a JSON array stored as TEXT, but older
// rows hold a bare comma-separated string. Tolerate both; never throw into the
// tool loop over a malformed cell.
function parseJSONArray(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [String(v)];
  } catch {
    return String(raw).split(',').map(s => s.trim()).filter(Boolean);
  }
}

// Most progression_rules rows have no intensity_levers recorded, which left a
// stalled lift flagged as stalled with nothing sanctioned to reach for. Derive a
// generic set from what the DB does know (modality + whether the target is a
// timed hold), ordered reps-first to match LOAD_PROTOCOL. Flagged as generic in
// the tool result so exercise-specific levers, where they exist, clearly win.
function defaultLevers(modality, repTarget, equipment) {
  const isHold = /s$/.test(String(repTarget || '').split('x').pop() || '');
  if (isHold) return ['Longer hold', 'Stricter position', 'Multiple holds with short rest', 'Harder leverage'];
  const loaded = modality === 'kettlebell' || modality === 'hybrid' || /KB|Barbell|Dumbbell/i.test(equipment || '');
  return loaded
    ? ['Add reps at current load', 'Slower eccentric (3-4s)', 'Pause at the hard position', 'Heavier bell once reps plateau']
    : ['Add reps', 'Slower eccentric (3-4s)', 'Pause at the hard position', 'Harder leverage or unilateral variation'];
}

// Standard kettlebell sizes step by 4kg. Shared by get_equipment's single-bell
// ladder and the double-KB combo ladder below.
const KB_RUNGS = [8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48];

// Double-KB load ladder. When only singles are owned, a "heavier" double-KB set
// is a different PAIR, and the pairs available are not evenly spaced — nor are
// they interchangeable. Racking 20+32 is not 20+24 plus 8kg: the 12kg imbalance
// changes the movement. Total load alone therefore can't drive progression, so
// every combo carries its imbalance and a balanced/unbalanced verdict.
const KB_BALANCED_MAX_IMBALANCE = 4;

function kbComboLadder(owned, kbPairs) {
  const combos = [];
  if (kbPairs) {
    // Matching pairs: the clean ladder is 2× each owned bell.
    for (const w of owned) combos.push({ bells: `${w}+${w}`, total_kg: w * 2, imbalance_kg: 0 });
  }
  for (let i = 0; i < owned.length; i++) {
    for (let j = i + 1; j < owned.length; j++) {
      combos.push({ bells: `${owned[i]}+${owned[j]}`, total_kg: owned[i] + owned[j], imbalance_kg: owned[j] - owned[i] });
    }
  }
  combos.forEach(c => { c.balanced = c.imbalance_kg <= KB_BALANCED_MAX_IMBALANCE; });
  combos.sort((a, b) => a.total_kg - b.total_kg || a.imbalance_kg - b.imbalance_kg);
  return combos;
}

// Which unowned bell would most improve the balanced double-KB ladder, and what
// it unlocks. This is the analysis that catches a stall the single-bell ladder
// misses entirely: owning 16/20/24/32 gives balanced doubles at only 36kg and
// 44kg, so a lift that has outgrown 44kg has nowhere balanced to go.
function kbPurchaseOptions(owned, kbPairs) {
  const current = kbComboLadder(owned, kbPairs).filter(c => c.balanced).map(c => c.total_kg);
  const currentSet = new Set(current);
  const options = [];
  for (const cand of KB_RUNGS) {
    if (owned.includes(cand)) continue;
    const after = kbComboLadder([...owned, cand].sort((a, b) => a - b), kbPairs).filter(c => c.balanced);
    const unlocks = after.filter(c => !currentSet.has(c.total_kg));
    if (unlocks.length) {
      options.push({
        buy_kg: cand,
        unlocks_balanced_totals: unlocks.map(c => `${c.bells}=${c.total_kg}kg (±${c.imbalance_kg}kg)`),
        balanced_ladder_after_kg: after.map(c => c.total_kg),
      });
    }
  }
  // Best first: most new balanced rungs, then lightest/cheapest bell.
  options.sort((a, b) => b.unlocks_balanced_totals.length - a.unlocks_balanced_totals.length || a.buy_kg - b.buy_kg);
  return options;
}

// Progression/stall analysis over progression_rules. Extracted from the
// check_progressions tool so the mid-workout coach can consume the same numbers
// through a plain GET — the two paths must never drift into disagreeing about
// whether a lift is stalled.
async function computeProgressions(env) {
  // Window by SESSION, not by set. sessions_to_confirm counts sessions, so a
  // 5-set window (~1.7 sessions of a 3x8 lift) can never evaluate it honestly
  // — it used to count qualifying SETS against a SESSION threshold, so three
  // good sets in one session read as "confirmed twice" and marked the lift
  // ready off a single day's work.
  const PROG_SESSION_WINDOW = 6;
  const { results: rows } = await env.DB.prepare(`
      SELECT * FROM (
        SELECT pr.exercise_id, pr.rep_target, pr.rir_target, pr.sessions_to_confirm,
               pr.next_exercise_id, pr.intensity_levers, pr.notes AS rule_notes,
               e.display_name, e.modality, e.equipment,
               s.date, st.set_num, st.reps, st.weight_kg, st.rir,
               DENSE_RANK() OVER (PARTITION BY pr.exercise_id ORDER BY s.date DESC) AS session_rn
        FROM progression_rules pr
        JOIN exercises e ON pr.exercise_id = e.id
        JOIN sets st ON st.exercise_id = pr.exercise_id
        JOIN sessions s ON st.session_id = s.id
        WHERE s.id NOT LIKE '%-H'
      ) WHERE session_rn <= ${PROG_SESSION_WINDOW}
      ORDER BY exercise_id, session_rn, set_num
    `).all();

    const byExercise = new Map();
    for (const r of rows) {
      if (!byExercise.has(r.exercise_id)) byExercise.set(r.exercise_id, []);
      byExercise.get(r.exercise_id).push(r);
    }

    const status = [];
    for (const recent of byExercise.values()) {
      const rule = recent[0];
      // rep_target is 'SETSxREPS' ('3x10') / 'SETSxHOLDs' ('3x20s'). Both halves
      // matter: the part after 'x' is the per-set target, the part before is how
      // many sets have to hit it for the session to count.
      const parts = String(rule.rep_target).split('x');
      const targetReps = parseInt(parts[parts.length - 1]);
      const targetSets = parts.length > 1 ? (parseInt(parts[0]) || 1) : 1;

      // Group the window's sets into sessions (one per date).
      const sessions = new Map();
      for (const s of recent) {
        if (!sessions.has(s.date)) sessions.set(s.date, []);
        sessions.get(s.date).push(s);
      }

      const sessionRows = [...sessions.entries()].map(([date, sets]) => {
        const good = sets.filter(s => s.reps >= targetReps && (s.rir ?? 99) <= rule.rir_target).length;
        const weights = sets.map(s => s.weight_kg).filter(w => w != null);
        return {
          date: fmtD(date),
          sets: sets.map(s => `${s.reps}r ${s.weight_kg ?? 'bw'}kg RIR${s.rir ?? '?'}`).join(' | '),
          top_weight_kg: weights.length ? Math.max(...weights) : null,
          qualifying_sets: good,
          qualifies: good >= targetSets,
        };
      });

      const qualifyingRows = sessionRows.filter(s => s.qualifies);
      const qualifyingSessions = qualifyingRows.length;
      // Consecutive run from the most recent session, reported for judgement but
      // NOT used to gate `ready`: a failed probe at a heavier load breaks the
      // streak, which would punish exactly the session where he tried to move up.
      let consecutive = 0;
      for (const s of sessionRows) { if (s.qualifies) consecutive++; else break; }

      const ruleLevers = parseJSONArray(rule.intensity_levers);
      const leversAreGeneric = ruleLevers.length === 0;
      const levers = leversAreGeneric
        ? defaultLevers(rule.modality, rule.rep_target, rule.equipment)
        : ruleLevers;
      const ready = qualifyingSessions >= rule.sessions_to_confirm;

      // A lift that keeps clearing its target at an unchanged load is stalled on
      // the LOAD axis, whatever the exercise-advance rule says. Compare only the
      // sessions that MET the target — comparing every session's top weight lets
      // a one-off heavy probe (a 48kg single that failed) hide a standing stall.
      const qTops = qualifyingRows.map(s => s.top_weight_kg).filter(w => w != null);
      const stalledAtKg = (qTops.length >= 2 && qTops.every(w => w === qTops[0])) ? qTops[0] : null;

      // Has he actually tried riding reps up at the stalled load, or has every
      // session stopped right at the fixed target? rep_target has no ceiling in
      // this schema, so ~1.5x target is used as "reps genuinely plateaued" —
      // below that, the honest advice is push reps before touching load.
      const repsAtStallWeight = stalledAtKg != null
        ? recent.filter(s => (s.weight_kg ?? 0) === stalledAtKg).map(s => s.reps)
        : [];
      const maxRepsAtStall = repsAtStallWeight.length ? Math.max(...repsAtStallWeight) : targetReps;
      const repsCeiling = Math.ceil(targetReps * 1.5);
      const repsPlateaued = maxRepsAtStall >= repsCeiling;

      status.push({
        exercise: rule.display_name,
        id: rule.exercise_id,
        target: `${rule.rep_target} @ RIR ≤${rule.rir_target}, confirmed over ${rule.sessions_to_confirm} session(s)`,
        sessions_examined: sessionRows.length,
        qualifying_sessions: qualifyingSessions,
        consecutive_qualifying_sessions: consecutive,
        sessions_to_confirm: rule.sessions_to_confirm,
        ready,
        next: rule.next_exercise_id || 'peak',
        intensity_levers: levers,
        intensity_levers_are_generic: leversAreGeneric,
        rule_notes: rule.rule_notes || '',
        recent_sessions: sessionRows,
        load_stalled: stalledAtKg != null,
        // A bodyweight lift logs weight_kg 0, so "stalled at 0kg / add load" would
        // be nonsense advice — for those the levers are leverage, tempo and pause.
        load_note: stalledAtKg == null ? ''
          : stalledAtKg > 0
            ? (repsPlateaued
                ? `STALLED: target met in ${qTops.length} session(s) at an unchanged ${stalledAtKg}kg, and reps have already climbed to ${maxRepsAtStall} (target ${targetReps}) — genuinely plateaued. A load or lever change is warranted now (see intensity_levers); a heavier double-KB combo is often a bigger imbalance, not a clean step — check get_equipment before picking one.`
                : `STALLED: target met in ${qTops.length} session(s) at an unchanged ${stalledAtKg}kg, but reps have never exceeded ${maxRepsAtStall} (target ${targetReps}) — he hasn't actually tried pushing reps at this load yet. REPS FIRST: push past ${targetReps} reps at ${stalledAtKg}kg today before considering more load. Do not re-prescribe ${stalledAtKg}kg for the exact same rep count again.`)
            : (repsPlateaued
                ? `STALLED: target met in ${qTops.length} session(s) at unchanged bodyweight, and reps have already climbed to ${maxRepsAtStall} (target ${targetReps}) — genuinely plateaued. This is a bodyweight lift with no "+kg" lever: reach for harder leverage, slower eccentric, added pause, or a unilateral variation now (see intensity_levers).`
                : `STALLED: target met in ${qTops.length} session(s) at unchanged bodyweight, but reps have never exceeded ${maxRepsAtStall} (target ${targetReps}) — he hasn't actually tried pushing reps yet. Push past ${targetReps} reps today before reaching for a harder variation. Do not re-prescribe the same variation and rep count again.`),
      });
    }
  return status;
}

async function executeTool(toolName, toolInput, context, env) {
  const { availableExerciseIds = [], injuries = [] } = context;

  if (toolName === 'assess_training_state') {
    const daysBack = toolInput.days_back || 21;
    const today = sydneyToday();
    const cutoff = new Date(new Date(today) - daysBack * 86400000).toISOString().slice(0, 10);
    const [setsRes, debriefRes] = await Promise.all([
      env.DB.prepare(`
        SELECT s.date, e.movement_pattern_id AS pattern_id, mp.name AS pattern_name, st.exercise_id, e.display_name
        FROM sets st
        JOIN sessions s ON st.session_id = s.id
        JOIN exercises e ON st.exercise_id = e.id
        LEFT JOIN movement_patterns mp ON e.movement_pattern_id = mp.id
        WHERE s.date >= ? AND s.id NOT LIKE '%-H'
        ORDER BY s.date DESC
      `).bind(cutoff).all(),
      env.DB.prepare(`SELECT * FROM debriefs WHERE date >= ? ORDER BY date DESC LIMIT 8`).bind(cutoff).all(),
    ]);

    // Grouped by the fine-grained pattern (e.g. "Horizontal Pull" vs "Vertical
    // Pull" separately) — not the coarse 8-bucket field, which lumped ring
    // rows and pull-ups together as one "pull" and made vertical pull look
    // covered whenever only horizontal pull had actually been trained.
    const patternDates = {};
    setsRes.results.forEach(s => {
      const key = s.pattern_id || 'unknown';
      if (!patternDates[key] || s.date > patternDates[key].date) {
        patternDates[key] = { date: s.date, name: s.pattern_name || 'Unknown' };
      }
    });
    const patternGaps = Object.entries(patternDates)
      .map(([id, v]) => ({
        pattern: v.name,
        pattern_id: id,
        last_trained: fmtD(v.date),
        days_ago: Math.round((new Date(today) - new Date(v.date)) / 86400000),
      }))
      .sort((a, b) => b.days_ago - a.days_ago);

    const recentDebriefs = debriefRes.results.map(d => {
      const flagged = (() => { try { return JSON.parse(d.exercises_flagged || '[]'); } catch { return []; } })();
      return `${fmtD(d.date)} ${d.session_type}: ${d.performance_signal}${flagged.length ? ', flagged: ' + flagged.join(', ') : ''}. ${d.recommendation}`;
    });

    // ── Archetype rotation ─────────────────────────────────────────────────────
    // Count sessions (newest-first, excluding CSV imports) since the last time an
    // archetype anchored a session. Power overdue at 3, Restoration at 10 (soft —
    // readiness is Restoration's primary trigger). Advisory, like pattern_gaps.
    const POWER_THRESHOLD = 3, RESTORATION_THRESHOLD = 10;
    const archRows = await env.DB.prepare(
      `SELECT archetype FROM sessions WHERE id NOT LIKE '%-H' ORDER BY date DESC, id DESC LIMIT 30`
    ).all();
    const archList = archRows.results.map(r => r.archetype || 'strength');
    const sinceLast = (name) => {
      const idx = archList.indexOf(name);
      return idx === -1 ? archList.length : idx; // -1 → none in window → treat as fully overdue
    };
    const sessionsSincePower = sinceLast('power');
    const sessionsSinceRestoration = sinceLast('restoration');
    const archetypeRotation = {
      sessions_since_power: sessionsSincePower,
      power_overdue: sessionsSincePower >= POWER_THRESHOLD,
      sessions_since_restoration: sessionsSinceRestoration,
      restoration_overdue: sessionsSinceRestoration >= RESTORATION_THRESHOLD,
      last_5_archetypes: archList.slice(0, 5),
    };

    return { pattern_gaps: patternGaps, recent_debriefs: recentDebriefs, archetype_rotation: archetypeRotation };
  }

  if (toolName === 'get_available_exercises') {
    if (!availableExerciseIds.length) return { exercises: [] };
    const { movement_pattern, movement_patterns } = toolInput;
    const patterns = movement_patterns && movement_patterns.length ? movement_patterns : (movement_pattern ? [movement_pattern] : []);
    const placeholders = availableExerciseIds.map(() => '?').join(',');
    let query = `
      SELECT e.id, e.display_name, e.movement_pattern_id AS pattern_id, mp.name AS pattern_name, e.matrix_level, e.equipment, e.notes
      FROM exercises e LEFT JOIN movement_patterns mp ON e.movement_pattern_id = mp.id
      WHERE e.id IN (${placeholders})`;
    const binds = [...availableExerciseIds];
    if (patterns.length) { query += ` AND e.movement_pattern_id IN (${patterns.map(() => '?').join(',')})`; binds.push(...patterns); }
    query += ' ORDER BY e.matrix_level, e.display_name';
    const { results } = await env.DB.prepare(query).bind(...binds).all();

    // Per-exercise recency (last 42 days) so Gerald can see which specific
    // exercises within a satisfied pattern are being repeated vs neglected —
    // assess_training_state only tracks this at the pattern level.
    const today = sydneyToday();
    const cutoff42 = new Date(new Date(today) - 42 * 86400000).toISOString().slice(0, 10);
    const { results: usage } = await env.DB.prepare(`
      SELECT st.exercise_id, MAX(s.date) AS last_date, COUNT(DISTINCT s.id) AS session_count
      FROM sets st JOIN sessions s ON st.session_id = s.id
      WHERE s.date >= ? AND s.id NOT LIKE '%-H'
      GROUP BY st.exercise_id
    `).bind(cutoff42).all();
    const usageMap = new Map(usage.map(u => [u.exercise_id, u]));

    return { exercises: results.map(e => {
      const u = usageMap.get(e.id);
      return {
        id: e.id, name: e.display_name, pattern: e.pattern_name, pattern_id: e.pattern_id,
        level: e.matrix_level, equipment: e.equipment, notes: e.notes || '',
        last_trained: u ? fmtD(u.last_date) : 'not in last 42 days',
        days_ago: u ? Math.round((new Date(today) - new Date(u.last_date)) / 86400000) : null,
        sessions_last_42d: u ? u.session_count : 0,
      };
    }) };
  }

  if (toolName === 'get_exercise_history') {
    const { exercise_id, limit = 8 } = toolInput;
    const { results } = await env.DB.prepare(`
      SELECT s.date, st.set_num, st.reps, st.weight_kg, st.rir, st.tempo, st.notes
      FROM sets st JOIN sessions s ON st.session_id = s.id
      WHERE st.exercise_id = ? AND s.id NOT LIKE '%-H'
      ORDER BY s.date DESC, st.set_num ASC LIMIT ?
    `).bind(exercise_id, limit).all();
    return {
      exercise_id,
      history: results.map(s => ({ date: fmtD(s.date), set: s.set_num, reps: s.reps, kg: s.weight_kg, rir: s.rir, tempo: s.tempo, notes: s.notes }))
    };
  }

  if (toolName === 'check_progressions') {
    return { progressions: await computeProgressions(env) };
  }


  if (toolName === 'get_weekly_load') {
    const today = sydneyToday();
    const todayDate = new Date(today);
    const dayOfWeek = (todayDate.getDay() + 6) % 7;
    const thisWeekStart = new Date(todayDate);
    thisWeekStart.setDate(todayDate.getDate() - dayOfWeek);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const thisWeekStr = thisWeekStart.toISOString().slice(0, 10);
    const lastWeekStr = lastWeekStart.toISOString().slice(0, 10);

    const { results } = await env.DB.prepare(`
      SELECT s.date, st.exercise_id, mp.name AS pattern_name, st.rir
      FROM sets st
      JOIN sessions s ON st.session_id = s.id
      JOIN exercises e ON st.exercise_id = e.id
      LEFT JOIN movement_patterns mp ON e.movement_pattern_id = mp.id
      WHERE s.date >= ? AND s.id NOT LIKE '%-H'
      ORDER BY s.date
    `).bind(lastWeekStr).all();

    const thisWeek = { sessions: new Set(), patterns: {} };
    const lastWeek = { sessions: new Set(), patterns: {} };

    results.forEach(r => {
      const isHard = r.rir != null && r.rir <= 2;
      const p = r.pattern_name || 'other';
      if (r.date >= thisWeekStr) {
        thisWeek.sessions.add(r.date);
        if (isHard) thisWeek.patterns[p] = (thisWeek.patterns[p] || 0) + 1;
      } else {
        lastWeek.sessions.add(r.date);
        if (isHard) lastWeek.patterns[p] = (lastWeek.patterns[p] || 0) + 1;
      }
    });

    return {
      week_start: thisWeekStr,
      sessions_this_week: thisWeek.sessions.size,
      hard_sets_this_week: thisWeek.patterns,
      hard_sets_last_week: lastWeek.patterns,
      note: 'Hard sets = RIR <= 2. Use this to avoid stacking patterns already well-dosed this week.'
    };
  }

  if (toolName === 'get_multi_exercise_history') {
    const { exercise_ids = [], limit_per_exercise = 6 } = toolInput;
    if (!exercise_ids.length) return { history: {} };
    const placeholders = exercise_ids.map(() => '?').join(',');
    const { results } = await env.DB.prepare(`
      SELECT * FROM (
        SELECT st.exercise_id, e.display_name, s.date, st.set_num, st.reps, st.weight_kg, st.rir, st.tempo, st.notes,
               ROW_NUMBER() OVER (PARTITION BY st.exercise_id ORDER BY s.date DESC, st.set_num DESC) AS rn
        FROM sets st
        JOIN sessions s ON st.session_id = s.id
        JOIN exercises e ON st.exercise_id = e.id
        WHERE st.exercise_id IN (${placeholders}) AND s.id NOT LIKE '%-H'
      ) WHERE rn <= ?
    `).bind(...exercise_ids, limit_per_exercise).all();

    const history = {};
    results.forEach(r => {
      if (!history[r.exercise_id]) history[r.exercise_id] = { name: r.display_name, sets: [] };
      history[r.exercise_id].sets.push({
        date: fmtD(r.date), set: r.set_num, reps: r.reps,
        kg: r.weight_kg, rir: r.rir, tempo: r.tempo, notes: r.notes
      });
    });
    return { history };
  }

  if (toolName === 'get_body_metrics') {
    const { limit = 8 } = toolInput;
    const { results } = await env.DB.prepare(
      'SELECT date, weight_kg, bodyfat_pct, notes FROM body_metrics ORDER BY date DESC LIMIT ?'
    ).bind(limit).all();
    if (!results.length) return { metrics: [], note: 'No body metrics logged yet.' };
    const weights = results.map(r => r.weight_kg).filter(Boolean);
    const trend = weights.length >= 2
      ? +(weights[0] - weights[weights.length - 1]).toFixed(1)
      : null;
    return {
      metrics: results.map(r => ({ date: fmtD(r.date), kg: r.weight_kg, bf_pct: r.bodyfat_pct, notes: r.notes })),
      trend_kg: trend,
      trend_note: trend != null ? (trend > 0 ? `+${trend}kg over ${results.length} entries` : `${trend}kg over ${results.length} entries`) : null
    };
  }

  if (toolName === 'get_equipment') {
    const location = context.location || 'Home';
    const row = await env.DB.prepare(
      'SELECT config FROM location_config WHERE location = ?'
    ).bind(location).first();
    let cfg = {};
    if (row && row.config) { try { cfg = JSON.parse(row.config); } catch { cfg = {}; } }

    // Standard bells step by 4kg. Find internal gaps (owned bells that skip a
    // rung, so the jump to the next owned bell is oversized) and the next rung
    // above the top — the raw material for next-weight and purchase advice.
    const owned = [...new Set(cfg.kb_weights || [])].sort((a, b) => a - b);
    const kbPairs = !!cfg.kb_pairs;
    const gaps = [];
    for (let i = 0; i < owned.length - 1; i++) {
      const lo = owned[i], hi = owned[i + 1];
      const missing = KB_RUNGS.filter(r => r > lo && r < hi);
      if (missing.length) gaps.push({ from: lo, to: hi, jump_kg: hi - lo, jump_pct: Math.round((hi - lo) / lo * 100), skipped: missing });
    }
    const nextUp = owned.length ? (KB_RUNGS.find(r => r > owned[owned.length - 1]) || null) : KB_RUNGS[0];

    const combos = kbComboLadder(owned, kbPairs);
    const balanced = combos.filter(c => c.balanced);
    const balancedTop = balanced.length ? balanced[balanced.length - 1] : null;

    return {
      location,
      kb_weights_kg: owned,
      kb_pairs: kbPairs,
      other_equipment: {
        rings: !!cfg.rings, pull_up_bar: !!cfg.pull_up_bar,
        parallettes_high: !!cfg.parallettes_high, parallettes_low: !!cfg.parallettes_low,
        bands: !!cfg.bands, barbell: !!cfg.barbell, dumbbells: !!cfg.dumbbells, cable_machine: !!cfg.cable_machine,
      },
      kb_ladder: {
        standard_rungs_kg: KB_RUNGS,
        internal_gaps: gaps,
        next_rung_above_top_kg: nextUp,
      },
      double_kb_ladder: {
        mode: kbPairs
          ? 'Matching pairs available — the balanced ladder is 2x each owned bell.'
          : 'Singles only — every double-KB set is asymmetric. Imbalance is part of the prescription, not a rounding error.',
        balanced_means: `imbalance ≤ ${KB_BALANCED_MAX_IMBALANCE}kg between the two bells`,
        all_combos: combos.map(c => `${c.bells}=${c.total_kg}kg (±${c.imbalance_kg}kg${c.balanced ? ', balanced' : ''})`),
        balanced_ladder_kg: balanced.map(c => c.total_kg),
        balanced_ceiling_kg: balancedTop ? balancedTop.total_kg : null,
        purchase_options: kbPurchaseOptions(owned, kbPairs).slice(0, 3),
      },
      guidance: [
        'Prescribed loads must use only kb_weights_kg above.',
        'For DOUBLE-KB lifts, step load along balanced_ladder_kg. Do NOT treat two combos with the same total as equivalent, and do NOT step to a combo whose imbalance is much larger than the current one just because the total is higher — on a racked lift (front squat, clean, press) that is a harder movement, not a heavier one, and reps will collapse.',
        'If a double-KB lift has met its target at balanced_ceiling_kg, the balanced ladder is out of road. Progress it with reps, tempo, pause or a unilateral variation instead — and that is when a purchase suggestion from purchase_options is genuinely warranted.',
        'Label any bell to buy as a purchase suggestion, never as owned kit.',
      ].join(' '),
    };
  }

  return { error: `Unknown tool: ${toolName}` };
}

// Extract the first balanced JSON object from a model response.
function extractPlanJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('no JSON object');
  return JSON.parse(text.slice(start, end + 1));
}

// VALIDATE (code-fix): strip exercises that aren't in the allowed list or are
// duplicated. Returns the cleaned exercise array plus a list of what was removed
// and why — so the agent can repair if too much was stripped.
function codefixPlan(plan, allowedIds) {
  const allowed = new Set(allowedIds);
  const seen = new Set();
  const cleaned = [];
  const removed = [];
  for (const e of (plan.exercises || [])) {
    const id = e.exercise_id;
    if (!allowed.has(id)) { removed.push(`${id || '(blank)'}: not in available list`); continue; }
    if (seen.has(id)) { removed.push(`${id}: duplicate`); continue; }
    seen.add(id);
    cleaned.push(e);
  }
  return { cleaned, removed };
}

async function callAnthropic(env, payload) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(payload),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

// Ask Gerald's tool loop. Same D1 tools the plan agent uses, but it answers in
// prose instead of returning a plan, and runs on a much tighter iteration budget
// — this is an interactive chat, so the 30-55s the plan agent takes would be
// unacceptable here. MAX_ITER 3 allows: one round of tool calls, optionally a
// second follow-up round, then the answer.
//
// Before this existed, Ask Gerald reasoned over a fixed 4-session snapshot with
// no progression rules, no per-exercise load history and no injuries — so a
// question like "why is my front squat stuck?" was literally unanswerable when
// the stall spanned four months.
const ASK_MAX_ITER = 3;

async function runAskAgent(body, env) {
  const { system, messages, context = {} } = body;
  const startedAt = Date.now();
  const convo = Array.isArray(messages) ? [...messages] : [];

  for (let i = 0; i < ASK_MAX_ITER; i++) {
    const isLast = i === ASK_MAX_ITER - 1;
    const res = await callAnthropic(env, {
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system,
      tools: GERALD_TOOLS,
      // On the final iteration forbid further tool calls so the loop always ends
      // with prose rather than an unanswered tool_use the user never sees.
      ...(isLast ? { tool_choice: { type: 'none' } } : {}),
      messages: convo,
    });
    if (!res.ok) {
      console.error(`Ask iter ${i} failed after ${Date.now() - startedAt}ms:`, res.status, JSON.stringify(res.data));
      return { error: res.data };
    }
    const data = res.data;
    console.log(`Ask iter ${i} stop_reason=${data.stop_reason} elapsed=${Date.now() - startedAt}ms`);
    convo.push({ role: 'assistant', content: data.content });

    if (data.stop_reason === 'tool_use') {
      const calls = data.content.filter(b => b.type === 'tool_use');
      const results = await Promise.all(calls.map(b => executeTool(b.name, b.input, context, env)));
      convo.push({
        role: 'user',
        content: calls.map((b, n) => ({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(results[n]) })),
      });
      continue;
    }

    return { text: data.content.map(b => b.text || '').join('').trim() };
  }
  return { text: '', error: 'Ask agent exhausted its iteration budget' };
}

async function runGeraldAgent(body, env) {
  const { context } = body;
  const { location, readiness, injuries = [], kit, memo, pendingProgressions = [], preNotes, userContext = '' } = context;
  const MAX_ITER = 8;

  const injStr = injuries.length ? injuries.map(i => `${i.body_part}: ${i.restrictions}`).join(', ') : 'None';
  const bwRow = await env.DB.prepare('SELECT date, weight_kg, bodyfat_pct FROM body_metrics ORDER BY date DESC LIMIT 1').first();
  const bwLine = bwRow ? `Bodyweight: ${bwRow.weight_kg} kg${bwRow.bodyfat_pct != null ? ` (${bwRow.bodyfat_pct}% bf)` : ''} as of ${bwRow.date} — use it for effective load on calisthenics.` : '';
  const readinessNote = (readiness.sleep <= 2 || readiness.energy <= 2)
    ? '⚠ LOW — reduce volume, higher RIR, quality over output'
    : (readiness.sleep >= 4 && readiness.energy >= 4)
    ? '✓ HIGH — push load and volume'
    : 'MODERATE — standard dose';

  const system = `${GERALD_PERSONA}

${MODALITY_DOCTRINE}

${BW_PROGRESSION_RULE}

${LOAD_PROTOCOL}
${userContext ? `\nATHLETE CONTEXT (always factor this in):\n${userContext}\n` : ''}${memo ? `\nYOUR RUNNING NOTES (read first — these override defaults):\n${memo}\n` : ''}
TODAY:
Location: ${location} | Kit: ${kit}
Readiness: Sleep ${readiness.sleep}/5 · Energy ${readiness.energy}/5 · Soreness ${readiness.soreness}/5 — ${readinessNote}
${bwLine ? bwLine + '\n' : ''}Injuries: ${injStr}
${preNotes ? `Athlete note: ${preNotes}` : ''}
${pendingProgressions.length ? `Approved progressions: ${pendingProgressions.map(p => `${p.fromName} → ${p.toName || 'peak'}`).join(', ')}` : ''}

SESSION ARCHETYPE (decide this FIRST — it sets which pattern group anchors the session and the whole session's intensity character):
- strength — DEFAULT. Anchor the main patterns (push/pull/squat/hinge/carry/core). RIR 1-2, compounds first, proximity-to-failure hypertrophy. Use this unless a signal below says otherwise.
- power — Anchor mp_power_conditioning (KB swings/cleans/snatches) as the first 2-3 slots. Higher reps, RIR 2-3, shorter rest, output quality over grinding to failure. This is the KB-lower-body / conditioning slot the doctrine calls non-negotiable.
- restoration — Anchor mp_rehab (band pull-aparts, face pulls, scapular work, dead hangs). High RIR (2-3+), longer holds, low load. Shoulder-health insurance + active recovery.

HOW TO CHOOSE (assess_training_state returns archetype_rotation — read it):
- Readiness is the override. LOW readiness (⚠ above) → choose restoration regardless of rotation, UNLESS last session was already restoration (last_5_archetypes[0] === "restoration") — then run a lightened strength session instead.
- Otherwise, if power_overdue is true → choose power. High readiness makes power especially appropriate; on moderate readiness it's still fine.
- Otherwise, if restoration_overdue is true → choose restoration (the soft safety-net so mobility work never disappears).
- Otherwise → strength.
- The anchor archetype dominates the session but does NOT get exclusive access — you can still slot one opportunistic exercise from another pattern group (e.g. a rehab finisher inside a strength day) as you do normally.

PROCESS (minimize round-trips — every extra turn adds real latency):
1. assess_training_state — see what patterns are overdue AND read archetype_rotation to pick today's archetype (per the rules above)
2. get_available_exercises — pass ALL the patterns you want to target at once via movement_patterns (array), not one call per pattern. Include the anchor archetype's pattern(s) (mp_power_conditioning for power, mp_rehab for restoration).
3. get_multi_exercise_history — pass ALL the exercise_ids you need load data for in ONE call, not repeated get_exercise_history calls
4. check_progressions — ALWAYS call this (batch it with step 2 or 3, it takes no arguments). It is how you find out which lifts have met their target, which have stalled at an unchanged load (load_stalled / load_note), and what intensity_levers each one has. You cannot size loads honestly without it.
5. get_equipment when any double-KB lift is in the plan, or a KB lift is at/near its threshold — it returns owned bells, the single-bell ladder (internal gaps + next rung) and the double-KB balanced ladder, so you can pick a real next combo instead of an oversized or lopsided one
6. Return the session plan as JSON and nothing else

You can call multiple tools in the same turn (e.g. assess_training_state + get_weekly_load together, or get_available_exercises + check_progressions together) — do this whenever the calls don't depend on each other's results, instead of spacing them across separate turns.

OUTPUT (when done, return only this — no preamble, no commentary):
{
  "archetype": "strength | power | restoration — the theme you chose above",
  "session_notes": "one sharp sentence on what you're targeting and why (mention the archetype if it's not strength)",
  "equipment_note": "OPTIONAL — one sentence, only when a KB lift is ready to progress but the next owned bell is a big jump (≥8kg or ≥25% per get_equipment). Name the next-weight move (jump to the next owned bell, or a rep/tempo bridge on the current one) and, if it genuinely helps, which bell to buy to bridge the gap — flagged as a purchase, never as owned kit. Omit or leave \"\" otherwise.",
  "exercises": [
    { "exercise_id": "slug", "display_name": "Name", "sets": 4, "reps": "8-10", "weight": "32kg", "tempo": "3-0-1-0", "rir": 1, "notes": "cue" }
  ]
}

HARD CONSTRAINTS:
- Only use exercise_ids from get_available_exercises — never invent one
- VARIETY: get_available_exercises annotates each exercise with last_trained/sessions_last_42d.
  When multiple exercises satisfy the same pattern gap at a similar level, prefer the one with
  fewer sessions_last_42d / longer days_ago over the one you'd default to out of habit. Don't
  rotate away from an exercise mid-progression (an exercise close to advancing per
  check_progressions should stay) — this is a tie-breaker for equally-valid options, not a reason
  to abandon real progress.
- 4-6 exercises, ordered as executed (compounds and high-skill first)
- Respect all injury restrictions
- RIR protocol: 0=hold | 1=small step | 2=push | 3+=undertested so push significantly
- LOAD MUST MOVE: never re-prescribe a load an exercise already cleared its rep target at. If check_progressions flags load_stalled, that exercise's prescription must change this session — heavier, more reps, slower tempo, added pause, or a harder variation. Say which lever you used in its notes field.
- Apply any approved progressions (use new exercise, not old)
- equipment_note is ADVISORY only — every exercise's weight field must use a bell that's actually owned (kit / get_equipment). A bell you suggest buying never appears as a prescribed weight.
- SESSION LENGTH: 45 min hard cap (~3 min/set including rest = 15 sets max).
  Scale sets to exercise count: 4 exercises → 3–4 sets each, 5–6 exercises → 2–3 sets each.
  Never prescribe 4 sets across 5+ exercises.`;

  const messages = [{
    role: 'user',
    content: `Design today's session. Location: ${location}.${preNotes ? ' Athlete note: ' + preNotes : ''}`
  }];

  const startedAt = Date.now();
  for (let i = 0; i < MAX_ITER; i++) {
    const res = await callAnthropic(env, { model: 'claude-opus-4-8', max_tokens: 8000, thinking: { type: 'adaptive' }, output_config: { effort: 'low' }, system, tools: GERALD_TOOLS, messages });
    if (!res.ok) {
      console.error(`Gerald iter ${i} Anthropic call failed after ${Date.now() - startedAt}ms:`, res.status, JSON.stringify(res.data));
      return { ok: false, error: res.data };
    }
    const data = res.data;
    console.log(`Gerald iter ${i} stop_reason=${data.stop_reason} elapsed=${Date.now() - startedAt}ms`);

    messages.push({ role: 'assistant', content: data.content });

    // ── PLAN complete → VALIDATE ──────────────────────────────────────────────
    if (data.stop_reason === 'end_turn') {
      const text = data.content.map(b => b.text || '').join('');
      let plan;
      try { plan = extractPlanJson(text); }
      catch (e) {
        console.error(`Gerald iter ${i} invalid JSON after ${Date.now() - startedAt}ms:`, text.slice(0, 500));
        return { ok: false, error: 'Invalid JSON', raw: text };
      }

      // Code-fix: strip hallucinated/duplicate exercise_ids (injury- and
      // equipment-unsafe ids are already excluded from availableExerciseIds).
      let { cleaned, removed } = codefixPlan(plan, context.availableExerciseIds);

      // If too little survived, make ONE repair call. The conversation history
      // contains tool_use/tool_result blocks, so the API requires `tools` to be
      // defined — tool_choice: none is what forbids further tool calls.
      if (cleaned.length < 3) {
        messages.push({
          role: 'user',
          content: `That plan only kept ${cleaned.length} valid exercise(s). Removed — ${removed.join('; ') || 'none'}. Rebuild it with 4-6 exercises using ONLY the exercise_ids that get_available_exercises returned earlier. Return just the corrected JSON, no commentary.`,
        });
        const repair = await callAnthropic(env, { model: 'claude-opus-4-8', max_tokens: 8000, thinking: { type: 'adaptive' }, output_config: { effort: 'low' }, system, tools: GERALD_TOOLS, tool_choice: { type: 'none' }, messages });
        if (!repair.ok) console.error('Gerald repair call failed:', repair.status, JSON.stringify(repair.data));
        if (repair.ok && repair.data.content) {
          const rtext = repair.data.content.map(b => b.text || '').join('');
          try {
            const rplan = extractPlanJson(rtext);
            const fixed = codefixPlan(rplan, context.availableExerciseIds);
            if (fixed.cleaned.length > cleaned.length) { plan = rplan; cleaned = fixed.cleaned; removed = fixed.removed; }
          } catch (e) { /* keep best-effort original */ }
        }
      }

      plan.exercises = cleaned;
      return { ok: true, plan, validation: { removed, count: cleaned.length } };
    }

    if (data.stop_reason === 'tool_use') {
      const calls = data.content.filter(b => b.type === 'tool_use');
      const results = await Promise.all(calls.map(block => executeTool(block.name, block.input, context, env)));
      const toolResults = calls.map((block, i) => ({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(results[i]) }));
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    if (data.stop_reason === 'max_tokens') {
      console.error(`Gerald hit max_tokens at iter ${i}, elapsed=${Date.now() - startedAt}ms`);
      return { ok: false, error: 'Gerald hit the output token limit mid-plan — try again' };
    }

    console.error(`Gerald unexpected stop_reason=${data.stop_reason} at iter ${i}, elapsed=${Date.now() - startedAt}ms`);
    break; // unexpected stop_reason
  }

  console.error(`Gerald exhausted MAX_ITER=${MAX_ITER}, elapsed=${Date.now() - startedAt}ms`);
  return { ok: false, error: 'Agent did not complete within iteration limit' };
}

async function runGeraldAgentJob(jobId, body, env) {
  try {
    const result = await runGeraldAgent(body, env);
    if (result.ok) {
      await env.DB.prepare('UPDATE agent_jobs SET status = ?, result = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind('complete', JSON.stringify({ plan: result.plan, validation: result.validation }), jobId).run();
    } else {
      const errText = typeof result.error === 'string' ? result.error : JSON.stringify(result.error);
      await env.DB.prepare('UPDATE agent_jobs SET status = ?, error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .bind('error', errText, jobId).run();
    }
  } catch (e) {
    console.error(`Gerald job ${jobId} threw:`, e.message);
    await env.DB.prepare('UPDATE agent_jobs SET status = ?, error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind('error', e.message, jobId).run();
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

