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

// KB progression ladder analysis. Standard bells step by 4kg (ALL_KB); this
// finds the INTERNAL gaps — consecutive owned bells that skip a rung, so the
// jump to the next owned bell is oversized — plus the next rung above the top.
// Drives next-weight and purchase advice; advisory only, never widens what is
// actually owned.
function kbLadderAnalysis(kbWeights) {
  const owned = [...new Set(kbWeights || [])].sort((a, b) => a - b);
  if (!owned.length) return { owned: [], gaps: [], nextUp: ALL_KB[0], heaviest: null, lightest: null };
  const lightest = owned[0], heaviest = owned[owned.length - 1];
  const gaps = [];
  for (let i = 0; i < owned.length - 1; i++) {
    const lo = owned[i], hi = owned[i + 1];
    const missing = ALL_KB.filter(r => r > lo && r < hi);
    if (missing.length) gaps.push({ from: lo, to: hi, missing, jumpKg: hi - lo, jumpPct: Math.round((hi - lo) / lo * 100) });
  }
  const nextUp = ALL_KB.find(r => r > heaviest) || null;
  return { owned, lightest, heaviest, gaps, nextUp };
}

// Double-KB load ladder. With singles only, a "heavier" double-KB set means a
// different PAIR — and pairs are neither evenly spaced nor interchangeable.
// Racking 20+32 is not 20+24 plus 8kg: the 12kg imbalance makes it a different
// movement. So every combo carries its imbalance and a balanced verdict, and
// progression steps along the BALANCED ladder rather than raw total load.
const KB_BALANCED_MAX_IMBALANCE = 4;

function kbComboLadder(owned, kbPairs) {
  const combos = [];
  if (kbPairs) {
    for (const w of owned) combos.push({ bells: `${w}+${w}`, total: w * 2, imbalance: 0 });
  }
  for (let i = 0; i < owned.length; i++) {
    for (let j = i + 1; j < owned.length; j++) {
      combos.push({ bells: `${owned[i]}+${owned[j]}`, total: owned[i] + owned[j], imbalance: owned[j] - owned[i] });
    }
  }
  combos.forEach(c => { c.balanced = c.imbalance <= KB_BALANCED_MAX_IMBALANCE; });
  combos.sort((a, b) => a.total - b.total || a.imbalance - b.imbalance);
  return combos;
}

// Which unowned bell would most improve the BALANCED double-KB ladder. This is
// the analysis the single-bell ladder misses: owning 16/20/24/32 yields balanced
// doubles at only 36kg and 44kg, so a double-KB lift that has outgrown 44kg has
// nowhere balanced left to go regardless of the single-bell gaps.
function kbPurchaseOptions(owned, kbPairs) {
  const currentSet = new Set(kbComboLadder(owned, kbPairs).filter(c => c.balanced).map(c => c.total));
  const options = [];
  for (const cand of ALL_KB) {
    if (owned.includes(cand)) continue;
    const after = kbComboLadder([...owned, cand].sort((a, b) => a - b), kbPairs).filter(c => c.balanced);
    const unlocks = after.filter(c => !currentSet.has(c.total));
    if (unlocks.length) options.push({ buy: cand, unlocks, after: after.map(c => c.total) });
  }
  options.sort((a, b) => b.unlocks.length - a.unlocks.length || a.buy - b.buy);
  return options;
}

// Equipment brief for the ADVISORY coach paths (daily card, Ask Gerald): the
// kit string plus the KB ladder so the coach can advise on next-weight jumps
// and which bell to buy next. buildKitString() stays the hard constraint the
// workout generator uses for exercise selection — this is the softer,
// purchase-aware layer on top of it.
function buildEquipmentBrief(l) {
  let s = buildKitString(l);
  const cfg = equipmentConfig[l] || DEFAULT_CONFIG[l] || {};
  const la = kbLadderAnalysis(cfg.kb_weights);
  if (!la.owned.length) return s;
  s += `\n\nKB LADDER (standard bells step by 4kg: ${ALL_KB.join('/')}kg). Owned at ${l}: ${la.owned.join('/')}kg (${la.lightest}–${la.heaviest}kg).`;
  if (la.gaps.length) {
    s += ' Internal gaps — the jump to the next owned bell is oversized here: '
      + la.gaps.map(g => `${g.from}→${g.to}kg is +${g.jumpKg}kg (+${g.jumpPct}%), skipping ${g.missing.join('/')}kg`).join('; ') + '.';
  }
  if (la.nextUp) s += ` Next rung above the top: ${la.nextUp}kg (not owned).`;

  const combos = kbComboLadder(la.owned, !!cfg.kb_pairs);
  const balanced = combos.filter(c => c.balanced);
  s += `\n\nDOUBLE KB LADDER (${cfg.kb_pairs ? 'matching pairs available' : 'singles only — every double-KB set is asymmetric'}). `
    + `All combos: ${combos.map(c => `${c.bells}=${c.total}kg (±${c.imbalance}kg)`).join(', ')}. `
    + `"Balanced" = the two bells differ by ≤${KB_BALANCED_MAX_IMBALANCE}kg. `
    + (balanced.length
        ? `Balanced ladder: ${balanced.map(c => `${c.bells}=${c.total}kg`).join(' → ')}. Ceiling ${balanced[balanced.length - 1].total}kg.`
        : 'No balanced combos exist with these bells.');
  s += ' A combo with a bigger total but a much bigger imbalance is a HARDER MOVEMENT, not a heavier one — on a racked lift (front squat, clean, press) reps will collapse. Step along the balanced ladder; once it runs out, progress with reps, tempo, pause or a unilateral variation.';

  const opts = kbPurchaseOptions(la.owned, !!cfg.kb_pairs);
  if (opts.length) {
    const best = opts[0];
    s += ` Best bell to buy for double-KB progression: ${best.buy}kg — unlocks ${best.unlocks.map(c => `${c.bells}=${c.total}kg (±${c.imbalance}kg)`).join(', ')}, extending the balanced ladder to ${best.after.join('/')}kg.`;
  }

  s += '\nPURCHASE / NEXT-WEIGHT GUIDANCE: when a KB lift is ready to progress but the next owned bell is a big jump (≥8kg or ≥25%), you may recommend buying the missing intermediate bell AND/OR prescribe a rep/tempo bridge on the current bell to close the gap. Always frame a bell to buy explicitly as a purchase suggestion — never imply it is already owned.';
  return s;
}

// Parallette height gate. The old inline checks tested for 'Parallettes (high)'
// and 'Parallettes (low)' but the exercises table only ever stores the bare
// string 'Parallettes', so both branches were unreachable and every parallette
// movement passed regardless of which pair is owned — the filter contradicted
// buildKitString()'s own "low only — do NOT prescribe parallette dips or L-sit"
// note. Tagging is minimum-requirement: '(high)' needs the tall pair (you must
// clear the floor), anything else tagged 'Parallettes' works on either height.
function parallettesOk(eq, cfg) {
  if (!eq.includes('Parallettes')) return true;
  if (eq.includes('Parallettes (high)')) return !!cfg.parallettes_high;
  return !!(cfg.parallettes_high || cfg.parallettes_low);
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
      if (!parallettesOk(eq, cfg)) return false;
      if (eq.includes('Band') && !cfg.bands) return false;
    }
    if (hasShoulderInjury() && !isTrue(e.shoulder_safe)) return false;
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
      if (!parallettesOk(eq, cfg)) return false;
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
