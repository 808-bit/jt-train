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
  'Access-Control-Allow-Headers': 'Content-Type',
};

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
             st.set_num, st.reps, st.weight_kg,
             ROUND(st.weight_kg * (1 + st.reps / 30.0), 2) AS estimated_1rm
      FROM sets st
      JOIN sessions s ON st.session_id = s.id
      JOIN exercises e ON st.exercise_id = e.id
      WHERE s.id NOT LIKE '%-H'
      ORDER BY s.date ASC, st.exercise_id, st.set_num
      LIMIT ?
    `).bind(limit).all();
    return json({ data: results });
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
      INSERT INTO sessions (id, phase_id, date, session_type, location, rpe, notes, ai_plan_used, pre_sleep, pre_energy, pre_soreness)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET rpe = excluded.rpe, notes = excluded.notes
    `).bind(
      r.session_id || '', r.phase_id || 'lean-bulk-q2-2026',
      r.date || new Date().toISOString().slice(0, 10),
      r.session_type || '', r.location || 'Home',
      r.rpe_session || null, r.notes || null, r.ai_plan_used ? 1 : 0,
      r.pre_sleep || null, r.pre_energy || null, r.pre_soreness || null,
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

  return json({ error: 'Unknown action: ' + action }, 400);

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
    const { results: rules } = await env.DB.prepare(`
      SELECT pr.*, e.display_name FROM progression_rules pr
      JOIN exercises e ON pr.exercise_id = e.id
    `).all();
    const status = [];
    for (const rule of rules.slice(0, 12)) {
      const { results: recent } = await env.DB.prepare(`
        SELECT s.date, st.reps, st.weight_kg, st.rir
        FROM sets st JOIN sessions s ON st.session_id = s.id
        WHERE st.exercise_id = ? AND s.id NOT LIKE '%-H'
        ORDER BY s.date DESC LIMIT 5
      `).bind(rule.exercise_id).all();
      if (!recent.length) continue;
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
  const { location, readiness, injuries = [], kit, memo, pendingProgressions = [], preNotes } = context;
  const MAX_ITER = 8;

  const injStr = injuries.length ? injuries.map(i => `${i.body_part}: ${i.restrictions}`).join(', ') : 'None';
  const readinessNote = (readiness.sleep <= 2 || readiness.energy <= 2)
    ? '⚠ LOW — reduce volume, higher RIR, quality over output'
    : (readiness.sleep >= 4 && readiness.energy >= 4)
    ? '✓ HIGH — push load and volume'
    : 'MODERATE — standard dose';

  const system = `You are Gerald — a training partner who knows James's history better than he does. You've watched every session, every set, every stall and every breakthrough. You talk like someone who trains alongside him: straight, familiar, no performance. You don't motivate, you observe and advise. You know he has maybe 45 minutes before life intervenes — so you don't waste his time.

Rules: lead with the insight, not the preamble. Use numbers. If something looks off, say it plainly. Dry humour is fine. Motivation-poster energy is not.
${memo ? `\nYOUR RUNNING NOTES (read first — these override defaults):\n${memo}\n` : ''}
TODAY:
Location: ${location} | Kit: ${kit}
Readiness: Sleep ${readiness.sleep}/5 · Energy ${readiness.energy}/5 · Soreness ${readiness.soreness}/5 — ${readinessNote}
Injuries: ${injStr}
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
    const res = await callAnthropic(env, { model: 'claude-opus-4-8', max_tokens: 4000, system, tools: GERALD_TOOLS, messages });
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
        const repair = await callAnthropic(env, { model: 'claude-opus-4-8', max_tokens: 4000, system, tools: GERALD_TOOLS, tool_choice: { type: 'none' }, messages });
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

