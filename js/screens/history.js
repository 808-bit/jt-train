let histFilter = '', histOffset = 0, histLoading = false;

function initHistory() {
  histFilter = ''; histOffset = 0;
  document.querySelectorAll('#hist-filters .pill').forEach(p => p.classList.remove('active'));
  const first = document.querySelector('#hist-filters .pill');
  if (first) first.classList.add('active');
  document.getElementById('hist-list').innerHTML = '';
  loadHistory(true);
}

function setHistFilter(el, type) {
  histFilter = type; histOffset = 0;
  document.querySelectorAll('#hist-filters .pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('hist-list').innerHTML = '';
  loadHistory(true);
}

async function loadHistory(reset) {
  if (histLoading) return;
  histLoading = true;
  const list = document.getElementById('hist-list');
  if (reset) list.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px;">' + Array(4).fill('<div class="skel" style="height:64px;border-radius:10px;"></div>').join('') + '</div>';
  try {
    const params = { limit: 20, offset: histOffset };
    if (histFilter) params.session_type = histFilter;
    const result = await api('getSessions', params);
    if (reset) list.innerHTML = '';
    const sessions = result.sessions || [];
    const sets = result.sets || [];
    if (!sessions.length && reset) {
      list.innerHTML = '<div style="text-align:center;padding:48px 20px;"><div style="font-family:var(--font-ui);font-size:11px;font-weight:700;color:var(--text3);letter-spacing:0.18em;margin-bottom:8px;">NO SESSIONS YET</div><div style="font-family:var(--font);font-size:11px;color:var(--text3);">Complete a session to see it here</div></div>';
      document.getElementById('hist-load-more').style.display = 'none';
      histLoading = false; return;
    }
    const setsBySession = {};
    sets.forEach(s => {
      if (!setsBySession[s.session_id]) setsBySession[s.session_id] = [];
      setsBySession[s.session_id].push(s);
    });
    sessions.forEach(sess => renderSessionCard(sess, setsBySession[sess.id] || [], list));
    histOffset += sessions.length;
    document.getElementById('hist-load-more').style.display = sessions.length === 20 ? 'block' : 'none';
  } catch(e) {
    list.innerHTML = '<div style="text-align:center;padding:40px 20px;"><div style="font-family:var(--font-ui);font-size:11px;font-weight:700;color:var(--red);letter-spacing:0.14em;margin-bottom:6px;">LOAD FAILED</div><div style="font-family:var(--font);font-size:11px;color:var(--text3);margin-bottom:14px;">' + e.message + '</div><button class="btn-sm" onclick="loadHistory(true)">Retry</button></div>';
  }
  histLoading = false;
}

function loadMoreHistory() { loadHistory(false); }

async function deleteHistSession(sessionId) {
  if (!confirm('Delete this session and all its sets?')) return;
  await apiPost({ action: 'deleteSession', session_id: sessionId });
  histOffset = 0;
  loadHistory(true);
}

function renderSessionCard(sess, sets, container) {
  const hasPB = sess.pb_exercises && sess.pb_exercises.length > 0;
  const volStr = sess.volume > 0 ? sess.volume.toLocaleString() + ' kg' : '—';
  const rpeStr = sess.rpe ? 'RPE ' + sess.rpe : '';
  const d = new Date(sess.date + 'T00:00:00');
  const dateStr = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' });

  const card = document.createElement('div');
  card.style.cssText = 'background:var(--s1);border:1px solid var(--b2);border-radius:var(--r-lg);margin-bottom:10px;overflow:hidden;transition:border-color .15s;cursor:pointer';
  card.innerHTML = '<div style="padding:14px 16px;" onclick="toggleHistSession(this)">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">' +
      '<div>' +
        '<div style="font-family:var(--font);font-size:14px;font-weight:500;color:var(--t1)">' + sess.session_type + '</div>' +
        '<div style="font-family:var(--mono);font-size:11px;color:var(--t3);margin-top:2px">' + dateStr + ' · ' + (sess.location || 'Home') + '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;">' +
        (hasPB ? '<span style="font-family:var(--font);font-size:9px;font-weight:700;padding:3px 9px;border-radius:var(--r-full);background:rgba(245,158,11,.15);color:var(--warn);letter-spacing:.08em">PB</span>' : '') +
        '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="color:var(--t3);transition:transform .2s" class="hist-chevron"><path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</div>' +
    '</div>' +
    '<div style="display:flex;gap:16px;">' +
      '<span style="font-family:var(--mono);font-size:11px;color:var(--t3)">' + (sess.set_count || 0) + ' sets</span>' +
      '<span style="font-family:var(--mono);font-size:11px;color:var(--t2)">' + volStr + '</span>' +
      (rpeStr ? '<span style="font-family:var(--mono);font-size:11px;color:var(--t3)">' + rpeStr + '</span>' : '') +
    '</div>' +
  '</div>' +
  '<div class="hist-sets" style="display:none;border-top:1px solid var(--b1);padding:12px 16px;">' +
    renderHistSets(sets, sess.pb_exercises || []) +
    '<button onclick="deleteHistSession(\''+sess.id+'\')" style="margin-top:12px;font-family:var(--font);font-size:11px;color:var(--danger);background:none;border:1px solid var(--danger);border-radius:4px;padding:5px 12px;cursor:pointer;letter-spacing:.06em;">Delete session</button>' +
  '</div>';
  container.appendChild(card);
}

function renderHistSets(sets, pbExercises) {
  if (!sets.length) return '<div style="font-size:12px;color:var(--t3)">No sets logged.</div>';
  const byEx = {};
  sets.forEach(s => {
    if (!byEx[s.exercise_id]) byEx[s.exercise_id] = { name: s.display_name, sets: [] };
    byEx[s.exercise_id].sets.push(s);
  });
  return Object.entries(byEx).map(([id, ex]) => {
    const isPB = pbExercises.includes(id);
    const setRows = ex.sets.map(s => {
      const wStr = s.weight_kg > 0 ? s.weight_kg + 'kg' : 'BW';
      const e1rm = parseFloat(s.estimated_1rm) || 0;
      return '<div style="display:flex;gap:12px;font-family:var(--mono);font-size:11px;color:var(--t3);padding:3px 0;">' +
        '<span style="min-width:24px;color:var(--t4)">S' + s.set_num + '</span>' +
        '<span>' + (s.reps || '—') + 'r @ ' + wStr + '</span>' +
        (s.rir !== null && s.rir !== undefined ? '<span>RIR ' + s.rir + '</span>' : '') +
        (e1rm > 0 ? '<span style="color:var(--accent);margin-left:auto">' + e1rm + 'kg e1rm</span>' : '') +
      '</div>';
    }).join('');
    return '<div style="margin-bottom:14px;">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
        '<span style="font-family:var(--font);font-size:12px;font-weight:500;color:var(--t1);cursor:pointer;text-decoration:underline;text-decoration-color:var(--b3);" onclick="jumpToExercise(\x27' + id + '\x27)">' + ex.name + '</span>' +
        (isPB ? '<span style="font-family:var(--font);font-size:9px;font-weight:700;padding:2px 7px;border-radius:var(--r-full);background:rgba(245,158,11,.15);color:var(--warn)">PB</span>' : '') +
      '</div>' +
      setRows +
    '</div>';
  }).join('');
}

function toggleHistSession(header) {
  const setsDiv = header.parentElement.querySelector('.hist-sets');
  const chevron = header.querySelector('.hist-chevron');
  const open = setsDiv.style.display !== 'none';
  setsDiv.style.display = open ? 'none' : 'block';
  if (chevron) chevron.style.transform = open ? '' : 'rotate(180deg)';
}

function jumpToExercise(exerciseId) {
  initProgress();
  goScreen('s-progress');
  setTimeout(() => selectExercise(exerciseId), 100);
}
