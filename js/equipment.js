let equipmentConfig = {};
const ALL_KB = [8,12,16,20,24,28,32,36,40,44,48];
const DEFAULT_CONFIG = {
  Home:   { rings:true,  pull_up_bar:true,  parallettes_high:false, parallettes_low:false, bands:true,  kb_weights:[16,20,24,32], kb_pairs:false, barbell:false, dumbbells:false, cable_machine:false },
  Travel: { rings:false, pull_up_bar:false, parallettes_high:false, parallettes_low:false, bands:true,  kb_weights:[],            kb_pairs:false, barbell:false, dumbbells:false, cable_machine:false },
  Gym:    { rings:false, pull_up_bar:true,  parallettes_high:false, parallettes_low:false, bands:true,  kb_weights:[8,12,16,20,24,28,32,36,40,44,48], kb_pairs:true, barbell:true, dumbbells:true, cable_machine:true }
};
// Set-logger UI mode now comes from exercises.logging_mode (DB) with an optional
// per-plan override — see set_logger.js renderSetLogger() and applyCoachAdjustment().
// The former DOUBLE_KB_IDS / PER_ARM_IDS hardcoded arrays were removed.

let equipLoc = 'Home';

function buildKitString(l) {
  const cfg = equipmentConfig[l] || DEFAULT_CONFIG[l] || {};
  const parts = [];
  if (cfg.rings)        parts.push('Gymnastics rings');
  if (cfg.pull_up_bar)  parts.push('Pull-up bar');
  if (cfg.parallettes_high) parts.push('Parallettes (high — dips, L-sit, support hold)');
  if (cfg.parallettes_low)  parts.push('Parallettes (low — push-ups, planche progressions)');
  if (cfg.parallettes_high && !cfg.parallettes_low) parts.push('NOTE: High parallettes only — do NOT prescribe parallette push-ups');
  if (cfg.parallettes_low && !cfg.parallettes_high) parts.push('NOTE: Low parallettes only — do NOT prescribe parallette dips or L-sit');
  if (cfg.bands)        parts.push('Resistance bands');
  if (cfg.kb_weights && cfg.kb_weights.length) {
    const w = cfg.kb_weights;
    if (cfg.kb_pairs) {
      parts.push('KB (' + w.join('/') + 'kg, matching pairs available)');
    } else {
      const combos = [];
      for (let i = 0; i < w.length; i++)
        for (let j = i + 1; j < w.length; j++)
          combos.push(w[i] + '+' + w[j] + '=' + (w[i]+w[j]) + 'kg');
      parts.push('KB singles (' + w.join('/') + 'kg). Double KB = asymmetric loads only. Available double KB combos (total load): ' + combos.join(', ') + '. IMPORTANT: when prescribing double KB exercises you MUST specify both individual bells in the weight field e.g. "20+24kg" — never just the total. Pick the combination from the available combos list above.');
    }
  }
  if (cfg.barbell)       parts.push('Barbell + squat rack');
  if (cfg.dumbbells)     parts.push('Full dumbbell rack');
  if (cfg.cable_machine) parts.push('Cable machine');
  parts.push('Bodyweight');
  return parts.join(', ') || 'Bodyweight only';
}

function filterExercises(exList, l, sType) {
  const cfg = equipmentConfig[l] || DEFAULT_CONFIG[l] || {};
  return exList.filter(e => {
    if (e.session_type && sType !== "Coach's Workout") {
      const tags = e.session_type.split(';').map(t => t.trim());
      if (!tags.includes(sType)) return false;
    }
    const eq = e.equipment || '';
    if (l === 'Travel') {
      const ok = (eq === 'BW' || eq === 'Bodyweight')
        || (eq.includes('Band') && cfg.bands)
        || (eq.includes('Rings') && cfg.rings)
        || (eq.includes('KB') && cfg.kb_weights && cfg.kb_weights.length > 0);
      if (!ok) return false;
    } else if (l === 'Home') {
      if (!isTrue(e.home_available)) return false;
      if (eq.includes('Rings') && !cfg.rings) return false;
      if (eq.includes('Parallettes') && !cfg.parallettes_high && !cfg.parallettes_low) return false;
      if (eq.includes('Parallettes (high)') && !cfg.parallettes_high) return false;
      if (eq.includes('Parallettes (low)') && !cfg.parallettes_low) return false;
      if (eq.includes('Band') && !cfg.bands) return false;
    }
    if (injuries.length && !isTrue(e.shoulder_safe)) return false;
    return true;
  });
}

function filterByEquipmentOnly(exList, l) {
  const cfg = equipmentConfig[l] || DEFAULT_CONFIG[l] || {};
  return exList.filter(e => {
    const eq = e.equipment || '';
    if (l === 'Travel') {
      return (eq === 'BW' || eq === 'Bodyweight')
        || (eq.includes('Band') && cfg.bands)
        || (eq.includes('Rings') && cfg.rings)
        || (eq.includes('KB') && cfg.kb_weights && cfg.kb_weights.length > 0);
    }
    if (l === 'Home') {
      if (!isTrue(e.home_available)) return false;
      if (eq.includes('Rings') && !cfg.rings) return false;
      if (eq.includes('Parallettes') && !cfg.parallettes_high && !cfg.parallettes_low) return false;
      if (eq.includes('Parallettes (high)') && !cfg.parallettes_high) return false;
      if (eq.includes('Parallettes (low)') && !cfg.parallettes_low) return false;
      if (eq.includes('Band') && !cfg.bands) return false;
    }
    // Gym: all exercises pass as long as equipment exists (barbell/DB/cable checked implicitly via kit string)
    return true;
  });
}

function selectEquipLoc(l) {
  equipLoc = l;
  document.querySelectorAll('.eq-loc-tab').forEach(t => t.classList.remove('active'));
  const tab = document.getElementById('eqtab-' + l);
  if (tab) tab.classList.add('active');
  renderEquipConfig(l);
}

function renderEquipConfig(l) {
  const cfg = { ...(DEFAULT_CONFIG[l] || {}), ...(equipmentConfig[l] || {}) };
  const body = document.getElementById('eq-config-body');
  if (!body) return;
  const togRow = (key, label, sublabel, checked) => `
    <div class="eq-row">
      <div><div class="eq-label">${label}</div>${sublabel ? '<div class="eq-sublabel">' + sublabel + '</div>' : ''}</div>
      <label class="tog"><input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleEquip('${l}','${key}',this.checked)"><span class="tog-slider"></span></label>
    </div>`;
  let html = '<div class="eq-section-lbl">KETTLEBELLS</div>';
  html += '<div style="font-size:11px;color:var(--text2);margin-bottom:6px">Tap to toggle available weights</div>';
  html += '<div class="kb-grid">';
  ALL_KB.forEach(w => {
    const on = (cfg.kb_weights || []).includes(w);
    html += `<button class="kb-pill ${on ? 'on' : ''}" id="kb-${l}-${w}" onclick="toggleKBWeight('${l}',${w})">${w}kg</button>`;
  });
  html += '</div>';
  html += togRow('kb_pairs', 'Matching pairs', 'Have 2× of each weight?', cfg.kb_pairs);
  html += '<div class="eq-section-lbl">RINGS & BARS</div>';
  html += togRow('rings', 'Gymnastics rings', '', cfg.rings);
  html += togRow('pull_up_bar', 'Pull-up bar', '', cfg.pull_up_bar);
  html += '<div class="eq-section-lbl">ACCESSORIES</div>';
  html += togRow('parallettes_high', 'Parallettes (high)', 'Dips · L-sit · support hold', cfg.parallettes_high);
  html += togRow('parallettes_low',  'Parallettes (low)',  'Push-ups · planche progressions', cfg.parallettes_low);
  html += togRow('bands', 'Resistance bands', '', cfg.bands);
  if (l === 'Gym') {
    html += '<div class="eq-section-lbl">GYM EQUIPMENT</div>';
    html += togRow('barbell', 'Barbell + squat rack', '', cfg.barbell);
    html += togRow('dumbbells', 'Dumbbells (full rack)', '', cfg.dumbbells);
    html += togRow('cable_machine', 'Cable machine', '', cfg.cable_machine);
  }
  body.innerHTML = html;
}

function toggleEquip(l, key, val) {
  if (!equipmentConfig[l]) equipmentConfig[l] = {...DEFAULT_CONFIG[l]};
  equipmentConfig[l][key] = val;
}

function toggleKBWeight(l, weight) {
  if (!equipmentConfig[l]) equipmentConfig[l] = {...DEFAULT_CONFIG[l]};
  const w = equipmentConfig[l].kb_weights || [];
  const idx = w.indexOf(weight);
  if (idx >= 0) w.splice(idx, 1); else w.push(weight);
  w.sort((a,b) => a-b);
  equipmentConfig[l].kb_weights = w;
  const pill = document.getElementById('kb-' + l + '-' + weight);
  if (pill) pill.classList.toggle('on', idx < 0);
}

async function saveEquipConfig() {
  try {
    await Promise.all(Object.entries(equipmentConfig).map(([location, config]) =>
      apiPost({ action: 'saveEquipmentConfig', location, config })
    ));
    goScreen('s-idle');
    document.getElementById('status').textContent = 'Equipment saved ✓';
  } catch(e) { alert('Save failed: ' + e.message); }
}
