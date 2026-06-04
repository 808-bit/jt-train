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

  if (action === 'getMovementPatterns') {
    const { results } = await env.DB.prepare(
      'SELECT mp.*, COUNT(e.id) as exercise_count FROM movement_patterns mp LEFT JOIN exercises e ON e.movement_pattern_id = mp.id GROUP BY mp.id ORDER BY mp.display_order'
    ).all();
    return json({ data: results });
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
    const sessions = await env.DB.prepare(`
      SELECT * FROM sessions WHERE session_type = ? ORDER BY date DESC LIMIT ?
    `).bind(sessionType, limit).all();
    if (!sessions.results.length) return json({ sessions: [], sets: [] });
    const ids = sessions.results.map(s => `'${s.id}'`).join(',');
    const sets = await env.DB.prepare(`
      SELECT st.*, e.display_name FROM sets st
      JOIN exercises e ON st.exercise_id = e.id
      WHERE st.session_id IN (${ids})
      ORDER BY st.session_id, st.exercise_id, st.set_num
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
      WHERE st.exercise_id = ? ORDER BY s.date DESC, st.set_num ASC LIMIT ?
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
      ORDER BY s.date ASC, st.exercise_id, st.set_num
      LIMIT ?
    `).bind(limit).all();
    return json({ data: results });
  }

  if (action === 'getSessions') {
    const sessionType = searchParams.get('session_type') || '';
    const limit  = parseInt(searchParams.get('limit')  || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const sessQuery = sessionType
      ? 'SELECT * FROM sessions WHERE session_type = ? ORDER BY date DESC LIMIT ? OFFSET ?'
      : 'SELECT * FROM sessions ORDER BY date DESC LIMIT ? OFFSET ?';
    const sessResult = sessionType
      ? await env.DB.prepare(sessQuery).bind(sessionType, limit, offset).all()
      : await env.DB.prepare(sessQuery).bind(limit, offset).all();
    const sessions = sessResult.results;
    if (!sessions.length) return json({ sessions: [], sets: [] });
    const ids = sessions.map(s => "'" + s.id + "'").join(',');
    const setsResult = await env.DB.prepare(
      'SELECT st.*, e.display_name, ROUND(st.weight_kg * (1 + st.reps / 30.0), 2) AS estimated_1rm ' +
      'FROM sets st JOIN exercises e ON st.exercise_id = e.id ' +
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
      r.pre_sleep || null, r.pre_energy || null, r.pre_soreness || null,
    ).run();
    return json({ ok: true });
  }

  if (action === 'appendSet') {
    const r = body.data || {};
    await env.DB.prepare(`
      INSERT INTO sets (session_id, exercise_id, set_num, reps, weight_kg, rir, tempo, notes, tut_seconds, rest_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

  return json({ error: 'Unknown action: ' + action }, 400);

}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

