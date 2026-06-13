let progData = [], progMetric = 'e1rm', progChart = null, progIsBW = false, progAllSets = [];

let exCategory = 'data';
let exPattern = 'all';
let progRuleIds = new Set();
let exercisesWithData = new Set();

function initProgress() {
  Promise.all([
    api('getProgressionTree'),
    api('getAllProgressionData', { limit: 2000 })
  ]).then(([progRes, setsRes]) => {
    progRuleIds = new Set((progRes.data||[]).map(p => p.exercise_id));
    progAllSets = setsRes.data || [];
    (setsRes.data||[]).forEach(s => exercisesWithData.add(s.exercise_id));
    renderExPicker();
    renderLongevityCard();
  });
  renderExPicker();
  loadHome();
  (bodyMetrics && bodyMetrics.length ? Promise.resolve() : loadBodyMetrics()).then(renderBodyweightCard);
}

// Longevity dashboard card — operationalizes the two longevity doctrine bullets
// as tracked proxies: weekly resistance dose (90–120 min sweet spot), modality
// variety (independent longevity lever), and strength trend (getting stronger =
// lower mortality risk). Dose uses real session durations via getWeeklyMinutes.
async function renderLongevityCard() {
  const el = document.getElementById('prog-longevity-card');
  if (!el) return;

  // ── Dose: real resistance minutes/week ──────────────────────────────────────
  let wk = [];
  try { const r = await api('getWeeklyMinutes', { weeks: 8 }); wk = (r.data || []).filter(w => w.mins > 0); } catch (e) { /* offline */ }
  const recent = wk.slice(0, 4);                       // up to 4 most recent weeks
  const avgMin = recent.length ? Math.round(recent.reduce((s, w) => s + w.mins, 0) / recent.length) : null;
  const doseCol = avgMin == null ? 'var(--text3)' : (avgMin >= 90 && avgMin <= 120) ? 'var(--green)' : (avgMin >= 70 && avgMin < 150) ? 'var(--amber)' : 'var(--red)';
  const doseVal = avgMin == null ? '—' : `${avgMin} min/wk`;
  const doseSub = avgMin == null ? 'log a session to start tracking'
    : avgMin < 90 ? `${90 - avgMin} min below the sweet spot`
    : avgMin <= 120 ? 'in the 90–120 min sweet spot'
    : 'past 120 — little added benefit, favour quality';

  // ── Variety + Strength from the 6-week set history ──────────────────────────
  const cutoff = new Date(Date.now() - 42 * 86400000).toISOString().slice(0, 10);
  const sets = (progAllSets || []).filter(s => s.date >= cutoff);
  const exById = {}; (exercises || []).forEach(e => { exById[e.id] = e; });
  const pats = new Set(), mods = new Set();
  sets.forEach(s => { const ex = exById[s.exercise_id]; if (!ex) return; if (ex.movement_pattern && ex.movement_pattern !== 'rehab') pats.add(ex.movement_pattern); mods.add(trainingModality(ex.equipment)); });
  const PATTERN_TOTAL = 7;                              // push pull hinge squat lunge carry core
  const nPat = pats.size;
  const varietyCol = (nPat >= 5 && mods.size >= 2) ? 'var(--green)' : nPat >= 3 ? 'var(--amber)' : 'var(--red)';
  const varietyVal = `${nPat}/${PATTERN_TOTAL} patterns`;
  const varietySub = `${mods.size} modalit${mods.size === 1 ? 'y' : 'ies'} (rings/KB/calisthenics)`;

  const byEx = {};
  sets.forEach(s => { const e1 = parseFloat(s.estimated_1rm) || 0; if (!e1) return; (byEx[s.exercise_id] = byEx[s.exercise_id] || []).push({ d: s.date, e1 }); });
  let pctSum = 0, pctN = 0, ups = 0, downs = 0;
  Object.values(byEx).forEach(arr => {
    if (arr.length < 3) return;
    arr.sort((a, b) => a.d.localeCompare(b.d));
    const mid = Math.floor(arr.length / 2);
    const av = a => a.reduce((s, x) => s + x.e1, 0) / a.length;
    const f = av(arr.slice(0, mid)), g = av(arr.slice(mid));
    if (!f) return;
    const pct = (g - f) / f * 100;
    pctSum += pct; pctN++;
    if (pct > 2) ups++; else if (pct < -2) downs++;
  });
  const avgPct = pctN ? pctSum / pctN : null;
  const strCol = avgPct == null ? 'var(--text3)' : avgPct > 2 ? 'var(--green)' : avgPct < -2 ? 'var(--amber)' : 'var(--text2)';
  const strDir = avgPct == null ? '' : avgPct > 2 ? '↑' : avgPct < -2 ? '↓' : '→';
  const strVal = avgPct == null ? '—' : `${strDir} ${avgPct >= 0 ? '+' : ''}${avgPct.toFixed(1)}%`;
  const strSub = avgPct == null ? 'not enough data yet' : `${ups} lifts up / ${downs} down`;

  const row = (label, caption, val, sub, col) => `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:9px 0;border-top:1px solid var(--border);">
      <div style="min-width:0;">
        <div style="font-family:var(--font-ui);font-size:11px;font-weight:700;color:var(--text);">${label}</div>
        <div style="font-family:var(--font);font-size:9px;color:var(--text3);margin-top:2px;line-height:1.3;">${caption}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-family:var(--font-ui);font-size:12px;font-weight:700;color:${col};white-space:nowrap;">${val}</div>
        <div style="font-family:var(--font);font-size:9px;color:var(--text3);margin-top:2px;white-space:nowrap;">${sub}</div>
      </div>
    </div>`;

  el.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.18em;">LONGEVITY</div>
        <div style="font-family:var(--font);font-size:9px;color:var(--text3);">evidence-tracked</div>
      </div>
      ${row('Resistance dose', '90–120 min/wk all-cause mortality sweet spot', doseVal, doseSub, doseCol)}
      ${row('Modality variety', 'breadth is an independent longevity lever', varietyVal, varietySub, varietyCol)}
      ${row('Strength trend', 'getting stronger lowers mortality risk', strVal, strSub, strCol)}
    </div>`;
}

let bwChart = null;
function renderBodyweightCard() {
  const el = document.getElementById('prog-bw-card');
  if (!el) return;
  const rows = (bodyMetrics || []).filter(m => m.weight_kg != null);
  if (!rows.length) {
    el.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:8px;font-family:var(--font);font-size:12px;color:var(--text2);">No weigh-ins yet — tap ⚖ on the home screen to start tracking bodyweight.</div>`;
    return;
  }
  const asc = [...rows].reverse();               // rows arrive DESC; chart wants ASC
  const latest = rows[0];
  const cutoff = new Date(Date.now() - 42 * 86400000).toISOString().slice(0, 10);
  const old = rows.find(m => m.date <= cutoff) || rows[rows.length - 1];
  const days = Math.max(1, (new Date(latest.date) - new Date(old.date)) / 86400000);
  const perWeek = ((latest.weight_kg - old.weight_kg) / days) * 7;
  const dir = perWeek > 0.05 ? '↑' : perWeek < -0.05 ? '↓' : '→';
  const col = (perWeek >= 0.2 && perWeek <= 0.55) ? 'var(--green)' : (perWeek > 0.55 || perWeek < -0.1) ? 'var(--amber)' : 'var(--text2)';
  el.innerHTML = `
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;">
        <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.18em;">BODYWEIGHT</div>
        <button type="button" onclick="openWeighIn()" style="font-family:var(--font-ui);font-size:9px;color:var(--green);background:none;border:none;cursor:pointer;letter-spacing:0.06em;padding:0;">+ Log</button>
      </div>
      <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:8px;flex-wrap:wrap;">
        <span style="font-family:var(--font-display);font-size:26px;color:var(--text);line-height:1;">${latest.weight_kg}<span style="font-size:13px;color:var(--text3);"> kg</span></span>
        ${latest.bodyfat_pct != null ? `<span style="font-family:var(--font);font-size:12px;color:var(--text2);">${latest.bodyfat_pct}% bf</span>` : ''}
        ${days >= 7 ? `<span style="font-family:var(--font-ui);font-size:11px;font-weight:700;color:${col};">${dir} ${perWeek >= 0 ? '+' : ''}${perWeek.toFixed(2)} kg/wk</span>` : ''}
      </div>
      <div style="height:90px;"><canvas id="bw-canvas"></canvas></div>
    </div>`;
  if (bwChart) { bwChart.destroy(); bwChart = null; }
  const ctx = document.getElementById('bw-canvas');
  if (ctx && window.Chart) {
    bwChart = new Chart(ctx, {
      type: 'line',
      data: { labels: asc.map(m => m.date.slice(5)), datasets: [{ data: asc.map(m => m.weight_kg), borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.08)', fill: true, tension: 0.3, pointRadius: 0, borderWidth: 2 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { ticks: { color: '#888', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } } } }
    });
  }
}

function filterExCategory(cat, el) {
  exCategory = cat;
  document.querySelectorAll('#category-filters .pill').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  renderExPicker();
}

function filterExPicker(pattern, el) {
  exPattern = pattern;
  document.querySelectorAll('#pattern-filters .pill').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  renderExPicker();
}

const CALISTHENICS_EQUIPMENT = ['rings','parallettes','bodyweight','pull_up_bar','bands'];
const LOADED_EQUIPMENT = ['kettlebell','barbell','dumbbell','cable'];

function renderExPicker() {
  const grid = document.getElementById('ex-picker-grid');
  if (!grid) return;
  let filtered = exercises.filter(e => {
    if (exPattern !== 'all' && e.movement_pattern !== exPattern) return false;
    if (exCategory === 'data') return exercisesWithData.has(e.id);
    if (exCategory === 'calisthenics') {
      const eq = (e.equipment||'').toLowerCase();
      return CALISTHENICS_EQUIPMENT.some(c => eq.includes(c)) || (!e.weight_kg && e.weight_kg !== 0);
    }
    if (exCategory === 'loaded') {
      const eq = (e.equipment||'').toLowerCase();
      return LOADED_EQUIPMENT.some(c => eq.includes(c));
    }
    if (exCategory === 'rules') return progRuleIds.has(e.id);
    return true;
  }).sort((a,b) => a.display_name.localeCompare(b.display_name));

  grid.innerHTML = filtered.map(e => {
    const hasRule = progRuleIds.has(e.id);
    return `<button onclick="selectExercise('${e.id}')" id="expill-${e.id}"
      style="font-family:var(--font-ui);font-size:10px;font-weight:600;padding:5px 11px;border-radius:14px;border:1px solid ${hasRule?'var(--green)':'var(--border2)'};color:${hasRule?'var(--green)':'var(--text2)'};background:var(--bg2);cursor:pointer;letter-spacing:0.03em;transition:all 0.12s;"
      onmouseover="this.style.borderColor='var(--text3)';this.style.color='var(--text)'"
      onmouseout="if(!this.classList.contains('active')){this.style.borderColor='${hasRule?'var(--green)':'var(--border2)'}';this.style.color='${hasRule?'var(--green)':'var(--text2)'}'}"
    >${e.display_name}${hasRule?' ↑':''}</button>`;
  }).join('');
}

let selectedExId = null;
function selectExercise(id) {
  selectedExId = id;
  document.querySelectorAll('#ex-picker-grid button').forEach(b => {
    b.classList.remove('active');
    b.style.background = 'var(--bg2)';
    b.style.borderColor = 'var(--border2)';
    b.style.color = 'var(--text2)';
  });
  const btn = document.getElementById('expill-' + id);
  if (btn) {
    btn.classList.add('active');
    btn.style.background = 'var(--text)';
    btn.style.borderColor = 'var(--text)';
    btn.style.color = 'var(--bg)';
  }
  loadExerciseProgress(id);
}

function switchProgTab(tab) {
  // Legacy aliases used by deep-links from cards
  if (tab === 'exercise' || tab === 'overview' || tab === 'tree' || tab === 'analytics' || tab === 'review') {
    const map = { exercise: 'lifts', overview: 'home', tree: 'lifts', analytics: 'data', review: 'home' };
    const sub = tab === 'tree' ? 'path' : tab === 'exercise' ? 'stats' : null;
    switchProgTab(map[tab]);
    if (sub) switchLiftsView(sub);
    return;
  }
  document.getElementById('prog-home-tab').style.display  = tab === 'home'  ? '' : 'none';
  document.getElementById('prog-lifts-tab').style.display = tab === 'lifts' ? '' : 'none';
  document.getElementById('prog-data-tab').style.display  = tab === 'data'  ? '' : 'none';
  document.querySelectorAll('.prog-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('ptab-' + tab).classList.add('active');
  if (tab === 'home') loadHome();
  if (tab === 'data') loadAnalytics();
}

let treeLoaded = false;
function switchLiftsView(view) {
  document.getElementById('lifts-stats-view').style.display = view === 'stats' ? '' : 'none';
  document.getElementById('lifts-path-view').style.display  = view === 'path'  ? '' : 'none';
  document.getElementById('lview-stats').classList.toggle('active', view === 'stats');
  document.getElementById('lview-path').classList.toggle('active', view === 'path');
  if (view === 'path' && !treeLoaded) { treeLoaded = true; loadTreeTab(); }
}

function linearRegression(pts) {
  const n = pts.length;
  if (n < 2) return { slope: 0, intercept: pts[0]?.y || 0 };
  const mx = pts.reduce((s,p) => s+p.x, 0) / n;
  const my = pts.reduce((s,p) => s+p.y, 0) / n;
  const num = pts.reduce((s,p) => s+(p.x-mx)*(p.y-my), 0);
  const den = pts.reduce((s,p) => s+(p.x-mx)*(p.x-mx), 0);
  const slope = den ? num/den : 0;
  return { slope, intercept: my - slope * mx };
}

function dayNum(dateStr) {
  return Math.floor(new Date(dateStr).getTime() / 86400000);
}

function renderStrengthChart(sets, benchmarks, isBW) {
  const byDate = {};
  sets.forEach(s => {
    const val = parseFloat(s.estimated_1rm) || parseFloat(s.weight_kg) || (isBW ? parseInt(s.reps) : 0);
    if (val > 0 && (!byDate[s.date] || val > byDate[s.date])) byDate[s.date] = val;
  });
  const pts = Object.entries(byDate).filter(([,v])=>v>0).sort(([a],[b])=>a.localeCompare(b))
    .map(([date, val]) => ({ date, val, x: dayNum(date) }));
  if (pts.length < 2) return `<div style="font-family:var(--font);font-size:10px;color:var(--text2);text-align:center;padding:20px 0;">Not enough data for chart yet</div>`;

  const reg = linearRegression(pts.map(p => ({ x: p.x, y: p.val })));
  const W = 320, H = 150, PL = 42, PR = 32, PT = 14, PB = 24;
  const cW = W - PL - PR, cH = H - PT - PB;
  const futureX = pts[pts.length-1].x + 42;
  const futureY = reg.slope * futureX + reg.intercept;
  const allY = [...pts.map(p=>p.val), futureY];
  const benchY = benchmarks.filter(b=>b.metric_value>0).map(b=>parseFloat(b.metric_value));
  const minY = Math.max(0, Math.min(...allY, ...benchY) * 0.9);
  const maxY = Math.max(...allY, ...benchY) * 1.05;
  const minX = pts[0].x; const maxX = futureX;
  const sx = d => PL + (d-minX)/(maxX-minX)*cW;
  const sy = v => PT + cH - (v-minY)/(maxY-minY)*cH;

  const linePath = pts.map((p,i)=>`${i?'L':'M'}${sx(p.x).toFixed(1)},${sy(p.val).toFixed(1)}`).join('');
  const last = pts[pts.length-1];
  const predPath = `M${sx(last.x).toFixed(1)},${sy(last.val).toFixed(1)} L${sx(futureX).toFixed(1)},${sy(Math.max(futureY,minY)).toFixed(1)}`;

  const bInt = benchmarks.find(b=>b.level==='intermediate');
  const bAdv = benchmarks.find(b=>b.level==='advanced');
  let prediction = '';
  if (reg.slope > 0 && bInt?.metric_value && last.val < bInt.metric_value) {
    const daysToInt = (bInt.metric_value - reg.intercept) / reg.slope - last.x;
    if (daysToInt > 0 && daysToInt < 365) prediction = `Intermediate benchmark in ~${Math.round(daysToInt)} days at current rate`;
  } else if (reg.slope > 0 && bAdv?.metric_value && last.val < bAdv.metric_value) {
    const daysToAdv = (bAdv.metric_value - reg.intercept) / reg.slope - last.x;
    if (daysToAdv > 0 && daysToAdv < 365) prediction = `Advanced benchmark in ~${Math.round(daysToAdv)} days at current rate`;
  }

  const trendDir = reg.slope > 0.05 ? '↑' : reg.slope < -0.05 ? '↓' : '→';
  const trendCol = reg.slope > 0.05 ? 'var(--green)' : reg.slope < -0.05 ? 'var(--amber)' : 'var(--text3)';
  const trendLabel = reg.slope > 0.05 ? `+${(reg.slope*7).toFixed(1)} /week` : reg.slope < -0.05 ? `${(reg.slope*7).toFixed(1)} /week` : 'flat';

  return `
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.18em;">${isBW?'REP TREND':'STRENGTH CURVE'}</div>
      <div style="font-family:var(--font-ui);font-size:11px;font-weight:700;color:${trendCol};">${trendDir} ${trendLabel}</div>
    </div>
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;overflow:visible;">
      ${[0,0.33,0.66,1].map(t=>{
        const v = minY+(maxY-minY)*t; const y = sy(v);
        return `<line x1="${PL}" y1="${y.toFixed(1)}" x2="${W-PR}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
                <text x="${PL-4}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="8" fill="rgba(255,255,255,0.25)" font-family="DM Mono,monospace">${Math.round(v)}</text>`;
      }).join('')}
      ${bInt?.metric_value?`<line x1="${PL}" y1="${sy(bInt.metric_value).toFixed(1)}" x2="${W-PR}" y2="${sy(bInt.metric_value).toFixed(1)}" stroke="rgba(245,158,11,0.5)" stroke-width="1" stroke-dasharray="4,3"/>
      <text x="${(W-PR+3)}" y="${(sy(bInt.metric_value)+4).toFixed(1)}" font-size="8" fill="rgba(245,158,11,0.7)" font-family="DM Mono,monospace">INT</text>`:''}
      ${bAdv?.metric_value?`<line x1="${PL}" y1="${sy(bAdv.metric_value).toFixed(1)}" x2="${W-PR}" y2="${sy(bAdv.metric_value).toFixed(1)}" stroke="rgba(34,197,94,0.4)" stroke-width="1" stroke-dasharray="4,3"/>
      <text x="${(W-PR+3)}" y="${(sy(bAdv.metric_value)+4).toFixed(1)}" font-size="8" fill="rgba(34,197,94,0.6)" font-family="DM Mono,monospace">ADV</text>`:''}
      <path d="${predPath}" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-dasharray="5,3" fill="none"/>
      <path d="${linePath}" stroke="var(--green)" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
      ${pts.map(p=>`<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.val).toFixed(1)}" r="3" fill="var(--green)"/>`).join('')}
      <circle cx="${sx(last.x).toFixed(1)}" cy="${sy(last.val).toFixed(1)}" r="5" fill="var(--green)" stroke="var(--bg)" stroke-width="2"/>
      <text x="${sx(pts[0].x).toFixed(1)}" y="${H}" text-anchor="middle" font-size="8" fill="rgba(255,255,255,0.25)" font-family="DM Mono,monospace">${pts[0].date.slice(5)}</text>
      <text x="${sx(last.x).toFixed(1)}" y="${H}" text-anchor="middle" font-size="8" fill="rgba(255,255,255,0.4)" font-family="DM Mono,monospace">${last.date.slice(5)}</text>
    </svg>
    ${prediction?`<div style="font-family:var(--font);font-size:10px;color:var(--text2);margin-top:6px;font-style:italic;">${prediction}</div>`:''}
  </div>`;
}

function renderPatternChart(chain, allSets) {
  const maxLevel = chain[chain.length-1].level;

  const today = new Date();
  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i * 7);
    const mon = new Date(d - ((d.getDay()||7)-1)*86400000);
    weeks.push(mon.toISOString().slice(0,10));
  }

  const exLevel = {};
  const seenIds = new Set();
  chain.forEach(p => { if (!seenIds.has(p.exercise_id)) { exLevel[p.exercise_id] = p.level; seenIds.add(p.exercise_id); } });

  const grid = {};
  for (let l = 1; l <= maxLevel; l++) grid[l] = Array(12).fill(0);

  allSets.forEach(s => {
    const lv = exLevel[s.exercise_id];
    if (!lv) return;
    const d = new Date(s.date);
    const mon = new Date(d - ((d.getDay()||7)-1)*86400000).toISOString().slice(0,10);
    const wi = weeks.indexOf(mon);
    if (wi >= 0) grid[lv][wi]++;
  });

  const hasAnyData = Object.values(grid).some(row => row.some(v => v > 0));
  if (!hasAnyData) return `<div style="font-family:var(--font);font-size:10px;color:var(--text2);padding:4px 0 12px;">No sets logged yet</div>`;

  const maxCount = Math.max(...Object.values(grid).flat(), 1);

  return `<div style="margin-bottom:12px;">
    <div style="display:flex;gap:0;margin-bottom:4px;">
      ${weeks.map((w,i) => `<div style="flex:1;text-align:center;font-family:var(--font);font-size:7px;color:rgba(255,255,255,0.2);">${i%3===0?w.slice(5):''}</div>`).join('')}
    </div>
    ${Array.from({length:maxLevel},(_,li) => {
      const l = maxLevel - li;
      const row = grid[l];
      const isCurrentLevel = l === Math.max(...Object.entries(exLevel).map(([id,lv])=>allSets.some(s=>s.exercise_id===id)?lv:0));
      return `<div style="display:flex;align-items:center;gap:0;margin-bottom:2px;">
        <div style="font-family:var(--font);font-size:7px;color:rgba(255,255,255,${isCurrentLevel?'0.5':'0.2'});width:16px;flex-shrink:0;text-align:right;padding-right:4px;">L${l}</div>
        ${row.map(count => {
          const intensity = count > 0 ? Math.max(0.15, count/maxCount) : 0;
          const bg = count > 0 ? `rgba(34,197,94,${intensity.toFixed(2)})` : 'rgba(255,255,255,0.03)';
          const border = isCurrentLevel && count > 0 ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(255,255,255,0.04)';
          return `<div style="flex:1;height:14px;background:${bg};border:${border};border-radius:2px;margin:0 1px;" title="${count} sets"></div>`;
        }).join('')}
      </div>`;
    }).join('')}
    <div style="display:flex;align-items:center;gap:4px;margin-top:6px;justify-content:flex-end;">
      <div style="font-family:var(--font);font-size:7px;color:rgba(255,255,255,0.2);">less</div>
      ${[0.05,0.2,0.4,0.7,1].map(i=>`<div style="width:10px;height:10px;border-radius:1px;background:rgba(34,197,94,${i});"></div>`).join('')}
      <div style="font-family:var(--font);font-size:7px;color:rgba(255,255,255,0.2);">more</div>
    </div>
  </div>`;}

async function loadTreeTab() {
  const content = document.getElementById('prog-tree-content');
  const [patternsRes, allSetsRes] = await Promise.all([
    api('getMovementPatterns'),
    api('getAllProgressionData', { limit: 2000 })
  ]);

  const patterns     = patternsRes.patterns     || [];
  const progressions = patternsRes.progressions || [];
  const allSets      = allSetsRes.data          || [];

  const patternIdsWithData = new Set(progressions.map(p => p.pattern_id));
  const seenNames = new Set();
  const activePatterns = patterns.filter(p => {
    if (!patternIdsWithData.has(p.id)) return false;
    if (seenNames.has(p.name)) return false;
    seenNames.add(p.name);
    return true;
  });

  if (!patterns.length) {
    content.innerHTML = '<div style="font-family:var(--font);font-size:11px;color:var(--text2);text-align:center;padding:32px 0;">No patterns yet</div>';
    return;
  }

  const lastSeen = {};
  allSets.forEach(s => { if (!lastSeen[s.exercise_id] || s.date > lastSeen[s.exercise_id]) lastSeen[s.exercise_id] = s.date; });

  const currentLevel = {};
  progressions.forEach(p => {
    if (lastSeen[p.exercise_id]) {
      if (!currentLevel[p.pattern_id] || p.level > currentLevel[p.pattern_id]) {
        currentLevel[p.pattern_id] = p.level;
      }
    }
  });

  const typeIcon = { dynamic:'', isometric:'◷', weighted:'⚖' };
  const typeColors = { dynamic:'var(--text)', isometric:'var(--amber)', weighted:'var(--green)' };

  content.innerHTML = activePatterns.map(pat => {
    const chain = progressions.filter(p => p.pattern_id === pat.id).sort((a,b) => a.level - b.level);
    const curLvl = currentLevel[pat.id] || 0;

    return `
    <div style="margin-bottom:28px;">
      <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.18em;margin-bottom:10px;">${pat.name.toUpperCase()}</div>
      ${renderPatternChart(chain, allSets)}
      <div style="display:flex;flex-direction:column;gap:0;">
        ${chain.map((p, i) => {
          const done    = p.level < curLvl;
          const current = p.level === curLvl;
          const next    = p.level === curLvl + 1;
          const future  = p.level > curLvl + 1;

          const bg      = done ? 'rgba(34,197,94,0.06)' : current ? 'var(--bg2)' : 'var(--bg)';
          const border  = done ? 'rgba(34,197,94,0.25)' : current ? 'var(--green)' : 'var(--border)';
          const nameCol = done ? 'var(--text3)' : current ? 'var(--text)' : next ? 'var(--text2)' : 'var(--text3)';
          const badge   = done ? '✓' : current ? '●' : '';
          const badgeCol = done ? 'var(--green)' : 'var(--green)';
          const opacity = future ? '0.45' : '1';

          return `
          <div style="display:flex;align-items:stretch;opacity:${opacity};">
            <div style="display:flex;flex-direction:column;align-items:center;width:24px;flex-shrink:0;margin-right:10px;">
              <div style="width:2px;flex:1;background:${i===0?'transparent':'var(--border)'};"></div>
              <div style="width:8px;height:8px;border-radius:50%;background:${done||current?'var(--green)':'var(--border)'};flex-shrink:0;"></div>
              <div style="width:2px;flex:1;background:${i===chain.length-1?'transparent':'var(--border)'};"></div>
            </div>
            <div onclick="switchProgTab('exercise');selectExercise('${p.exercise_id}')"
              style="flex:1;background:${bg};border:1px solid ${border};border-radius:8px;padding:10px 12px;margin:3px 0;cursor:pointer;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;">
                  ${badge ? `<span style="font-family:var(--font-ui);font-size:10px;color:${badgeCol};font-weight:700;flex-shrink:0;">${badge}</span>` : ''}
                  <span style="font-family:var(--font-ui);font-size:12px;font-weight:600;color:${nameCol};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.exercise_name}</span>
                  ${p.rep_target||p.duration_target ? `<span style="font-family:var(--font);font-size:10px;color:${done?'rgba(34,197,94,0.5)':current?'var(--text2)':'var(--text3)'};flex-shrink:0;">${p.rep_target||p.duration_target}</span>` : ''}
                  ${typeIcon[p.type] ? `<span style="font-size:10px;color:${typeColors[p.type]};opacity:0.7;flex-shrink:0;">${typeIcon[p.type]}</span>` : ''}
                </div>
              </div>
              ${p.notes && current ? `<div style="font-family:var(--font);font-size:10px;color:var(--text);margin-top:4px;font-style:italic;opacity:0.8;">${p.notes}</div>` : ''}
              ${p.equipment ? `<div style="font-family:var(--font-ui);font-size:8px;color:var(--text2);margin-top:3px;letter-spacing:0.1em;">${p.equipment.replace(/_/g,' ').toUpperCase()}</div>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}

let reviewHTML = null;

async function generateCoachReview() {
  const content = document.getElementById('prog-review-inline');
  content.innerHTML = `<div style="text-align:center;padding:48px 0;">
    <div style="font-family:var(--font);font-size:12px;color:var(--text2);margin-bottom:8px;">Analysing 6 weeks of training data...</div>
    <div class="typing" style="justify-content:center;"><span></span><span></span><span></span></div>
  </div>`;

  try {
    const sixWeeksAgo = new Date();
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);
    const cutoff = sixWeeksAgo.toLocaleDateString('en-CA');

    const [allSetsRes, debriefRes, sessionsRes] = await Promise.all([
      api('getAllProgressionData', { limit: 2000 }),
      api('getRecentDebriefs', { limit: 20 }),
      api('getSessions', { limit: 30 })
    ]);

    const allSets  = (allSetsRes.data     || []).filter(s => s.date >= cutoff);
    const debriefs = (debriefRes.data     || []).filter(d => d.date >= cutoff);
    const sessions = (sessionsRes.sessions|| []).filter(s => s.date >= cutoff);

    const totalVolume = allSets.reduce((s,e) => s + (parseInt(e.reps)||0)*(parseFloat(e.weight_kg)||1), 0);
    const byPattern = {};
    allSets.forEach(s => { const ex = exercises.find(e=>e.id===s.exercise_id); const p=ex?.movement_pattern||'other'; byPattern[p]=(byPattern[p]||0)+1; });
    const weeklyVols = {};
    allSets.forEach(s => { const d=new Date(s.date); const mon=new Date(d-((d.getDay()||7)-1)*86400000); const w=mon.toISOString().slice(0,10); weeklyVols[w]=(weeklyVols[w]||0)+(parseInt(s.reps)||0)*(parseFloat(s.weight_kg)||1); });

    const injStr = injuries.length ? injuries.map(i => i.body_part + ': ' + i.restrictions).join('; ') : 'None';
    const kitStr = buildKitString(loc);
    const stimulusStr = summariseStimulus(allSets, exercises, latestBodyweight(bodyMetrics));

    const system = `You are a sports scientist reviewing 6 weeks of training data for James. Be direct, specific, evidence-based. No filler. Reference actual numbers.

${MODALITY_DOCTRINE}

ATHLETE CONTEXT:
Location: ${loc}
Equipment: ${kitStr}
Active injuries: ${injStr}
${bodyweightContext(bodyMetrics)}

TRAINING DATA (last 6 weeks):
Sessions: ${sessions.length}

${stimulusStr}

Secondary (kg tonnage — biased toward KB, under-counts calisthenics, use only for loaded-lift trend):
Total loaded volume: ${Math.round(totalVolume)}kg (BW sets counted as 1kg)
Movement pattern breakdown: ${Object.entries(byPattern).map(([p,n])=>`${p}: ${n} sets`).join(', ')}
Weekly volume trend: ${Object.entries(weeklyVols).sort().map(([w,v])=>`${w.slice(5)}: ${Math.round(v)}kg`).join(', ')}

DEBRIEFS:
${debriefs.map(d=>`${d.date} ${d.session_type}: ${d.performance_signal}, ${d.outcome||''}, ${d.total_sets}sets ${d.total_volume_kg}kg. ${d.recommendation}`).join('\n')}

Return ONLY valid JSON, no markdown:
{
  "period": "date range covered",
  "headline": "One sentence overall assessment",
  "signal": "improving|stable|declining",
  "sections": [
    {"title":"Volume & Load","finding":"2-3 sentences with specific numbers","status":"good|warning|attention","action":"One specific actionable change"},
    {"title":"Movement Balance","finding":"Push/pull/hinge/squat distribution analysis","status":"good|warning|attention","action":"One specific actionable change"},
    {"title":"Recovery & Readiness","finding":"How readiness signals correlate with performance","status":"good|warning|attention","action":"One specific actionable change"},
    {"title":"Progression Velocity","finding":"Which exercises are moving, which are stalling","status":"good|warning|attention","action":"One specific actionable change"}
  ],
  "next_6_weeks": "3 specific priorities for the next training block. Be directive.",
  "risk_flags": ["Any injury risk or overtraining signals worth flagging"]
}`;

    const raw = await claude(system, [{ role:'user', content:'Analyse my last 6 weeks.' }], SONNET);
    const jsonStart = raw.indexOf('{');
    const jsonEnd   = raw.lastIndexOf('}');
    const review = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));

    const sigCol = { improving:'var(--green)', stable:'var(--text2)', declining:'var(--amber)' }[review.signal] || 'var(--text2)';
    const sigIcon = { improving:'↑', stable:'→', declining:'↓' }[review.signal] || '→';
    const stCol = { good:'var(--green)', warning:'var(--amber)', attention:'#ef4444' };
    const stLbl = { good:'✓ GOOD', warning:'⚠ WATCH', attention:'⚡ FIX' };

    reviewHTML =
      `<div style="background:var(--bg2);border:1px solid var(--border);border-left:2px solid ${sigCol};border-radius:10px;padding:14px;margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.18em;">6-WEEK REVIEW · ${review.period}</div>
          <div style="font-family:var(--font-display);font-size:20px;color:${sigCol};">${sigIcon} ${review.signal.toUpperCase()}</div>
        </div>
        <div style="font-family:var(--font);font-size:13px;color:var(--text);line-height:1.6;">${review.headline}</div>
      </div>` +

      review.sections.map(s => `
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="font-family:var(--font-ui);font-size:11px;font-weight:700;color:var(--text);">${s.title}</div>
          <div style="font-family:var(--font-ui);font-size:8px;font-weight:700;color:${stCol[s.status]||'var(--text3)'};letter-spacing:0.1em;">${stLbl[s.status]||s.status}</div>
        </div>
        <div style="font-family:var(--font);font-size:11px;color:var(--text2);line-height:1.6;margin-bottom:8px;">${s.finding}</div>
        <div style="font-family:var(--font-ui);font-size:10px;font-weight:600;color:var(--green);background:rgba(34,197,94,0.06);border-radius:6px;padding:6px 10px;">→ ${s.action}</div>
      </div>`).join('') +

      `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:10px;">
        <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.18em;margin-bottom:8px;">NEXT 6 WEEKS</div>
        <div style="font-family:var(--font);font-size:12px;color:var(--text);line-height:1.7;">${review.next_6_weeks}</div>
      </div>` +

      (review.risk_flags?.length ? `
      <div style="background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:12px 14px;margin-bottom:10px;">
        <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:#ef4444;letter-spacing:0.18em;margin-bottom:8px;">⚠ FLAGS</div>
        ${review.risk_flags.map(f=>`<div style="font-family:var(--font);font-size:11px;color:var(--text2);margin-bottom:4px;">· ${f}</div>`).join('')}
      </div>` : '') +

      `<button type="button" onclick="generateCoachReview()" style="font-family:var(--font-ui);font-size:10px;font-weight:600;color:var(--text2);background:none;border:1px solid var(--border2);border-radius:6px;padding:8px 16px;cursor:pointer;width:100%;letter-spacing:0.06em;margin-bottom:12px;">↺ Regenerate</button>`;
    content.innerHTML = reviewHTML;

  } catch(e) {
    content.innerHTML = `<div style="font-family:var(--font);font-size:11px;color:var(--text2);text-align:center;padding:32px 0;">Review failed — ${e.message}<br><br><button type="button" onclick="generateCoachReview()" style="font-family:var(--font-ui);font-size:10px;color:var(--green);background:none;border:1px solid rgba(34,197,94,0.3);border-radius:6px;padding:6px 14px;cursor:pointer;">Retry</button></div>`;
  }
}

async function loadExerciseProgress(exerciseId) {
  if (!exerciseId) exerciseId = selectedExId;
  const content = document.getElementById('prog-ex-content');
  if (!exerciseId) {
    content.innerHTML = '<div style="text-align:center;padding:48px 20px;"><div style="font-family:var(--font-ui);font-size:11px;font-weight:700;color:var(--text3);letter-spacing:0.18em;margin-bottom:8px;">SELECT AN EXERCISE</div><div style="font-family:var(--font);font-size:11px;color:var(--text3);">Tap any exercise in the grid above</div></div>';
    return;
  }
  content.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;"><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">' + Array(3).fill('<div class="skel" style="height:72px;border-radius:10px;"></div>').join('') + '</div>' + Array(3).fill('<div class="skel" style="height:44px;border-radius:10px;"></div>').join('') + '</div>';

  const [histRes, progRes, benchRes] = await Promise.all([
    api('getProgressionData', { exercise_id: exerciseId, limit: 60 }),
    api('getProgressionTree',  { exercise_id: exerciseId }),
    api('getBenchmarks',       { exercise_id: exerciseId })
  ]);

  const sets       = histRes.data  || [];
  const rules      = progRes.data  || [];
  const benchmarks = benchRes.data || [];
  const ex   = exercises.find(e => e.id === exerciseId) || {};
  const isBW = sets.every(s => !s.weight_kg || parseFloat(s.weight_kg) === 0);

  const totalSets  = sets.length;
  const sessions   = [...new Set(sets.map(s => s.date))].length;
  const bestReps   = Math.max(0, ...sets.map(s => parseInt(s.reps) || 0));
  const bestWeight = Math.max(0, ...sets.map(s => parseFloat(s.weight_kg) || 0));
  const recentSets = sets.slice(0, 8);

  const bestE1rm = Math.max(0, ...sets.map(s => parseFloat(s.estimated_1rm) || 0));
  const pbSet = sets.find(s => parseFloat(s.estimated_1rm) >= bestE1rm) || sets[0];

  const bySession = {};
  sets.forEach(s => {
    const k = s.date;
    if (!bySession[k]) bySession[k] = 0;
    bySession[k] += (parseInt(s.reps)||0) * (parseFloat(s.weight_kg)||1);
  });
  const sessionDates = Object.keys(bySession).sort().slice(-8);
  const sessionVols  = sessionDates.map(d => bySession[d]);
  const maxVol = Math.max(...sessionVols, 1);

  const bySessMap = {};
  recentSets.forEach(s => { if (!bySessMap[s.date]) bySessMap[s.date] = []; bySessMap[s.date].push(s); });
  const sessionHistoryHTML = Object.entries(bySessMap).slice(0,6).map(([date, sess]) =>
    `<div style="margin-bottom:10px;">
      <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.1em;margin-bottom:5px;">${date}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${sess.map(s => `<div style="background:var(--bg3);border-radius:6px;padding:5px 9px;">
          <span style="font-family:var(--font-display);font-size:16px;color:var(--text);">${s.reps}</span>
          <span style="font-family:var(--font);font-size:9px;color:var(--text3);">r${!isBW&&s.weight_kg?' @'+s.weight_kg+'kg':''} · ${s.rir!=null?s.rir+'RES':'—'}</span>
        </div>`).join('')}
      </div>
    </div>`).join('');
  const bBeg = benchmarks.find(b => b.level === 'beginner');
  const bInt = benchmarks.find(b => b.level === 'intermediate');
  const bAdv = benchmarks.find(b => b.level === 'advanced');
  const rule = rules[0] || null;

  const levers = rule ? (() => { try { return JSON.parse(rule.intensity_levers||'[]'); } catch { return []; } })() : [];

  content.innerHTML =
    `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px;">
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center;">
        <div style="font-family:var(--font-display);font-size:28px;color:var(--text);line-height:1;">${sessions}</div>
        <div style="font-family:var(--font-ui);font-size:8px;font-weight:700;color:var(--text3);letter-spacing:0.16em;margin-top:3px;">SESSIONS</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center;">
        <div style="font-family:var(--font-display);font-size:28px;color:var(--text);line-height:1;">${isBW ? bestReps : bestWeight}</div>
        <div style="font-family:var(--font-ui);font-size:8px;font-weight:700;color:var(--text3);letter-spacing:0.16em;margin-top:3px;">${isBW ? 'BEST REPS' : 'BEST KG'}</div>
      </div>
      <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center;">
        <div style="font-family:var(--font-display);font-size:28px;color:var(--text);line-height:1;">${totalSets}</div>
        <div style="font-family:var(--font-ui);font-size:8px;font-weight:700;color:var(--text3);letter-spacing:0.16em;margin-top:3px;">TOTAL SETS</div>
      </div>
    </div>` +

    (pbSet ? `<div style="background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--green);letter-spacing:0.18em;margin-bottom:4px;">🏆 PERSONAL BEST</div>
        <div style="font-family:var(--font-display);font-size:28px;color:var(--text);line-height:1;">${isBW ? bestReps + ' reps' : bestWeight + 'kg'}</div>
        ${!isBW && bestE1rm > 0 ? `<div style="font-family:var(--font);font-size:10px;color:var(--text2);margin-top:2px;">e1RM ${bestE1rm.toFixed(1)}kg</div>` : ''}
      </div>
      <div style="text-align:right;">
        <div style="font-family:var(--font);font-size:10px;color:var(--text2);">${pbSet.date?.slice(5) || ''}</div>
        <div style="font-family:var(--font);font-size:10px;color:var(--text2);margin-top:2px;">${pbSet.reps} reps${pbSet.weight_kg > 0 ? ' @ '+pbSet.weight_kg+'kg' : ''}</div>
      </div>
    </div>` : '') +

    renderStrengthChart(sets, benchmarks, isBW) +

    (rule ? `<div style="background:var(--bg2);border:1px solid var(--border);border-left:2px solid var(--green);border-radius:10px;padding:12px 14px;margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.18em;">NEXT MILESTONE</div>
        <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--green);letter-spacing:0.1em;">LEVEL ${ex.matrix_level||'?'}</div>
      </div>
      <div style="font-family:var(--font-ui);font-size:13px;font-weight:600;color:var(--text);margin-bottom:6px;">Hit ${rule.rep_target} @ ${rule.rir_target} left · ${rule.sessions_to_confirm} sessions</div>
      <div style="font-family:var(--font);font-size:11px;color:var(--text2);margin-bottom:${levers.length?'8px':'0'};">${rule.next_exercise_id ? '→ ' + rule.next_exercise_id.replace(/_/g,' ') + (rule.next_requires?' <span style="color:var(--text2);">(needs '+rule.next_requires+')</span>':'') : '→ Peak tier for this pattern'}</div>
      ${levers.length ? `<div style="font-family:var(--font);font-size:10px;color:var(--text2);">Levers: ${levers.slice(0,3).join(' · ')}</div>` : ''}
    </div>` : '') +

    (bBeg && bInt && bAdv ? `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:12px;">
      <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.18em;margin-bottom:10px;">WHERE YOU SIT</div>
      ${[bBeg,bInt,bAdv].map(b => {
        const isYou = !isBW && b.metric_value && bestWeight >= b.metric_value * 0.85;
        const colour = b.level==='beginner'?'var(--text3)':b.level==='intermediate'?'var(--amber)':'var(--green)';
        return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:${colour};letter-spacing:0.1em;width:80px;flex-shrink:0;">${b.level.toUpperCase()}</div>
          <div style="flex:1;height:4px;background:var(--bg3);border-radius:2px;overflow:hidden;"><div style="height:100%;background:${colour};width:100%;border-radius:2px;opacity:${isYou?1:0.25};"></div></div>
          <div style="font-family:var(--font);font-size:10px;color:${isYou?'var(--text)':'var(--text3)'};width:52px;text-align:right;flex-shrink:0;">${b.metric_value?b.metric_value+'kg':b.reps}</div>
          ${isYou?'<div style="font-family:var(--font-ui);font-size:9px;color:var(--text);font-weight:700;flex-shrink:0;">you</div>':'<div style="width:24px;flex-shrink:0;"></div>'}
        </div>`;
      }).join('')}
    </div>` : '') +

    (sessionDates.length > 1 ? `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:12px;">
      <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.18em;margin-bottom:10px;">VOLUME TREND</div>
      <div style="display:flex;align-items:flex-end;gap:4px;height:48px;">
        ${sessionVols.map((v,i)=>{const h=Math.max(4,Math.round((v/maxVol)*48));return `<div style="flex:1;height:${h}px;background:${i===sessionVols.length-1?'var(--green)':'var(--border2)'};border-radius:2px 2px 0 0;"></div>`;}).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;">
        <span style="font-family:var(--font);font-size:9px;color:var(--text3);">${sessionDates[0].slice(5)}</span>
        <span style="font-family:var(--font);font-size:9px;color:var(--text3);">${sessionDates[sessionDates.length-1].slice(5)}</span>
      </div>
    </div>` : '') +

    `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;">
      <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.18em;margin-bottom:10px;">SESSION HISTORY</div>
      ${sessionHistoryHTML}
    </div>`;
}

async function loadHome() {
  const content = document.getElementById('prog-home-content');
  const [debriefRes, allSetsRes, progTreeRes, sessionsRes] = await Promise.all([
    api('getRecentDebriefs', { limit: 10 }),
    api('getAllProgressionData', { limit: 2000 }),
    api('getProgressionTree'),
    api('getSessions', { limit: 50 })
  ]);
  const debriefs  = debriefRes.data  || [];
  const allSets   = allSetsRes.data  || [];
  const progRules = progTreeRes.data || [];
  const sessions  = sessionsRes.sessions || [];

  const getWeekKey = dateStr => {
    const [y,m,d] = dateStr.slice(0,10).split('-').map(Number);
    const dt = new Date(y, m-1, d);
    const day = dt.getDay() || 7;
    const mon = new Date(y, m-1, d - (day-1));
    return mon.toISOString().slice(0,10);
  };
  const todayStr = new Date().toLocaleDateString('en-CA');
  const lastWeekStr = (() => { const d = new Date(); d.setDate(d.getDate()-7); return d.toLocaleDateString('en-CA'); })();
  const thisWeek = getWeekKey(todayStr);
  const lastWeek = getWeekKey(lastWeekStr);
  const sessionsByWeek = {};
  sessions.forEach(s => {
    const w = getWeekKey(s.date);
    sessionsByWeek[w] = sessionsByWeek[w] || new Set();
    sessionsByWeek[w].add(s.date);
  });
  const thisCount = (sessionsByWeek[thisWeek]?.size || 0);
  const lastCount = (sessionsByWeek[lastWeek]?.size || 0);
  const streakDelta = thisCount - lastCount;

  const lastTrained = sessions.map(s => s.date.slice(0,10)).sort().pop() || null;
  const daysSince = lastTrained ? Math.max(0, Math.round((new Date(todayStr) - new Date(lastTrained)) / 86400000)) : null;

  const heat = {};
  allSets.forEach(s => { heat[s.date] = (heat[s.date] || 0) + 1; });

  const thisMonth = new Date().toLocaleDateString('en-CA').slice(0,7);
  const allTimeMax = {};
  const allTimeBestSet = {};
  const monthMax   = {};
  allSets.forEach(s => {
    const e1rm = parseFloat(s.estimated_1rm) || 0;
    const wt   = parseFloat(s.weight_kg) || 0;
    const reps = parseInt(s.reps) || 0;
    const val  = e1rm > 0 ? e1rm : (wt > 0 ? wt : reps);
    if (!allTimeMax[s.exercise_id] || val > allTimeMax[s.exercise_id]) {
      allTimeMax[s.exercise_id] = val;
      allTimeBestSet[s.exercise_id] = s;
    }
    if (s.date?.startsWith(thisMonth)) {
      if (!monthMax[s.exercise_id] || val > monthMax[s.exercise_id]) monthMax[s.exercise_id] = val;
    }
  });
  const pbs = Object.entries(monthMax)
    .filter(([id, v]) => v > 0 && v >= (allTimeMax[id] || 0))
    .map(([id]) => exercises.find(e => e.id === id)?.display_name || id)
    .slice(0, 6);

  const progScores = [];
  for (const rule of progRules) {
    const exSets = allSets.filter(s => s.exercise_id === rule.exercise_id);
    if (!exSets.length) continue;
    const targetReps = parseInt((rule.rep_target||'').match(/\d+$/)?.[0]) || 0;
    const targetSets = parseInt((rule.rep_target||'').match(/^(\d+)x/)?.[1]) || 3;
    const bySess = {};
    exSets.forEach(s => { bySess[s.date] = bySess[s.date] || []; bySess[s.date].push(s); });
    const sessionsHit = Object.values(bySess).filter(sets => {
      const qualSets = sets.filter(s => (parseInt(s.reps)||0) >= targetReps);
      return qualSets.length >= targetSets;
    }).length;
    const needed = rule.sessions_to_confirm || 2;
    const pct = Math.min(100, Math.round((sessionsHit / needed) * 100));
    const ex = exercises.find(e => e.id === rule.exercise_id);
    if (!ex) continue;
    progScores.push({ id: rule.exercise_id, name: ex.display_name, sessionsHit, needed, pct, next: rule.next_exercise_id, nextReq: rule.next_requires, ready: sessionsHit >= needed });
  }
  progScores.sort((a,b) => b.pct - a.pct);

  const weekVols = {};
  allSets.forEach(s => { const w = getWeekKey(s.date); if (!weekVols[w]) weekVols[w] = 0; weekVols[w] += (parseInt(s.reps)||0)*(parseFloat(s.estimated_1rm)||1); });
  const weeks   = Object.keys(weekVols).sort().slice(-8);
  const weekMax = Math.max(...weeks.map(w=>weekVols[w]), 1);

  const outcomeColour = { progressed:'var(--green)', maintained:'var(--text2)', declined:'var(--amber)', incomplete:'var(--text3)' };

  const accomplished = progScores.filter(p => p.ready);
  const thisClose    = progScores.filter(p => !p.ready && p.pct >= 50);
  const building     = progScores.filter(p => !p.ready && p.pct > 0 && p.pct < 50);

  const fourWeeksAgo = new Date(); fourWeeksAgo.setDate(fourWeeksAgo.getDate()-28);
  const recentSessions = sessions.filter(s => new Date(s.date) >= fourWeeksAgo).length;
  const sessionsPerWeek = Math.max(recentSessions / 4, 0.5);

  const addEta = items => items.map(p => {
    const sessionsLeft = Math.max(0, p.needed - p.sessionsHit);
    const weeks = sessionsLeft / sessionsPerWeek;
    const days  = Math.round(weeks * 7);
    p.eta = sessionsLeft === 0 ? 'now' : days <= 7 ? `~${days}d` : `~${Math.round(weeks)}wk`;
    return p;
  });

  addEta(accomplished); addEta(thisClose); addEta(building);

  const renderProgTier = (items, tier) => {
    if (!items.length) return '';
    const configs = {
      accomplished: { label:'🏆 ACCOMPLISHED', colour:'var(--green)', borderColour:'rgba(34,197,94,0.3)', bg:'rgba(34,197,94,0.05)', barColour:'var(--green)' },
      thisClose:    { label:'⚡ THIS CLOSE',   colour:'var(--amber)', borderColour:'rgba(245,158,11,0.3)', bg:'rgba(245,158,11,0.05)', barColour:'var(--amber)' },
      building:     { label:'🎯 BUILDING',     colour:'var(--text3)', borderColour:'var(--border)',        bg:'var(--bg2)',            barColour:'var(--text3)' },
    };
    const c = configs[tier];
    return `<div style="background:${c.bg};border:1px solid ${c.borderColour};border-radius:10px;padding:12px 14px;margin-bottom:10px;">
      <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:${c.colour};letter-spacing:0.18em;margin-bottom:10px;">${c.label}</div>
      ${items.map(p => {
        const alreadyQueued = pendingProgressions.some(q => q.from === p.id);
        const alreadyApplied = appliedProgressions.has(p.id);
        const btnLabel = alreadyQueued ? '✓ Queued' : alreadyApplied ? '✓ Applied' : 'Apply →';
        const btnColor = (alreadyQueued || alreadyApplied) ? 'var(--text3)' : 'var(--green)';
        const btnBorder = (alreadyQueued || alreadyApplied) ? 'var(--border2)' : 'rgba(34,197,94,0.4)';
        return `<div style="padding:8px 0;border-bottom:1px solid ${c.borderColour};cursor:pointer;" onclick="switchProgTab('exercise');selectExercise('${p.id}')">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:${tier==='building'?'0':'5px'};">
            <div style="font-family:var(--font-ui);font-size:12px;font-weight:600;color:var(--text);">${p.name}</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="font-family:var(--font);font-size:10px;color:var(--text2);">${p.sessionsHit}/${p.needed}</div>
              ${p.eta && tier !== 'accomplished' ? `<div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);background:var(--bg3);padding:2px 6px;border-radius:4px;">${p.eta}</div>` : ''}
              ${tier === 'accomplished' ? `<button id="apply-prog-${p.id}" onclick="event.stopPropagation();applyProgression('${p.id}','${p.next||''}','${p.name}','${p.next?p.next.replace(/_/g,' '):''}')"
                style="font-family:var(--font-ui);font-size:10px;font-weight:700;color:${btnColor};background:none;border:1px solid ${btnBorder};border-radius:5px;padding:3px 10px;cursor:pointer;letter-spacing:0.06em;white-space:nowrap;">
                ${btnLabel}
              </button>` : ''}
            </div>
          </div>
          ${tier !== 'building' ? `<div style="height:3px;background:var(--bg3);border-radius:2px;overflow:hidden;margin-bottom:4px;"><div style="height:100%;background:${c.barColour};width:${Math.min(100,p.pct)}%;border-radius:2px;box-shadow:0 0 4px ${c.borderColour};"></div></div>` : ''}
          ${tier === 'accomplished' && p.next ? `<div style="font-family:var(--font);font-size:10px;color:var(--text2);">→ ${p.next.replace(/_/g,' ')}${p.nextReq?' (needs '+p.nextReq+')':''}</div>` : ''}
          ${tier === 'thisClose' ? `<div style="font-family:var(--font);font-size:10px;color:var(--amber);">One more session at target → advance</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  };

  const dCol = daysSince == null ? 'var(--text3)' : daysSince <= 2 ? 'var(--green)' : daysSince <= 4 ? 'var(--amber)' : 'var(--red)';

  content.innerHTML =
    `<div style="background:linear-gradient(140deg,var(--bg2) 45%,rgba(34,197,94,0.08));border:1px solid var(--border);border-radius:14px;padding:16px 12px 12px;margin-bottom:12px;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center;">
        <div>
          <div style="font-family:var(--font-display);font-size:38px;color:${dCol};line-height:1;">${daysSince ?? '—'}</div>
          <div style="font-family:var(--font-ui);font-size:8px;font-weight:700;color:var(--text3);letter-spacing:0.12em;margin-top:6px;">DAYS SINCE<br>SESSION</div>
        </div>
        <div style="border-left:1px solid var(--border);border-right:1px solid var(--border);">
          <div style="font-family:var(--font-display);font-size:38px;color:var(--text);line-height:1;">${thisCount}</div>
          <div style="font-family:var(--font-ui);font-size:8px;font-weight:700;color:var(--text3);letter-spacing:0.12em;margin-top:6px;">SESSIONS<br>THIS WEEK</div>
        </div>
        <div>
          <div style="font-family:var(--font-display);font-size:38px;color:${pbs.length?'var(--green)':'var(--text3)'};line-height:1;">${pbs.length}</div>
          <div style="font-family:var(--font-ui);font-size:8px;font-weight:700;color:var(--text3);letter-spacing:0.12em;margin-top:6px;">PBs THIS<br>MONTH</div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;gap:8px;margin-top:12px;padding-top:10px;border-top:1px solid var(--border);">
        <span style="font-family:var(--font);font-size:10px;color:${streakDelta>0?'var(--green)':streakDelta<0?'var(--amber)':'var(--text3)'};">${streakDelta>0?'↑ +'+streakDelta+' vs last week':streakDelta<0?'↓ '+streakDelta+' vs last week':'→ same as last week'}</span>
        ${pbs.length?`<span style="font-family:var(--font);font-size:10px;color:var(--text2);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">🏆 ${pbs.slice(0,2).join(', ')}${pbs.length>2?' +'+(pbs.length-2):''}</span>`:''}
      </div>
    </div>` +

    renderAnalyticsHeatmap(heat) +

    renderProgTier(accomplished, 'accomplished') +
    renderProgTier(thisClose, 'thisClose') +
    renderProgTier(building, 'building') +

    `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:12px;">
      <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.18em;margin-bottom:10px;">WEEKLY VOLUME</div>
      <div style="display:flex;align-items:flex-end;gap:4px;height:48px;">
        ${weeks.map((w,i)=>{const h=Math.max(4,Math.round((weekVols[w]/weekMax)*48));return `<div style="flex:1;height:${h}px;background:${i===weeks.length-1?'var(--green)':'var(--border2)'};border-radius:2px 2px 0 0;"></div>`;}).join('')}
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;">
        <span style="font-family:var(--font);font-size:9px;color:var(--text3);">${weeks[0]?.slice(5)||''}</span>
        <span style="font-family:var(--font);font-size:9px;color:var(--text3);">this week</span>
      </div>
    </div>` +

    (debriefs.length ? `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:12px;">
      <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.18em;margin-bottom:10px;">RECENT SESSIONS</div>
      ${debriefs.map(d=>{
        const oc=d.outcome||d.performance_signal||'';
        const col=outcomeColour[oc]||'var(--text3)';
        return `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
          <div>
            <div style="font-family:var(--font-ui);font-size:12px;font-weight:600;color:var(--text);">${d.session_type}</div>
            <div style="font-family:var(--font);font-size:10px;color:var(--text2);margin-top:2px;">${d.date} · ${d.total_sets} sets · ${d.total_volume_kg}kg</div>
          </div>
          <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:${col};letter-spacing:0.1em;padding:3px 8px;border:1px solid ${col};border-radius:4px;opacity:0.8;">${oc.toUpperCase()}</div>
        </div>`;
      }).join('')}
    </div>` : '') +

    (() => {
      const pbRows = Object.entries(allTimeMax)
        .filter(([id, v]) => v > 0)
        .sort((a,b) => b[1]-a[1])
        .slice(0, 12)
        .map(([id]) => {
          const exName = exercises.find(e => e.id === id)?.display_name || id;
          const bestSet = allTimeBestSet[id];
          return `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--border);">
            <div style="font-family:var(--font-ui);font-size:11px;font-weight:500;color:var(--text2);">${exName}</div>
            <div style="font-family:var(--font);font-size:11px;color:var(--text);white-space:nowrap;">${bestSet ? bestSet.reps+'r'+(bestSet.weight_kg>0?' @ '+bestSet.weight_kg+'kg':'') : '—'}</div>
          </div>`;
        }).join('');
      return pbRows ? `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:12px;">
        <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.18em;margin-bottom:10px;">🏆 ALL-TIME BESTS</div>
        ${pbRows}
      </div>` : '';
    })() +

    `<div id="prog-review-inline">${reviewHTML || `
      <div style="background:linear-gradient(140deg,var(--bg2) 45%,rgba(34,197,94,0.06));border:1px solid var(--border);border-radius:10px;padding:16px;text-align:center;margin-bottom:12px;">
        <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.18em;margin-bottom:8px;">6-WEEK COACH REVIEW</div>
        <div style="font-family:var(--font);font-size:11px;color:var(--text2);margin-bottom:14px;line-height:1.6;">Volume trends, movement balance, progression velocity and recovery — analysed across your last 6 weeks.</div>
        <button type="button" onclick="generateCoachReview()" style="font-family:var(--font-ui);font-size:11px;font-weight:700;color:var(--bg);background:var(--green);border:none;border-radius:8px;padding:11px 22px;cursor:pointer;letter-spacing:0.06em;">Generate Review →</button>
      </div>`}</div>`;
}

// ─── Analytics (DATA tab) ────────────────────────────────────────────────────

let analyticsCache = null;

const aCard = (title, caption, body) => `
  <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:12px;">
    <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:var(--text3);letter-spacing:0.18em;margin-bottom:4px;">${title}</div>
    ${caption ? `<div style="font-family:var(--font);font-size:10px;color:var(--text3);margin-bottom:10px;line-height:1.5;">${caption}</div>` : '<div style="margin-bottom:6px;"></div>'}
    ${body}
  </div>`;

async function loadAnalytics(force) {
  const content = document.getElementById('prog-analytics-content');
  if (!analyticsCache || force) {
    content.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px;padding-top:4px;"><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;"><div class="skel" style="height:80px;border-radius:10px;"></div><div class="skel" style="height:80px;border-radius:10px;"></div></div><div class="skel" style="height:110px;border-radius:10px;"></div><div class="skel" style="height:140px;border-radius:10px;"></div><div class="skel" style="height:140px;border-radius:10px;"></div></div>';
    try { analyticsCache = await api('getAnalytics'); }
    catch (e) {
      content.innerHTML = `<div style="font-family:var(--font);font-size:11px;color:var(--text2);text-align:center;padding:32px 0;">Couldn't load analytics — ${e.message}<br><br><button type="button" onclick="loadAnalytics(true)" style="font-family:var(--font-ui);font-size:10px;color:var(--green);background:none;border:1px solid rgba(34,197,94,0.3);border-radius:6px;padding:6px 14px;cursor:pointer;">Retry</button></div>`;
      return;
    }
  }
  const a = analyticsCache;
  const lastLine = a.daysSince == null ? '' : a.daysSince === 0 ? ' · last trained today' : a.daysSince === 1 ? ' · last trained yesterday' : ` · last trained ${a.daysSince} days ago`;
  content.innerHTML =
    `<div style="font-family:var(--font);font-size:10px;color:var(--text3);margin:2px 2px 12px;">Averaging <span style="color:var(--text);font-weight:600;">${a.sessionsPerWeek}</span> sessions/week over the last 8 weeks${lastLine}.</div>` +
    renderAnalyticsPatterns(a.patterns) +
    renderAnalyticsAdherence(a.adherence) +
    renderAnalyticsReadiness(a.readiness) +
    (a.injuries || []).map(renderInjuryImpact).join('');
}

function renderAnalyticsHeatmap(heat) {
  heat = heat || {};
  // 17 columns of weeks (Mon–Sun), oldest left, ending this week
  const today = new Date(new Date().toLocaleDateString('en-CA'));
  const monday = new Date(today); monday.setDate(monday.getDate() - ((monday.getDay() || 7) - 1));
  const weeks = [];
  for (let w = 16; w >= 0; w--) { const d = new Date(monday); d.setDate(d.getDate() - w * 7); weeks.push(d); }
  const max = Math.max(...Object.values(heat), 1);
  const todayStr = today.toLocaleDateString('en-CA');

  const monthLabels = weeks.map((d, i) => {
    const prev = i > 0 ? weeks[i - 1] : null;
    const show = !prev || prev.getMonth() !== d.getMonth();
    return `<div style="flex:1;font-family:var(--font);font-size:7px;color:var(--text3);">${show ? d.toLocaleDateString('en-AU', { month: 'short' }) : ''}</div>`;
  }).join('');

  const grid = Array.from({ length: 7 }, (_, row) =>
    `<div style="display:flex;gap:2px;margin-bottom:2px;">${weeks.map(wk => {
      const d = new Date(wk); d.setDate(d.getDate() + row);
      const ds = d.toLocaleDateString('en-CA');
      if (ds > todayStr) return '<div style="flex:1;aspect-ratio:1;"></div>';
      const n = heat[ds] || 0;
      const bg = n ? `rgba(34,197,94,${Math.max(0.25, n / max).toFixed(2)})` : 'rgba(255,255,255,0.04)';
      return `<div title="${fmtDate(ds)}${n ? ' · ' + n + ' sets' : ''}" style="flex:1;aspect-ratio:1;background:${bg};border-radius:2px;"></div>`;
    }).join('')}</div>`
  ).join('');

  return aCard('TRAINING DAYS · LAST 4 MONTHS', 'Each square is a day. Green = trained; darker = more sets.',
    `<div style="display:flex;gap:2px;margin-bottom:3px;">${monthLabels}</div>${grid}`);
}

function renderAnalyticsPatterns(patterns) {
  if (!patterns || !patterns.length) return aCard('MOVEMENT DOSE · LAST 4 WEEKS', '', '<div style="font-family:var(--font);font-size:10px;color:var(--text3);">No sets logged in the last 4 weeks.</div>');
  const BAR_MAX = 24; // x-axis cap in hard sets/week; growth zone 10–20
  const rows = patterns.map(p => {
    const w = Math.min(100, (p.hardPerWeek / BAR_MAX) * 100);
    const zone = p.hardPerWeek < 10 ? 'LOW' : p.hardPerWeek <= 20 ? 'OK' : 'HIGH';
    const zoneCol = zone === 'OK' ? 'var(--green)' : 'var(--amber)';
    return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
      <div style="font-family:var(--font-ui);font-size:9px;font-weight:600;color:var(--text2);width:52px;flex-shrink:0;text-transform:uppercase;">${p.pattern}</div>
      <div style="flex:1;height:10px;background:var(--bg3);border-radius:3px;position:relative;overflow:hidden;">
        <div style="position:absolute;left:${(10 / BAR_MAX) * 100}%;width:${(10 / BAR_MAX) * 100}%;height:100%;background:rgba(34,197,94,0.12);"></div>
        <div style="position:absolute;left:0;height:100%;background:${zoneCol};width:${w}%;border-radius:3px;opacity:0.8;"></div>
      </div>
      <div style="font-family:var(--font);font-size:10px;color:var(--text);width:42px;text-align:right;flex-shrink:0;">${p.hardPerWeek}/wk</div>
      <div style="font-family:var(--font-ui);font-size:8px;font-weight:700;color:${zoneCol};width:30px;flex-shrink:0;">${zone}</div>
      <div style="font-family:var(--font);font-size:9px;color:var(--text3);width:30px;text-align:right;flex-shrink:0;">${p.sharePct}%</div>
    </div>`;
  }).join('');
  return aCard('MOVEMENT DOSE · LAST 4 WEEKS',
    'Hard sets per week by movement pattern (sets at RIR ≤ 2). The shaded band, 10–20 per week, is the muscle-growth zone. Right column = share of all your sets.',
    rows);
}

function renderAnalyticsAdherence(adh) {
  if (!adh || adh.avgPct == null) return aCard("GERALD'S PLAN VS REALITY", '', '<div style="font-family:var(--font);font-size:10px;color:var(--text3);">No planned sessions logged yet.</div>');
  const col = adh.avgPct >= 85 ? 'var(--green)' : adh.avgPct >= 65 ? 'var(--amber)' : '#ef4444';
  const icon = { done: '✓', partial: '◐', skipped: '✗' };
  const iconCol = { done: 'var(--green)', partial: 'var(--amber)', skipped: '#ef4444' };
  const rows = adh.sessions.map((s, i) => `
    <div onclick="const d=document.getElementById('adh-d-${i}');d.style.display=d.style.display==='none'?'':'none';" style="cursor:pointer;padding:7px 0;border-bottom:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="font-family:var(--font);font-size:10px;color:var(--text3);width:46px;flex-shrink:0;">${fmtDate(s.date)}</div>
        <div style="font-family:var(--font-ui);font-size:10px;font-weight:600;color:var(--text2);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.type || ''}</div>
        <div style="width:64px;height:4px;background:var(--bg3);border-radius:2px;overflow:hidden;flex-shrink:0;"><div style="height:100%;width:${s.pct}%;background:${s.pct >= 85 ? 'var(--green)' : s.pct >= 65 ? 'var(--amber)' : '#ef4444'};"></div></div>
        <div style="font-family:var(--font);font-size:10px;color:var(--text);width:34px;text-align:right;flex-shrink:0;">${s.pct}%</div>
      </div>
      <div id="adh-d-${i}" style="display:none;padding:6px 0 2px 54px;">
        ${s.items.map(it => `<div style="font-family:var(--font);font-size:10px;color:var(--text2);margin-bottom:3px;"><span style="color:${iconCol[it.status]};">${icon[it.status]}</span> ${it.name} — ${it.status === 'skipped' ? 'skipped' : it.actual + '/' + it.planned + ' sets'}</div>`).join('')}
      </div>
    </div>`).join('');
  return aCard("GERALD'S PLAN VS REALITY",
    `How much of the prescribed work you actually completed, over your last ${adh.sessions.length} planned sessions. Tap a session for the exercise-by-exercise breakdown.`,
    `<div style="display:flex;align-items:baseline;gap:10px;margin-bottom:8px;">
      <div style="font-family:var(--font-display);font-size:36px;color:${col};line-height:1;">${adh.avgPct}%</div>
      <div style="font-family:var(--font);font-size:10px;color:var(--text3);">of prescribed sets completed</div>
    </div>
    ${rows}
    ${adh.mostSkipped ? `<div style="font-family:var(--font);font-size:10px;color:var(--amber);margin-top:8px;">Most skipped: ${adh.mostSkipped.name} — ${adh.mostSkipped.times} of ${adh.mostSkipped.outOf} plans</div>` : ''}`);
}

function renderAnalyticsReadiness(readiness) {
  const bands = { low: { label: 'LOW', col: '#ef4444' }, moderate: { label: 'MODERATE', col: 'var(--amber)' }, high: { label: 'HIGH', col: 'var(--green)' } };
  const withData = (readiness || []).filter(r => r.sessions > 0);
  if (withData.length < 2) return aCard('READINESS VS RESULTS', '', '<div style="font-family:var(--font);font-size:10px;color:var(--text3);">Not enough rated sessions yet — log sleep & energy before sessions and this fills in.</div>');
  const rows = (readiness || []).filter(r => r.sessions > 0).map(r => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);">
      <div style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:${bands[r.band].col};width:70px;flex-shrink:0;">${bands[r.band].label}</div>
      <div style="font-family:var(--font);font-size:10px;color:var(--text2);flex:1;">${r.sessions} session${r.sessions === 1 ? '' : 's'}</div>
      <div style="font-family:var(--font);font-size:10px;color:var(--text);width:70px;text-align:right;">${r.avgVolume.toLocaleString()} kg</div>
      <div style="font-family:var(--font);font-size:10px;color:${r.progressedPct == null ? 'var(--text3)' : r.progressedPct >= 50 ? 'var(--green)' : 'var(--text2)'};width:78px;text-align:right;">${r.progressedPct == null ? '—' : r.progressedPct + '% progressed'}</div>
    </div>`).join('');
  const low = readiness.find(r => r.band === 'low'), high = readiness.find(r => r.band === 'high');
  let verdict = '';
  if (low?.sessions >= 2 && high?.sessions >= 2 && high.avgVolume > 0) {
    const diff = Math.round((1 - low.avgVolume / high.avgVolume) * 100);
    verdict = diff >= 10
      ? `On low-readiness days you move ${diff}% less volume — Gerald's reduce-the-dose rule is earning its keep.`
      : `Your output barely changes on low-readiness days (${Math.abs(diff)}% difference) — you may be able to keep the normal dose when tired.`;
  } else {
    verdict = 'Once there are a few sessions in each band, a verdict appears here.';
  }
  return aCard('READINESS VS RESULTS',
    'Sessions grouped by your pre-session sleep &amp; energy scores. Does feeling rough actually cost you performance?',
    rows + `<div style="font-family:var(--font);font-size:10px;color:var(--text2);margin-top:8px;font-style:italic;">${verdict}</div>`);
}

function renderInjuryImpact(inj) {
  const endLabel = inj.active ? 'now' : (inj.date_end ? fmtDate(inj.date_end) : '?');
  const period = `${fmtDate(inj.date_start)} → ${endLabel} · ${inj.days} days`;
  const freqLine = `<div style="display:flex;gap:14px;margin-bottom:10px;">
    <div><div style="font-family:var(--font);font-size:9px;color:var(--text3);">Sessions/wk before</div><div style="font-family:var(--font-display);font-size:20px;color:var(--text);">${inj.freqPre}</div></div>
    <div style="align-self:center;color:var(--text3);">→</div>
    <div><div style="font-family:var(--font);font-size:9px;color:var(--text3);">during injury</div><div style="font-family:var(--font-display);font-size:20px;color:${inj.freqDuring < inj.freqPre ? 'var(--amber)' : 'var(--green)'};">${inj.freqDuring}</div></div>
  </div>`;
  const chip = (label, v, unit) => `<span style="font-family:var(--font);font-size:9px;color:${v == null ? 'var(--text3)' : 'var(--text2)'};">${label} <span style="color:var(--text);">${v == null ? '—' : v + ' ' + unit}</span></span>`;
  const injKey = 'inj' + inj.date_start.replace(/-/g, '');
  const exRows = inj.exercises.length ? inj.exercises.map((e, i) => `
    <div style="padding:6px 0;border-bottom:1px solid var(--border);${i >= 4 ? `display:none;" data-injmore="${injKey}` : ''}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px;">
        <span style="font-family:var(--font-ui);font-size:11px;font-weight:600;color:var(--text);">${e.name}</span>
        <span style="font-family:var(--font-ui);font-size:9px;font-weight:700;color:${e.deltaPct < -2 ? '#ef4444' : e.deltaPct > 2 ? 'var(--green)' : 'var(--text3)'};">${e.deltaPct > 0 ? '+' : ''}${e.deltaPct}% during</span>
      </div>
      <div style="display:flex;gap:12px;">${chip('BEFORE', e.pre, e.unit)}${chip('DURING', e.during, e.unit)}${chip('AFTER', e.post, e.unit)}</div>
    </div>`).join('')
    : '<div style="font-family:var(--font);font-size:10px;color:var(--text3);">Not enough logged data around this injury to measure per-exercise impact.</div>';
  const moreBtn = inj.exercises.length > 4
    ? `<button type="button" onclick="document.querySelectorAll('[data-injmore=&quot;${injKey}&quot;]').forEach(el=>el.style.display='');this.style.display='none';" style="font-family:var(--font-ui);font-size:9px;color:var(--text2);background:none;border:1px solid var(--border2);border-radius:5px;padding:5px 12px;cursor:pointer;margin-top:8px;">Show all ${inj.exercises.length} exercises</button>`
    : '';
  return aCard(
    `INJURY IMPACT · ${inj.body_part.toUpperCase()} <span style="font-weight:400;color:${inj.active ? '#ef4444' : 'var(--green)'};letter-spacing:0;">${inj.active ? '● active' : '✓ resolved'}</span>`,
    `${period}. Your best set on each exercise before the injury vs during it${inj.date_end ? ' vs the 8 weeks after' : ''} — kg of estimated 1RM for loaded lifts, reps for bodyweight.`,
    freqLine + exRows + moreBtn);
}

function applyProgression(fromId, toId, fromName, toName) {
  const already = pendingProgressions.findIndex(p => p.from === fromId);
  const wasApplied = appliedProgressions.has(fromId);

  if (already >= 0 || wasApplied) {
    // Toggle off — clear both pending and applied
    if (already >= 0) pendingProgressions.splice(already, 1);
    appliedProgressions.delete(fromId);
    localStorage.setItem('pendingProgressions', JSON.stringify(pendingProgressions));
    localStorage.setItem('appliedProgressions', JSON.stringify([...appliedProgressions]));
    const btn = document.getElementById('apply-prog-' + fromId);
    if (btn) { btn.textContent = 'Apply →'; btn.style.color = 'var(--green)'; btn.style.borderColor = 'rgba(34,197,94,0.4)'; }
    return;
  }
  pendingProgressions.push({ from: fromId, to: toId, fromName, toName });
  localStorage.setItem('pendingProgressions', JSON.stringify(pendingProgressions));
  const btn = document.getElementById('apply-prog-' + fromId);
  if (btn) { btn.textContent = '✓ Queued'; btn.style.color = 'var(--text3)'; btn.style.borderColor = 'var(--border2)'; }
  showToast(toName ? `${toName} queued for next session` : `${fromName} — peak tier noted`, 'success');
}
