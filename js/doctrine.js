// ──────────────────────────────────────────────────────────────────────────
// Shared coaching constants + stimulus helpers.
// Loaded BEFORE every screen module (see jt_train.html), so these top-level
// consts/functions are visible to coach.js, session.js, progress.js, etc.
// worker.js is a separate runtime and keeps its own copies — keep them in sync.
// ──────────────────────────────────────────────────────────────────────────

const TRAINING_PHASE = 'Lean bulk Q2 2026. Hypertrophy focus.';

const GERALD_PERSONA = `You are Gerald — a training partner who knows James's history better than he does. You've watched every session, every set, every stall and every breakthrough. You talk like someone who trains alongside him: straight, familiar, no performance. You don't motivate, you observe and advise. You know he has maybe 45 minutes before life intervenes — so you don't waste his time.

Rules: lead with the insight, not the preamble — never say "Great question" or "Based on your data". Use numbers, not vibes. If something looks off, say it plainly. Dry humour is fine. Motivation-poster energy is not.`;

// Evidence base for James's rings + KB + calisthenics + parallettes stack.
// Reference context for the model's judgement — NOT something to recite at him.
const MODALITY_DOCTRINE = `EVIDENCE-BASED MODALITY CONTEXT (reference for judgement — apply where relevant, never recite papers verbatim or lecture):
James trains rings + kettlebells + calisthenics + parallettes. This stack is evidence-supported on its own terms — not a compromise for lacking a barbell:
- PROXIMITY TO FAILURE IS THE STIMULUS: Low-load and bodyweight training drive hypertrophy comparable to heavy-load training when sets are taken close to failure (Sports Medicine 2022 meta-analysis; push-up vs bench-press trials show comparable chest/triceps growth at matched effort). The decisive variable is RIR, not the implement or the kg. Judge a set by how close it ran to failure, not by tonnage.
- LONGEVITY: Large 30-year cohorts (BJSM 2026, n≈147k; BMJ Medicine 2026, n≈111k) link resistance training and calisthenics to lower all-cause mortality, with calisthenics measured comparably to weight training. Roughly 90–120 min/week of resistance work is the all-cause-mortality sweet spot; past ~120 min/week there is little added all-cause benefit, so pivot to quality and intensity rather than piling on volume. Variety across modalities is itself an independent longevity lever. (These cohorts did not all isolate calisthenics cleanly — treat the modality-specific figures as directional, not precise, and don't overstate a "ranking" between modalities.)
- STRENGTH → LONGEVITY: Greater muscular strength is inversely associated with mortality across populations and is highly trainable at any age. Getting stronger on the rings and bells is a direct longevity investment, not just an aesthetic one.
- KETTLEBELLS FILL THE LOWER-BODY GAP: KB training builds muscle, grip and lower-limb strength and lowers systemic inflammation markers (12-month trial in older adults). Bodyweight lower-body work drifts into cardio at high reps, so KB hinge/squat loading (swings, deadlifts, goblet/front squats) is the most evidence-critical slot in the week — it covers the lower-body hypertrophy that calisthenics leaves open.
PRACTICAL IMPLICATION: prize proximity to failure and consistency over raw tonnage; protect recovery rather than chasing minutes past the weekly sweet spot; keep modality variety high; treat KB lower-body loading as non-negotiable.`;

// How to progress work that has no load increment.
const BW_PROGRESSION_RULE = `BODYWEIGHT PROGRESSION: pure calisthenics has no "+weight" lever — progress it by harder leverage (e.g. ring push-up → RTO → archer → one-arm), slower tempo / longer eccentric, added pause, or unilateral variation. Add external load (vest/belt, KB) only where the movement allows it. For KB and weighted work, progress by load or reps per the RIR protocol.`;

// Classify an exercise's modality from its equipment tag. KB is the only
// "loaded" implement in James's stack; everything else (Rings/BW/Parallettes/
// Bands) is calisthenics.
function trainingModality(equipment) {
  return String(equipment || '').toUpperCase() === 'KB' ? 'kb' : 'calisthenics';
}

// Effective load on a set, in kg — the "weight lever":
//   external weight_kg + (bw_load_factor × current bodyweight).
// A pull-up at 82 kg BW is ~82 kg, not 0; a harder variation has a higher
// factor, so progression shows up as load. Falls back to external load only
// when bodyweight is unknown.
function effectiveLoadKg(set, exercise, bodyweightKg) {
  // Server-computed per-set value already uses the bodyweight on the set's date.
  if (set.effective_load_kg != null) return Number(set.effective_load_kg);
  const external = parseFloat(set.weight_kg) || 0;
  const factor = exercise && exercise.bw_load_factor != null ? Number(exercise.bw_load_factor) : 0;
  const bw = parseFloat(bodyweightKg) || 0;
  return external + factor * bw;
}

// Bodyweight-aware stimulus summary. Headline signal is hard sets (RIR ≤ 2) per
// movement pattern, split by modality — because for a rings/calisthenics athlete
// raw kg tonnage under-counts half the work. With a known bodyweight it ALSO
// reports effective-load tonnage (the weight lever), which finally counts
// calisthenics. `sets` need {exercise_id, reps, weight_kg, rir}; `exerciseList`
// is the exercises library (id, movement_pattern, equipment, bw_load_factor).
function summariseStimulus(sets, exerciseList, bodyweightKg) {
  const exById = {};
  (exerciseList || []).forEach(e => { exById[e.id] = e; });
  const pattern = {};
  let calSets = 0, kbSets = 0, hardSets = 0, bwSets = 0, loadedSets = 0, effTonnage = 0;
  (sets || []).forEach(s => {
    const ex = exById[s.exercise_id] || {};
    const pat = ex.movement_pattern || ex.category || 'other';
    const mod = trainingModality(ex.equipment);
    const rir = s.rir == null ? null : Number(s.rir);
    const isHard = rir != null && rir <= 2;
    pattern[pat] = pattern[pat] || { sets: 0, hard: 0, cal: 0, kb: 0 };
    pattern[pat].sets++;
    if (isHard) { pattern[pat].hard++; hardSets++; }
    if (mod === 'kb') { pattern[pat].kb++; kbSets++; } else { pattern[pat].cal++; calSets++; }
    if (!s.weight_kg || parseFloat(s.weight_kg) === 0) bwSets++; else loadedSets++;
    effTonnage += (parseInt(s.reps) || 0) * effectiveLoadKg(s, ex, bodyweightKg);
  });
  const total = (sets || []).length;
  const patternLines = Object.entries(pattern)
    .sort((a, b) => b[1].sets - a[1].sets)
    .map(([p, v]) => `- ${p}: ${v.sets} sets (${v.hard} hard @RIR≤2 · ${v.cal} calisthenics / ${v.kb} KB)`)
    .join('\n');
  const tonnageLine = bodyweightKg
    ? `\nEffective-load tonnage (BW-adjusted, the real load incl. bodyweight): ${Math.round(effTonnage)} kg·reps`
    : '';
  return `STIMULUS SIGNAL (proximity to failure is the stimulus — reason from hard sets per pattern first; effective-load tonnage already folds in bodyweight, so do NOT fall back to raw kg):
Totals: ${total} sets · ${hardSets} hard (RIR≤2) · ${calSets} calisthenics / ${kbSets} KB · ${bwSets} bodyweight / ${loadedSets} loaded${tonnageLine}
Per pattern:
${patternLines || '- none logged'}`;
}

// Latest logged bodyweight (kg) from a getBodyMetrics result (DESC by date).
function latestBodyweight(metrics) {
  const m = (metrics || []).find(x => x.weight_kg != null);
  return m ? Number(m.weight_kg) : null;
}

// Lean-bulk trend block for prompts: current weight/bodyfat plus 6-week rate of
// change vs the ~0.25–0.5 kg/week lean-gain target. Pairs the longevity/lean-bulk
// doctrine with real numbers. `metrics` is getBodyMetrics data (DESC by date).
function bodyweightContext(metrics) {
  const rows = (metrics || []).filter(m => m.weight_kg != null);
  if (!rows.length) return 'BODYWEIGHT: no weigh-ins logged yet — prompt James to log one for lean-bulk and effective-load tracking.';
  const latest = rows[0];
  const cutoff = new Date(Date.now() - 42 * 86400000).toISOString().slice(0, 10);
  const old = rows.find(m => m.date <= cutoff) || rows[rows.length - 1];
  const days = Math.max(1, (new Date(latest.date) - new Date(old.date)) / 86400000);
  const perWeek = ((latest.weight_kg - old.weight_kg) / days) * 7;
  const bf = latest.bodyfat_pct != null ? `, ${latest.bodyfat_pct}% bodyfat` : '';
  let verdict = '';
  if (days >= 14) {
    if (perWeek > 0.55) verdict = ' — gaining fast; risk is fat, not muscle. Hold intake, push training intensity.';
    else if (perWeek >= 0.2) verdict = ' — in the lean-gain band (~0.25–0.5 kg/wk). On track.';
    else if (perWeek >= -0.1) verdict = ' — essentially flat; for a lean bulk nudge intake up slightly.';
    else verdict = ' — losing weight; not a bulk. Check intake against goal.';
  }
  return `BODYWEIGHT: ${latest.weight_kg} kg${bf} (as of ${latest.date}). ~${perWeek >= 0 ? '+' : ''}${perWeek.toFixed(2)} kg/week over the last ${Math.round(days)}d${verdict}`;
}
