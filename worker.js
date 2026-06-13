/**
 * JT.TRAIN — Cloudflare Worker (D1 edition)
 *
 * GET  ?action=getActiveInjuries
 * GET  ?action=getExercises
 * GET  ?action=getSessionHistory&session_type=X&limit=3
 * GET  ?action=getProgressionData&exercise_id=X&limit=20
 * GET  ?action=getEquipmentConfig
 * GET  ?action=getAllProgressionData&limit=2000
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

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    try {
      if (request.method === 'GET')  return await handleGet(request, env);
      if (request.method === 'POST') return await handlePost(request, env);
      return json({ error: 'Method not allowed' }, 405);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }
};

async function handleGet(request, env) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

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
  return json({ error: 'Unknown action: ' + action }, 400);
}

async function handlePost(request, env) {
  const body = await request.json();
  const { action } = body;

  // Anthropic-backed actions burn API credits — require the app token.
  // Other POST actions (set logging etc.) stay open so a lost token can't
  // block a workout mid-session.
  if (action === 'agent' || action === 'claude') {
    if (!env.APP_TOKEN || request.headers.get('X-App-Token') !== env.APP_TOKEN) {
      return json({ error: 'Unauthorized' }, 401);
    }
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
    return await runGeraldAgent(body, env);
  }

  if (action === 'appendSession') {
    const r = body.data || {};
    await env.DB.prepare(`
      INSERT INTO sessions (id, phase_id, date, session_type, location, rpe, notes, ai_plan_used, pre_sleep, pre_energy, pre_soreness, duration_min)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET rpe = excluded.rpe, notes = excluded.notes,
        duration_min = COALESCE(excluded.duration_min, sessions.duration_min)
    `).bind(
      r.session_id || '', r.phase_id || 'lean-bulk-q2-2026',
      r.date || new Date().toISOString().slice(0, 10),
      r.session_type || '', r.location || 'Home',
      r.rpe_session || null, r.notes || null, r.ai_plan_used ? 1 : 0,
      r.pre_sleep || null, r.pre_energy || null, r.pre_soreness || null,
      (r.duration_min != null && !isNaN(parseFloat(r.duration_min))) ? parseFloat(r.duration_min) : null,
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
      SELECT s.date, st.session_id, st.exercise_id, st.reps, st.weight_kg, st.rir,
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
  const actualSets = {};
  sets.forEach(s => {
    const k = s.session_id + '|' + s.exercise_id;
    actualSets[k] = (actualSets[k] || 0) + 1;
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
    description: 'List exercises available today, optionally filtered by movement pattern. Use to find options for the patterns you want to target.',
    input_schema: {
      type: 'object',
      properties: {
        movement_pattern: { type: 'string', description: 'Filter by pattern, e.g. "pull", "push", "hinge", "squat", "carry". Omit for all.' }
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

async function executeTool(toolName, toolInput, context, env) {
  const { availableExerciseIds = [], injuries = [] } = context;

  if (toolName === 'assess_training_state') {
    const daysBack = toolInput.days_back || 21;
    const today = sydneyToday();
    const cutoff = new Date(new Date(today) - daysBack * 86400000).toISOString().slice(0, 10);
    const [setsRes, debriefRes] = await Promise.all([
      env.DB.prepare(`
        SELECT s.date, e.movement_pattern, st.exercise_id, e.display_name
        FROM sets st
        JOIN sessions s ON st.session_id = s.id
        JOIN exercises e ON st.exercise_id = e.id
        WHERE s.date >= ? AND s.id NOT LIKE '%-H'
        ORDER BY s.date DESC
      `).bind(cutoff).all(),
      env.DB.prepare(`SELECT * FROM debriefs WHERE date >= ? ORDER BY date DESC LIMIT 8`).bind(cutoff).all(),
    ]);

    const patternDates = {};
    setsRes.results.forEach(s => {
      const p = s.movement_pattern || 'unknown';
      if (!patternDates[p] || s.date > patternDates[p]) patternDates[p] = s.date;
    });
    const patternGaps = Object.entries(patternDates)
      .map(([pattern, lastDate]) => ({
        pattern,
        last_trained: fmtD(lastDate),
        days_ago: Math.round((new Date(today) - new Date(lastDate)) / 86400000),
      }))
      .sort((a, b) => b.days_ago - a.days_ago);

    const recentDebriefs = debriefRes.results.map(d => {
      const flagged = (() => { try { return JSON.parse(d.exercises_flagged || '[]'); } catch { return []; } })();
      return `${fmtD(d.date)} ${d.session_type}: ${d.performance_signal}${flagged.length ? ', flagged: ' + flagged.join(', ') : ''}. ${d.recommendation}`;
    });

    return { pattern_gaps: patternGaps, recent_debriefs: recentDebriefs };
  }

  if (toolName === 'get_available_exercises') {
    if (!availableExerciseIds.length) return { exercises: [] };
    const { movement_pattern } = toolInput;
    const placeholders = availableExerciseIds.map(() => '?').join(',');
    let query = `SELECT id, display_name, movement_pattern, matrix_level, equipment, notes FROM exercises WHERE id IN (${placeholders})`;
    const binds = [...availableExerciseIds];
    if (movement_pattern) { query += ' AND movement_pattern = ?'; binds.push(movement_pattern); }
    query += ' ORDER BY matrix_level, display_name';
    const { results } = await env.DB.prepare(query).bind(...binds).all();
    return { exercises: results.map(e => ({ id: e.id, name: e.display_name, pattern: e.movement_pattern, level: e.matrix_level, equipment: e.equipment, notes: e.notes || '' })) };
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
    // One windowed query: 5 most recent sets per ruled exercise (rules with
    // no recorded sets drop out via the inner join, matching old behaviour).
    const { results: rows } = await env.DB.prepare(`
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
    `).all();

    const byExercise = new Map();
    for (const r of rows) {
      if (!byExercise.has(r.exercise_id)) byExercise.set(r.exercise_id, []);
      byExercise.get(r.exercise_id).push(r);
    }
    const status = [];
    for (const recent of byExercise.values()) {
      const rule = recent[0];
      const qualifying = recent.filter(s => s.reps >= rule.rep_target && (s.rir ?? 99) <= rule.rir_target).length;
      status.push({
        exercise: rule.display_name,
        id: rule.exercise_id,
        target: `${rule.rep_target} reps @ RIR ≤${rule.rir_target} × ${rule.sessions_to_confirm}`,
        qualifying_sessions: qualifying,
        ready: qualifying >= rule.sessions_to_confirm,
        next: rule.next_exercise_id || 'peak',
        recent: recent.slice(0, 3).map(s => `${s.reps}r ${s.weight_kg}kg RIR${s.rir ?? '?'}`).join(' | '),
      });
    }
    return { progressions: status };
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
${userContext ? `\nATHLETE CONTEXT (always factor this in):\n${userContext}\n` : ''}${memo ? `\nYOUR RUNNING NOTES (read first — these override defaults):\n${memo}\n` : ''}
TODAY:
Location: ${location} | Kit: ${kit}
Readiness: Sleep ${readiness.sleep}/5 · Energy ${readiness.energy}/5 · Soreness ${readiness.soreness}/5 — ${readinessNote}
${bwLine ? bwLine + '\n' : ''}Injuries: ${injStr}
${preNotes ? `Athlete note: ${preNotes}` : ''}
${pendingProgressions.length ? `Approved progressions: ${pendingProgressions.map(p => `${p.fromName} → ${p.toName || 'peak'}`).join(', ')}` : ''}

PROCESS:
1. assess_training_state — see what patterns are overdue
2. get_available_exercises — find options per pattern (call once per pattern if helpful)
3. get_exercise_history — nail load prescription for 2-3 key exercises
4. Optionally check_progressions if anything looks close to advancing
5. Return the session plan as JSON and nothing else

OUTPUT (when done, return only this — no preamble, no commentary):
{
  "session_notes": "one sharp sentence on what you're targeting and why",
  "exercises": [
    { "exercise_id": "slug", "display_name": "Name", "sets": 4, "reps": "8-10", "weight": "32kg", "tempo": "3-0-1-0", "rir": 1, "notes": "cue" }
  ]
}

HARD CONSTRAINTS:
- Only use exercise_ids from get_available_exercises — never invent one
- 4-6 exercises, ordered as executed (compounds and high-skill first)
- Respect all injury restrictions
- RIR protocol: 0=hold | 1=small step | 2=push | 3+=undertested so push significantly
- Apply any approved progressions (use new exercise, not old)`;

  const messages = [{
    role: 'user',
    content: `Design today's session. Location: ${location}.${preNotes ? ' Athlete note: ' + preNotes : ''}`
  }];

  for (let i = 0; i < MAX_ITER; i++) {
    const res = await callAnthropic(env, { model: 'claude-opus-4-8', max_tokens: 8000, thinking: { type: 'adaptive' }, system, tools: GERALD_TOOLS, messages });
    if (!res.ok) return json({ error: res.data }, res.status);
    const data = res.data;

    messages.push({ role: 'assistant', content: data.content });

    // ── PLAN complete → VALIDATE ──────────────────────────────────────────────
    if (data.stop_reason === 'end_turn') {
      const text = data.content.map(b => b.text || '').join('');
      let plan;
      try { plan = extractPlanJson(text); }
      catch (e) { return json({ error: 'Invalid JSON', raw: text }, 500); }

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
        const repair = await callAnthropic(env, { model: 'claude-opus-4-8', max_tokens: 8000, thinking: { type: 'adaptive' }, system, tools: GERALD_TOOLS, tool_choice: { type: 'none' }, messages });
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
      return json({ plan, validation: { removed, count: cleaned.length } });
    }

    if (data.stop_reason === 'tool_use') {
      const toolResults = [];
      for (const block of data.content) {
        if (block.type !== 'tool_use') continue;
        const result = await executeTool(block.name, block.input, context, env);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
      }
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    if (data.stop_reason === 'max_tokens') {
      return json({ error: 'Gerald hit the output token limit mid-plan — try again' }, 500);
    }

    break; // unexpected stop_reason
  }

  return json({ error: 'Agent did not complete within iteration limit' }, 500);
}

// ─────────────────────────────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

