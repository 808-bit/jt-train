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
    const { results } = await env.DB.prepare('SELECT * FROM exercises ORDER BY display_name').all();
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

  return json({ error: 'Unknown action: ' + action }, 400);
}

async function handlePost(request, env) {
  const body = await request.json();
  const { action } = body;

  if (action === 'claude') {
    const { system, messages, model = 'claude-haiku-4-5-20251001', max_tokens = 1500 } = body;
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
      INSERT INTO sessions (id, phase_id, date, session_type, location, rpe, notes, ai_plan_used)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET rpe = excluded.rpe, notes = excluded.notes
    `).bind(
      r.session_id || '', r.phase_id || 'lean-bulk-q2-2026',
      r.date || new Date().toISOString().slice(0, 10),
      r.session_type || '', r.location || 'Home',
      r.rpe_session || null, r.notes || null, r.ai_plan_used ? 1 : 0,
    ).run();
    return json({ ok: true });
  }

  if (action === 'appendSet') {
    const r = body.data || {};
    await env.DB.prepare(`
      INSERT INTO sets (session_id, exercise_id, set_num, reps, weight_kg, rir, tempo, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      r.session_id || '', r.exercise_id || '', r.set_num || 1,
      r.reps || null, r.weight_kg || 0, r.rir || null, r.tempo || null, r.notes || null,
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

  if (action === 'deleteSession') {
    const { session_id } = body;
    if (!session_id) return json({ error: 'session_id required' }, 400);
    await env.DB.prepare('DELETE FROM sets WHERE session_id = ?').bind(session_id).run();
    await env.DB.prepare('DELETE FROM session_plan WHERE session_id = ?').bind(session_id).run();
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(session_id).run();
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
