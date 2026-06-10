#!/usr/bin/env python3
"""Patches jt_train.html to add analytics tab. Run from ~/Projects/jt-train/"""
import sys, os, re

path = os.path.expanduser('~/Projects/jt-train/jt_train.html')
with open(path) as f:
    src = f.read()

if 'prog-analytics-tab' in src:
    print('Already patched.')
    sys.exit(0)

if 'switchProgTab' in src or len(src.splitlines()) > 1400:
    print(f'Unexpected state ({len(src.splitlines())} lines). Aborting.')
    sys.exit(1)

print(f'Source: {len(src.splitlines())} lines. Patching...')

# ── 1. Add Chart.js if missing ────────────────────────────────────────────────
if 'chart.umd.js' not in src:
    src = src.replace(
        '<title>JT.TRAIN</title>',
        '<title>JT.TRAIN</title>\n<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js" defer></script>'
    )

# ── 2. Add analytics CSS before scrollbar comment ────────────────────────────
analytics_css = '''
  /* ── Analytics tab ──────────────────────────────────────────────────────── */
  .prog-tabs { display: flex; border: 1px solid var(--border2); border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
  .prog-tab { flex: 1; background: none; border: none; border-right: 1px solid var(--border2); font-family: var(--font); font-size: 10px; letter-spacing: 0.12em; color: var(--text3); cursor: pointer; padding: 9px 0; transition: all 0.15s; }
  .prog-tab:last-child { border-right: none; }
  .prog-tab.active { background: var(--text); color: var(--bg); }
  .an-section { margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
  .an-section:last-child { border-bottom: none; margin-bottom: 0; }
  .an-chart-card { background: var(--bg2); border: 1px solid var(--border2); border-radius: 10px; padding: 12px; margin: 10px 0; }
  .an-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--border); }
  .an-row:last-child { border-bottom: none; }
  .an-row-name { font-size: 12px; color: var(--text2); }
  .an-row-sub { font-size: 10px; color: var(--text3); margin-top: 2px; }
  .an-badge { font-size: 9px; padding: 3px 8px; border-radius: 4px; letter-spacing: 0.08em; white-space: nowrap; }
  .narrative-box { background: var(--bg2); border: 1px solid var(--border2); border-radius: 10px; padding: 14px; margin: 10px 0 0; font-size: 12px; color: var(--text2); line-height: 1.8; min-height: 60px; white-space: pre-wrap; }
  .corr-bar-wrap { flex: 1; margin-left: 10px; height: 5px; background: var(--bg3); border-radius: 3px; overflow: hidden; }

'''
src = src.replace('  /* Scrollbar */', analytics_css + '  /* Scrollbar */', 1)

# ── 3. Replace s-progress screen ─────────────────────────────────────────────
old_screen = '''<!-- PROGRESS -->
<div id="s-progress" class="screen">
  <div class="header">
    <div class="logo"><div class="dot live"></div>PROGRESS</div>
    <button class="btn-sm" onclick="goScreen('s-idle')">← Back</button>
  </div>
  <div class="prog-body">
    <div class="lbl">EXERCISE</div>
    <select id="prog-ex-sel" class="prog-ex-sel" onchange="loadProgress()">
      <option value="">— Select exercise —</option>
    </select>
    <div class="metric-tabs">
      <button class="metric-tab active" id="mt-e1rm"   onclick="setProgMetric('e1rm',this)">E1RM</button>
      <button class="metric-tab"        id="mt-weight" onclick="setProgMetric('weight',this)">WEIGHT</button>
      <button class="metric-tab"        id="mt-vol"    onclick="setProgMetric('volume',this)">VOLUME</button>
    </div>
    <div class="prog-chart-card">
      <div id="prog-chart-wrap" style="position:relative;height:100%;display:flex;align-items:center;justify-content:center;">
        <span style="font-size:11px;color:var(--text3)">Select an exercise above</span>
      </div>
    </div>
    <div class="prog-stats" id="prog-stats"></div>
    <div id="prog-recent"></div>
  </div>
</div>'''

new_screen = '''<!-- PROGRESS -->
<div id="s-progress" class="screen">
  <div class="header">
    <div class="logo"><div class="dot live"></div>PROGRESS</div>
    <button class="btn-sm" onclick="goScreen('s-idle')">← Back</button>
  </div>
  <div class="prog-body">
    <div class="prog-tabs">
      <button class="prog-tab active" id="ptab-chart"     onclick="switchProgTab('chart')">CHART</button>
      <button class="prog-tab"        id="ptab-analytics" onclick="switchProgTab('analytics')">ANALYTICS</button>
    </div>
    <!-- CHART TAB -->
    <div id="prog-chart-tab">
      <div class="lbl">EXERCISE</div>
      <select id="prog-ex-sel" class="prog-ex-sel" onchange="loadProgress()">
        <option value="">— Select exercise —</option>
      </select>
      <div class="metric-tabs">
        <button class="metric-tab active" id="mt-e1rm"   onclick="setProgMetric('e1rm',this)">E1RM</button>
        <button class="metric-tab"        id="mt-weight" onclick="setProgMetric('weight',this)">WEIGHT</button>
        <button class="metric-tab"        id="mt-vol"    onclick="setProgMetric('volume',this)">VOLUME</button>
      </div>
      <div class="prog-chart-card">
        <div id="prog-chart-wrap" style="position:relative;height:100%;display:flex;align-items:center;justify-content:center;">
          <span style="font-size:11px;color:var(--text3)">Select an exercise above</span>
        </div>
      </div>
      <div class="prog-stats" id="prog-stats"></div>
      <div id="prog-recent"></div>
    </div>
    <!-- ANALYTICS TAB -->
    <div id="prog-analytics-tab" style="display:none;">
      <div class="an-section">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div class="lbl">COACHING INSIGHT</div>
          <button class="btn-sm" id="narrative-btn" onclick="generateNarrative()">Generate &#8594;</button>
        </div>
        <div class="narrative-box" id="narrative-text" style="color:var(--text3)">Tap Generate for a Claude-powered coaching analysis.</div>
      </div>
      <div class="an-section">
        <div class="lbl" style="margin-bottom:10px">TREND &amp; PREDICTION</div>
        <select id="trend-ex-sel" class="prog-ex-sel" onchange="renderTrendChart()" style="margin-bottom:10px">
          <option value="">— Select exercise —</option>
        </select>
        <div class="an-chart-card" style="height:190px;position:relative">
          <canvas id="trend-canvas" role="img" aria-label="Trend chart">Trend chart.</canvas>
        </div>
        <div id="trend-forecast" style="font-size:11px;color:var(--text3);margin-top:6px;text-align:center;min-height:16px;"></div>
      </div>
      <div class="an-section">
        <div class="lbl" style="margin-bottom:10px">PLATEAU STATUS</div>
        <div id="an-plateaus"><div style="font-size:11px;color:var(--text3)">Load analytics to view</div></div>
      </div>
      <div class="an-section">
        <div class="lbl" style="margin-bottom:10px">SESSION FATIGUE (avg rep drop set 1&#8594;last)</div>
        <div class="an-chart-card" id="fatigue-wrap" style="position:relative;height:40px">
          <canvas id="fatigue-canvas" role="img" aria-label="Fatigue chart">Fatigue chart.</canvas>
        </div>
      </div>
      <div class="an-section">
        <div class="lbl" style="margin-bottom:10px">SHOULDER IMPACT (pre vs post Mar 10)</div>
        <div class="an-chart-card" id="shoulder-wrap" style="position:relative;height:40px">
          <canvas id="shoulder-canvas" role="img" aria-label="Shoulder impact chart">Shoulder chart.</canvas>
        </div>
      </div>
      <div class="an-section">
        <div class="lbl" style="margin-bottom:10px">EXERCISE CORRELATIONS</div>
        <div id="an-correlations"><div style="font-size:11px;color:var(--text3)">Load analytics to view</div></div>
      </div>
    </div>
  </div>
</div>'''

if old_screen in src:
    src = src.replace(old_screen, new_screen, 1)
    print('Screen replaced.')
else:
    print('ERROR: could not find progress screen. Aborting.')
    sys.exit(1)

# ── 4. Add analytics JS before boot call ─────────────────────────────────────
analytics_js = '''
// ── Progress tab switch ───────────────────────────────────────────────────────
function switchProgTab(tab) {
  document.getElementById('prog-chart-tab').style.display     = tab === 'chart'     ? 'block' : 'none';
  document.getElementById('prog-analytics-tab').style.display = tab === 'analytics' ? 'block' : 'none';
  document.querySelectorAll('.prog-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('ptab-' + tab).classList.add('active');
  if (tab === 'analytics' && !anLoaded) loadAnalytics();
}

let anLoaded = false, anData = null;
let trendChart = null, fatigueChart = null, shoulderChart = null;

function linReg(ys) {
  const n = ys.length;
  if (n < 2) return null;
  const mx = (n - 1) / 2;
  const my = ys.reduce((a, b) => a + b) / n;
  const slope = ys.reduce((s, y, i) => s + (i - mx) * (y - my), 0) / ys.reduce((s, _, i) => s + (i - mx) ** 2, 0);
  return { slope, intercept: my - slope * mx };
}

function pearson(x, y) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b) / n;
  const my = y.reduce((a, b) => a + b) / n;
  const num = x.reduce((s, xi, i) => s + (xi - mx) * (y[i] - my), 0);
  const den = Math.sqrt(x.reduce((s, xi) => s + (xi - mx) ** 2, 0) * y.reduce((s, yi) => s + (yi - my) ** 2, 0));
  return den === 0 ? 0 : parseFloat((num / den).toFixed(2));
}

async function loadAnalytics() {
  ['an-plateaus','an-correlations'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '<div style="font-size:11px;color:var(--text3)">Loading...</div>';
  });
  try {
    const result = await api('getAllProgressionData', { limit: 2000 });
    const allSets = result.data || [];
    if (!allSets.length) {
      ['an-plateaus','an-correlations'].forEach(id => {
        document.getElementById(id).innerHTML = '<div style="font-size:11px;color:var(--text3)">No data yet</div>';
      });
      return;
    }
    const byEx = {};
    allSets.forEach(r => {
      if (!byEx[r.exercise_id]) byEx[r.exercise_id] = [];
      byEx[r.exercise_id].push(r);
    });
    const timelines = {};
    Object.entries(byEx).forEach(([id, sets]) => {
      const isBW = sets.every(s => !s.weight_kg || parseFloat(s.weight_kg) === 0);
      const byDate = {};
      sets.forEach(s => {
        const d = s.date;
        if (!byDate[d]) byDate[d] = { date: d, e1rm: 0, weight: 0, maxReps: 0 };
        const e1 = parseFloat(s.estimated_1rm) || 0;
        byDate[d].e1rm    = Math.max(byDate[d].e1rm,    isBW ? parseInt(s.reps)||0 : e1);
        byDate[d].weight  = Math.max(byDate[d].weight,  parseFloat(s.weight_kg)||0);
        byDate[d].maxReps = Math.max(byDate[d].maxReps, parseInt(s.reps)||0);
      });
      timelines[id] = {
        name: sets[0].display_name,
        shoulderSafe: sets[0].shoulder_safe === 1 || sets[0].shoulder_safe === true,
        isBW,
        points: Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)),
      };
    });
    const plateaus     = computePlateaus(timelines);
    const fatigue      = computeFatigue(byEx);
    const shoulder     = computeShoulderImpact(timelines);
    const correlations = computeCorrelations(timelines);
    anData = { timelines, byEx, plateaus, fatigue, shoulder, correlations };
    anLoaded = true;
    const trendSel = document.getElementById('trend-ex-sel');
    if (trendSel) {
      trendSel.innerHTML = '<option value="">— Select exercise —</option>' +
        Object.entries(timelines)
          .filter(([, t]) => t.points.length >= 3)
          .sort((a, b) => a[1].name.localeCompare(b[1].name))
          .map(([id, t]) => '<option value="' + id + '">' + t.name + '</option>')
          .join('');
    }
    renderPlateaus(plateaus);
    renderFatigueChart(fatigue);
    renderShoulderChart(shoulder);
    renderCorrelations(correlations);
  } catch(e) {
    ['an-plateaus','an-correlations'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<div style="font-size:11px;color:var(--red)">Error: ' + e.message + '</div>';
    });
  }
}

function computePlateaus(timelines) {
  return Object.entries(timelines)
    .filter(([, t]) => t.points.length >= 3)
    .map(([id, t]) => {
      const recent = t.points.slice(-4);
      const ys = recent.map(p => p.e1rm);
      const reg = linReg(ys);
      const slope = reg ? parseFloat(reg.slope.toFixed(2)) : 0;
      const status = slope < -0.3 ? 'regressing' : Math.abs(slope) < 0.3 ? 'plateau' : 'progressing';
      return { id, name: t.name, isBW: t.isBW, slope, current: ys[ys.length-1], sessions: t.points.length, status };
    })
    .sort((a, b) => ({ regressing: 0, plateau: 1, progressing: 2 }[a.status] - { regressing: 0, plateau: 1, progressing: 2 }[b.status]));
}

function computeFatigue(byEx) {
  const result = [];
  Object.entries(byEx).forEach(([id, sets]) => {
    const bySess = {};
    sets.forEach(s => {
      if (!bySess[s.date]) bySess[s.date] = [];
      bySess[s.date].push({ num: parseInt(s.set_num)||1, reps: parseInt(s.reps)||0 });
    });
    const diffs = [];
    Object.values(bySess).forEach(ss => {
      if (ss.length < 2) return;
      ss.sort((a, b) => a.num - b.num);
      const first = ss[0].reps, last = ss[ss.length-1].reps;
      if (first > 0) diffs.push((first - last) / first * 100);
    });
    if (diffs.length >= 2) {
      result.push({ id, name: sets[0].display_name, avgFatigue: parseFloat((diffs.reduce((a,b)=>a+b)/diffs.length).toFixed(1)), sessions: diffs.length });
    }
  });
  return result.sort((a, b) => b.avgFatigue - a.avgFatigue).slice(0, 10);
}

function computeShoulderImpact(timelines) {
  const injDate = '2026-03-10';
  return Object.entries(timelines).map(([id, t]) => {
    const before = t.points.filter(p => p.date < injDate);
    const after  = t.points.filter(p => p.date >= injDate);
    if (!before.length || !after.length) return null;
    const avgB = before.reduce((s, p) => s + p.e1rm, 0) / before.length;
    const avgA = after.reduce((s, p)  => s + p.e1rm, 0) / after.length;
    if (avgB === 0) return null;
    return { id, name: t.name, shoulderSafe: t.shoulderSafe, avgBefore: parseFloat(avgB.toFixed(1)), avgAfter: parseFloat(avgA.toFixed(1)), deltaPct: parseFloat(((avgA-avgB)/avgB*100).toFixed(1)) };
  }).filter(Boolean).sort((a, b) => a.deltaPct - b.deltaPct).slice(0, 8);
}

function computeCorrelations(timelines) {
  const ids = Object.keys(timelines);
  const results = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = timelines[ids[i]], b = timelines[ids[j]];
      const mapA = new Map(a.points.map(p => [p.date, p.e1rm]));
      const mapB = new Map(b.points.map(p => [p.date, p.e1rm]));
      const shared = [...mapA.keys()].filter(d => mapB.has(d));
      if (shared.length < 3) continue;
      results.push({ nameA: a.name, nameB: b.name, r: pearson(shared.map(d=>mapA.get(d)), shared.map(d=>mapB.get(d))), n: shared.length });
    }
  }
  return results.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 6);
}

function renderPlateaus(data) {
  const el = document.getElementById('an-plateaus');
  if (!el) return;
  const colors = { regressing: 'var(--red)', plateau: 'var(--amber)', progressing: 'var(--green)' };
  const labels = { regressing: 'REGRESSING', plateau: 'PLATEAU', progressing: 'PROGRESSING' };
  el.innerHTML = data.map(p => {
    const c = colors[p.status];
    const tStr = (p.slope >= 0 ? '+' : '') + p.slope + (p.isBW ? ' reps' : 'kg') + '/sess';
    return '<div class="an-row"><div><div class="an-row-name">' + p.name + '</div><div class="an-row-sub">' + tStr + ' \u00b7 ' + p.current + (p.isBW?'r':'kg') + ' now \u00b7 ' + p.sessions + ' sessions</div></div><span class="an-badge" style="background:' + c + '22;color:' + c + '">' + labels[p.status] + '</span></div>';
  }).join('');
}

function renderFatigueChart(data) {
  const wrap = document.getElementById('fatigue-wrap');
  if (!wrap || !data.length) return;
  wrap.style.height = Math.max(160, data.length * 36 + 60) + 'px';
  if (fatigueChart) { fatigueChart.destroy(); fatigueChart = null; }
  fatigueChart = new Chart(document.getElementById('fatigue-canvas'), {
    type: 'bar',
    data: {
      labels: data.map(d => d.name.length > 22 ? d.name.slice(0,22)+'\u2026' : d.name),
      datasets: [{ data: data.map(d => d.avgFatigue), backgroundColor: data.map(d => d.avgFatigue > 35 ? '#ef4444' : d.avgFatigue > 18 ? '#f59e0b' : '#22c55e'), borderRadius: 3, borderSkipped: false }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1, titleColor: '#666', bodyColor: '#e8e4dc', callbacks: { label: c => ' ' + c.parsed.x.toFixed(1) + '% avg drop' } } },
      scales: { x: { ticks: { color: '#444', font: { family: "'DM Mono',monospace", size: 9 }, callback: v => v + '%' }, grid: { color: '#1a1a1a' }, border: { color: '#222' } }, y: { ticks: { color: '#888', font: { family: "'DM Mono',monospace", size: 9 } }, grid: { display: false }, border: { color: '#222' } } }
    }
  });
}

function renderShoulderChart(data) {
  const wrap = document.getElementById('shoulder-wrap');
  if (!wrap || !data.length) return;
  wrap.style.height = Math.max(140, data.length * 36 + 60) + 'px';
  if (shoulderChart) { shoulderChart.destroy(); shoulderChart = null; }
  shoulderChart = new Chart(document.getElementById('shoulder-canvas'), {
    type: 'bar',
    data: {
      labels: data.map(d => d.name.length > 22 ? d.name.slice(0,22)+'\u2026' : d.name),
      datasets: [{ data: data.map(d => d.deltaPct), backgroundColor: data.map(d => d.deltaPct >= 0 ? '#22c55e' : '#ef4444'), borderRadius: 3, borderSkipped: false }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1, titleColor: '#666', bodyColor: '#e8e4dc', callbacks: { label: c => { const d = data[c.dataIndex]; return ' ' + (c.parsed.x > 0 ? '+' : '') + c.parsed.x + '% | ' + d.avgBefore + '\u2192' + d.avgAfter + 'kg'; } } } },
      scales: { x: { ticks: { color: '#444', font: { family: "'DM Mono',monospace", size: 9 }, callback: v => v + '%' }, grid: { color: '#1a1a1a' }, border: { color: '#222' } }, y: { ticks: { color: '#888', font: { family: "'DM Mono',monospace", size: 9 } }, grid: { display: false }, border: { color: '#222' } } }
    }
  });
}

function renderCorrelations(data) {
  const el = document.getElementById('an-correlations');
  if (!el) return;
  if (!data.length) { el.innerHTML = '<div style="font-size:11px;color:var(--text3)">Not enough shared sessions yet.</div>'; return; }
  el.innerHTML = data.map(c => {
    const pct = Math.abs(c.r) * 100;
    const col = c.r >= 0 ? '#22c55e' : '#ef4444';
    return '<div class="an-row" style="flex-direction:column;align-items:flex-start;gap:6px"><div style="display:flex;justify-content:space-between;width:100%"><div><div class="an-row-name" style="font-size:11px">' + c.nameA + '</div><div class="an-row-name" style="font-size:11px">\u00d7 ' + c.nameB + '</div></div><span style="font-size:13px;font-weight:500;color:' + col + ';margin-left:10px">r = ' + (c.r >= 0 ? '+' : '') + c.r + '</span></div><div style="display:flex;align-items:center;width:100%;gap:8px"><div style="flex:1;height:5px;background:var(--bg3);border-radius:3px"><div style="width:' + pct + '%;height:100%;background:' + col + ';border-radius:3px"></div></div><span style="font-size:9px;color:var(--text3)">' + c.n + ' shared</span></div></div>';
  }).join('');
}

function renderTrendChart() {
  if (!anData) return;
  const sel = document.getElementById('trend-ex-sel');
  const id = sel && sel.value;
  if (!id) return;
  const t = anData.timelines[id];
  if (!t || t.points.length < 2) return;
  const pts = t.points;
  const ys = pts.map(p => p.e1rm);
  const reg = linReg(ys);
  const unit = t.isBW ? 'reps' : 'kg';
  const forecastVals = reg ? [1,2,3,4].map(i => parseFloat((reg.intercept + reg.slope*(ys.length-1+i)).toFixed(1))) : [];
  const allLabels = [...pts.map(p => { const d = new Date(p.date+'T00:00:00'); return d.toLocaleDateString('en-AU',{day:'numeric',month:'short'}); }), ...forecastVals.map((_,i) => 'S+'+(i+1))];
  const actualData   = [...ys, ...forecastVals.map(() => null)];
  const forecastData = [...ys.map(() => null), ...(reg ? forecastVals : [])];
  if (forecastData.length > ys.length) forecastData[ys.length - 1] = ys[ys.length - 1];
  if (trendChart) { trendChart.destroy(); trendChart = null; }
  trendChart = new Chart(document.getElementById('trend-canvas'), {
    type: 'line',
    data: { labels: allLabels, datasets: [
      { label: 'Actual', data: actualData, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.07)', borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#22c55e', pointBorderColor: '#0a0a0a', pointBorderWidth: 2, tension: 0.2, fill: true, spanGaps: false },
      { label: 'Forecast', data: forecastData, borderColor: '#f59e0b', backgroundColor: 'transparent', borderWidth: 2, borderDash: [6, 4], pointRadius: 4, pointBackgroundColor: '#f59e0b', pointBorderColor: '#0a0a0a', pointBorderWidth: 2, pointStyle: 'triangle', tension: 0.1, fill: false, spanGaps: false }
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1a1a', borderColor: '#333', borderWidth: 1, titleColor: '#666', bodyColor: '#e8e4dc', callbacks: { label: c => ' ' + c.parsed.y + ' ' + unit } } },
      scales: { x: { ticks: { color: '#444', font: { family: "'DM Mono',monospace", size: 9 }, maxRotation: 30, autoSkip: true, maxTicksLimit: 8 }, grid: { color: '#1a1a1a' }, border: { color: '#222' } }, y: { ticks: { color: '#444', font: { family: "'DM Mono',monospace", size: 9 }, maxTicksLimit: 4, callback: v => v + unit }, grid: { color: '#1a1a1a' }, border: { color: '#222' } } }
    }
  });
  const fc = document.getElementById('trend-forecast');
  if (fc && reg && forecastVals.length) {
    const delta = parseFloat((reg.slope * 4).toFixed(1));
    const sign = delta >= 0 ? '+' : '';
    fc.innerHTML = '4-session forecast: <span style="color:var(--amber)">' + forecastVals[3] + ' ' + unit + '</span> &nbsp;\u00b7&nbsp; ' + sign + delta + ' ' + unit + ' &nbsp;\u00b7&nbsp; <span style="color:var(--text3)">' + parseFloat(reg.slope.toFixed(2)) + ' ' + unit + '/session</span>';
  }
}

async function generateNarrative() {
  if (!anData) { alert('Load analytics first'); return; }
  const btn = document.getElementById('narrative-btn');
  const box = document.getElementById('narrative-text');
  btn.disabled = true; btn.textContent = '...';
  box.style.color = 'var(--text3)';
  box.textContent = 'Generating...';
  const summary = {
    plateaus: anData.plateaus.filter(p => p.status !== 'progressing').map(p => ({ exercise: p.name, status: p.status, trend: p.slope+(p.isBW?' reps/sess':'kg/sess'), current: p.current+(p.isBW?'r':'kg') })),
    progressing: anData.plateaus.filter(p => p.status === 'progressing').slice(0,4).map(p => ({ exercise: p.name, trend: (p.slope>=0?'+':'')+p.slope+(p.isBW?' reps/sess':'kg/sess'), sessions: p.sessions })),
    fatigue: anData.fatigue.slice(0,5).map(f => ({ exercise: f.name, avgRepDrop: f.avgFatigue+'%', sessions: f.sessions })),
    shoulderImpact: anData.shoulder.slice(0,6).map(s => ({ exercise: s.name, shoulderSafe: s.shoulderSafe, deltaPct: (s.deltaPct>=0?'+':'')+s.deltaPct+'%', before: s.avgBefore, after: s.avgAfter })),
    topCorrelations: anData.correlations.slice(0,3).map(c => ({ pair: c.nameA+' x '+c.nameB, r: c.r, sharedSessions: c.n }))
  };
  const system = 'You are an elite strength coach for James Thornton.\\nPhase: Lean bulk Q2 2026, hypertrophy. Equipment: rings, kettlebells, parallettes, bands.\\nActive injury: right shoulder impingement since 2026-03-10.\\nWrite a data-driven coaching narrative in exactly 3 paragraphs, max 220 words.\\nPara 1: strongest progressors and 4-week trajectory.\\nPara 2: plateau/regression risks and specific programming interventions.\\nPara 3: shoulder impact findings and recovery implication for training design.\\nBe specific with numbers. Skip basics. James has elite fitness literacy.';
  try {
    const reply = await claude(system, [{ role: 'user', content: 'Training analytics:\\n' + JSON.stringify(summary, null, 2) }]);
    box.style.color = 'var(--text2)';
    box.textContent = reply;
  } catch(e) {
    box.style.color = 'var(--red)';
    box.textContent = 'Error: ' + e.message;
  }
  btn.disabled = false; btn.textContent = 'Refresh \u2192';
}

'''

boot = '// ── Boot ──────────────────────────────────────────────────────────────────────\ninit();'
if boot in src:
    src = src.replace(boot, analytics_js + boot, 1)
    print('JS injected.')
else:
    print('ERROR: boot line not found.')
    sys.exit(1)

with open(path, 'w') as f:
    f.write(src)

lines = src.count('\n') + 1
print(f'Done. {path} is now {lines} lines.')
