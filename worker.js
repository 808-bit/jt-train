/**
 * JT.TRAIN — Cloudflare Worker
 *
 * Handles:
 *   GET  ?action=getActiveInjuries
 *   GET  ?action=getExercises
 *   GET  ?action=getSessionHistory&session_type=X&limit=3
 *   POST { action: 'appendSession', data: {...} }
 *   POST { action: 'appendSet', data: {...} }
 *   POST { action: 'claude', system: '...', messages: [...] }
 *
 * Environment variables (set via Wrangler secrets or dashboard):
 *   ANTHROPIC_API_KEY   — Anthropic API key
 *   SHEETS_ID           — Google Sheets document ID
 *   GOOGLE_SA_EMAIL     — Google service account email
 *   GOOGLE_SA_KEY       — Google service account private key (PEM, newlines as \n)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Tab names ────────────────────────────────────────────────────────────────
const TABS = {
  sessions:  'JT_Sessions',
  sets:      'JT_Sets',
  exercises: 'JT_Exercises',
  injuries:  'JT_Injuries',
};

// ── Entry point ───────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    try {
      if (request.method === 'GET') return await handleGet(request, env);
      if (request.method === 'POST') return await handlePost(request, env);
      return json({ error: 'Method not allowed' }, 405);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }
};

// ── GET router ────────────────────────────────────────────────────────────────
async function handleGet(request, env) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'getExercises') {
    const rows = await sheetsGet(env, TABS.exercises);
    return json({ data: rows });
  }

  if (action === 'getActiveInjuries') {
    const rows = await sheetsGet(env, TABS.injuries);
    const active = rows.filter(r => r.active === 'TRUE' || r.active === true);
    return json({ data: active });
  }

  if (action === 'getSessionHistory') {
    const sessionType = searchParams.get('session_type') || '';
    const limit = parseInt(searchParams.get('limit') || '3');

    const sessions = await sheetsGet(env, TABS.sessions);
    const sets = await sheetsGet(env, TABS.sets);

    const matchSessions = sessions
      .filter(s => !sessionType || s.session_type === sessionType)
      .slice(-limit);

    const sessionIds = new Set(matchSessions.map(s => s.session_id));
    const matchSets = sets.filter(s => sessionIds.has(s.session_id));

    return json({ sessions: matchSessions, sets: matchSets });
  }

  return json({ error: 'Unknown action: ' + action }, 400);
}

// ── POST router ───────────────────────────────────────────────────────────────
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
    const row = body.data || {};
    await sheetsAppend(env, TABS.sessions, [
      row.session_id || '',
      row.date || '',
      row.week_type || '',
      row.phase || '',
      row.session_type || '',
      row.location || '',
      row.rpe_session || '',
      row.notes || '',
      row.ai_plan_used ? 'TRUE' : 'FALSE',
    ]);
    return json({ ok: true });
  }

  if (action === 'appendSet') {
    const row = body.data || {};
    await sheetsAppend(env, TABS.sets, [
      row.session_id || '',
      row.exercise_id || '',
      row.set_num || '',
      row.reps || '',
      row.weight_kg || '',
      row.rir || '',
      row.tempo || '',
      row.notes || '',
    ]);
    return json({ ok: true });
  }

  return json({ error: 'Unknown action: ' + action }, 400);
}

// ── Google Sheets helpers ─────────────────────────────────────────────────────

/** Read all rows from a tab, return array of objects keyed by header row */
async function sheetsGet(env, tab) {
  const token = await getGoogleToken(env);
  const range = encodeURIComponent(`${tab}!A1:Z1000`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${range}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!data.values || data.values.length < 2) return [];
  const [headers, ...rows] = data.values;
  return rows.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ''])));
}

/** Append a row to a tab */
async function sheetsAppend(env, tab, values) {
  const token = await getGoogleToken(env);
  const range = encodeURIComponent(`${tab}!A1`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.SHEETS_ID}/values/${range}:append?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Sheets append failed: ' + err);
  }
}

// ── Google service account JWT auth ──────────────────────────────────────────

async function getGoogleToken(env) {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: env.GOOGLE_SA_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify(claim));
  const unsigned = `${header}.${payload}`;

  // Import the service account private key
  const pemKey = env.GOOGLE_SA_KEY.replace(/\\n/g, '\n');
  const keyData = pemToDer(pemKey);
  const key = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', key,
    new TextEncoder().encode(unsigned)
  );

  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Google auth failed: ' + JSON.stringify(data));
  return data.access_token;
}

function b64url(data) {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let str = '';
  bytes.forEach(b => str += String.fromCharCode(b));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function pemToDer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// ── Response helper ───────────────────────────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
