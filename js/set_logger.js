let slExIdx = 0, slDualMode = false, slKB1Idx = 0, slKB2Idx = 1, slSide = null, slIsPerArm = false;
let slVals = { weight: 0, reps: 10, rir: 2 };
let setsPerEx = {};

function getKBWeights() {
  return (equipmentConfig[loc] || DEFAULT_CONFIG[loc])?.kb_weights || [16,20,24,32,44];
}

function initSetLogger() {
  slExIdx = 0; setsPerEx = {};
  renderSetLogger();
}

function renderSetLogger() {
  if (!plan.length) return;
  const ex = plan[slExIdx];
  if (!ex) return;
  const sel = document.getElementById('sl-ex-select');
  if (sel) sel.innerHTML = plan.map((e,i) => `<option value="${i}" ${i===slExIdx?'selected':''}>${i+1}. ${e.display_name}</option>`).join('');
  const exId = (ex.exercise_id || ex.id || '').replace(/-/g, '_');
  slDualMode = DOUBLE_KB_IDS.includes(exId) || PER_ARM_IDS.includes(exId);
  slIsPerArm = PER_ARM_IDS.includes(exId);
  const exFull = exercises.find(e => e.id === exId || e.id === (ex.exercise_id || ex.id || '')) || {};
  slSide = (!slDualMode && exFull.bilateral === 0) ? 'L' : null;
  if (slDualMode) {
    const w = getKBWeights();
    const wStr = String(ex.weight || '');
    const m = wStr.match(/(\d+)\+(\d+)/);
    if (m) {
      const i1 = w.indexOf(parseInt(m[1])); const i2 = w.indexOf(parseInt(m[2]));
      slKB1Idx = i1 >= 0 ? i1 : 0;
      slKB2Idx = i2 >= 0 ? i2 : Math.min(1, w.length-1);
    } else { slKB1Idx = 0; slKB2Idx = Math.min(1, w.length-1); }
  } else {
    slVals.weight = parseFloat(ex.weight) || 0;
  }
  const rm = String(ex.reps || '10').match(/\d+/);
  slVals.reps = rm ? parseInt(rm[0]) : 10;
  slVals.rir = ex.rir ?? 2;
  renderFieldsUI();
  updateSetCounter();
}

function renderFieldsUI() {
  const fieldsEl = document.getElementById('sl-fields');
  const totalEl = document.getElementById('sl-total');
  if (!fieldsEl) return;
  if (slDualMode) {
    const w = getKBWeights();
    const kb1 = w[slKB1Idx] ?? w[0]; const kb2 = w[slKB2Idx] ?? w[1];
    const lbl1 = slIsPerArm ? 'LEFT' : 'KB 1';
    const lbl2 = slIsPerArm ? 'RIGHT' : 'KB 2';
    fieldsEl.innerHTML = `
      <div class="sl-field" style="flex:1"><div class="sl-field-lbl">${lbl1}</div><div class="sl-stepper"><button class="sl-btn" onclick="adjustKB(1,-1)">−</button><span class="sl-val" id="val-kb1">${kb1}</span><span class="sl-unit">kg</span><button class="sl-btn" onclick="adjustKB(1,1)">+</button></div></div>
      <div class="sl-field" style="flex:1"><div class="sl-field-lbl">${lbl2}</div><div class="sl-stepper"><button class="sl-btn" onclick="adjustKB(2,-1)">−</button><span class="sl-val" id="val-kb2">${kb2}</span><span class="sl-unit">kg</span><button class="sl-btn" onclick="adjustKB(2,1)">+</button></div></div>
      <div class="sl-field" style="flex:0.8"><div class="sl-field-lbl">REPS</div><div class="sl-stepper"><button class="sl-btn" onclick="adjustVal('reps',-1)">−</button><span class="sl-val" id="val-reps">${slVals.reps}</span><button class="sl-btn" onclick="adjustVal('reps',1)">+</button></div></div>
      <div class="sl-field" style="flex:0.8"><div class="sl-field-lbl">RESERVE</div><div class="sl-stepper"><button class="sl-btn" onclick="adjustVal('rir',-1)">−</button><span class="sl-val" id="val-rir">${slVals.rir}</span><button class="sl-btn" onclick="adjustVal('rir',1)">+</button></div></div>`;
    if (totalEl) { totalEl.style.display='block'; totalEl.textContent=`Total: ${kb1+kb2}kg (${kb1}+${kb2})`; }
  } else {
    const wD = slVals.weight===0?'BW':slVals.weight; const wU = slVals.weight===0?'':'kg';
    const sideBtn = slSide ? `<div class="sl-field" style="flex:0.6"><div class="sl-field-lbl">SIDE</div><div class="sl-stepper"><button class="sl-btn" onclick="toggleSide()" style="min-width:36px;font-size:14px;">${slSide}</button></div></div>` : '';
    fieldsEl.innerHTML = `
      ${sideBtn}
      <div class="sl-field"><div class="sl-field-lbl">WEIGHT</div><div class="sl-stepper"><button class="sl-btn" onclick="adjustVal('weight',-2)">−</button><span class="sl-val" id="val-weight">${wD}</span><span class="sl-unit">${wU}</span><button class="sl-btn" onclick="adjustVal('weight',2)">+</button></div></div>
      <div class="sl-field"><div class="sl-field-lbl">REPS</div><div class="sl-stepper"><button class="sl-btn" onclick="adjustVal('reps',-1)">−</button><span class="sl-val" id="val-reps">${slVals.reps}</span><button class="sl-btn" onclick="adjustVal('reps',1)">+</button></div></div>
      <div class="sl-field"><div class="sl-field-lbl">RESERVE</div><div class="sl-stepper"><button class="sl-btn" onclick="adjustVal('rir',-1)">−</button><span class="sl-val" id="val-rir">${slVals.rir}</span><button class="sl-btn" onclick="adjustVal('rir',1)">+</button></div></div>`;
    if (totalEl) totalEl.style.display='none';
  }
}

function updateSetCounter() {
  const ex = plan[slExIdx]; if (!ex) return;
  const el = document.getElementById('sl-counter');
  if (!el) return;
  const done = setsPerEx[ex.exercise_id] || 0;
  const goal = ex.reps ? ` · ${ex.reps} reps @ RIR ${ex.rir ?? 2}` : '';
  if (slSide !== null) {
    const round = Math.floor(done / 2) + 1;
    const sideLabel = slSide === 'L' ? 'LEFT' : 'RIGHT';
    el.textContent = `Round ${round} of ${ex.sets||4} — ${sideLabel}${goal}`;
  } else {
    el.textContent = `Set ${done + 1} of ${ex.sets||4}${goal}`;
  }
}

function onExSelect() {
  const sel = document.getElementById('sl-ex-select'); if (!sel) return;
  slExIdx = parseInt(sel.value); renderSetLogger();
}

function toggleSide() {
  slSide = slSide === 'L' ? 'R' : 'L';
  renderFieldsUI();
}

function skipExercise() {
  const ex = plan[slExIdx];
  if (!ex) return;
  addMsg('you', `Skipped: ${ex.display_name}`);
  if (slExIdx < plan.length - 1) {
    slExIdx++;
    renderSetLogger();
    addMsg('coach', `${ex.display_name} skipped. Moving to ${plan[slExIdx].display_name}.`);
  } else {
    addMsg('coach', `${ex.display_name} skipped. All exercises covered — type 'done' for debrief.`);
  }
}

function adjustVal(field, delta) {
  if (field==='weight') slVals.weight = Math.max(0, slVals.weight+delta);
  else if (field==='reps') slVals.reps = Math.max(1, slVals.reps+delta);
  else if (field==='rir') slVals.rir = Math.max(0, Math.min(5, slVals.rir+delta));
  const ids = {weight:'val-weight', reps:'val-reps', rir:'val-rir'};
  const el = document.getElementById(ids[field]);
  if (el) el.textContent = field==='weight' ? (slVals.weight===0?'BW':slVals.weight) : slVals[field];
}

function adjustKB(which, delta) {
  const w = getKBWeights();
  if (which===1) { slKB1Idx=Math.max(0,Math.min(w.length-1,slKB1Idx+delta)); const el=document.getElementById('val-kb1'); if(el)el.textContent=w[slKB1Idx]; }
  else { slKB2Idx=Math.max(0,Math.min(w.length-1,slKB2Idx+delta)); const el=document.getElementById('val-kb2'); if(el)el.textContent=w[slKB2Idx]; }
  const totalEl=document.getElementById('sl-total');
  if(totalEl){ const kb1=w[slKB1Idx],kb2=w[slKB2Idx]; totalEl.textContent=`Total: ${kb1+kb2}kg (${kb1}+${kb2})`; }
}

async function logSet() {
  const ex = plan[slExIdx]; if (!ex) return;
  if (!setsPerEx[ex.exercise_id]) setsPerEx[ex.exercise_id]=0;
  setsPerEx[ex.exercise_id]++;
  const setNum = setsPerEx[ex.exercise_id];
  const isUnilateral = slSide !== null;
  const justLoggedSide = slSide;
  let weightKg, weightLabel, setNotes='';
  if (slDualMode) {
    const w=getKBWeights(); const kb1=w[slKB1Idx]??0; const kb2=w[slKB2Idx]??0;
    weightKg=kb1+kb2; weightLabel=kb1+'+'+kb2+'kg'; setNotes=kb1+'+'+kb2+'kg';
  } else {
    weightKg=slVals.weight; weightLabel=slVals.weight===0?'BW':slVals.weight+'kg';
  }
  const setData = { session_id:sessionId, exercise_id:(ex.exercise_id||ex.id||'').replace(/-/g,'_'), set_num:setNum, reps:slVals.reps, weight_kg:weightKg, rir:slVals.rir, tempo:ex.tempo||'', notes: (slSide ? slSide + ' side' + (setNotes ? ' · '+setNotes : '') : setNotes) };

  const tempoMatch = (ex.tempo||'').match(/(\d+)-(\d+)-(\d+)-(\d+)/);
  if (tempoMatch) {
    const totalTempo = tempoMatch.slice(1).reduce((s,n) => s + parseInt(n), 0);
    setData.tut_seconds = totalTempo * slVals.reps;
  }
  if (lastRestDuration !== null) { setData.rest_seconds = lastRestDuration; lastRestDuration = null; }
  loggedSets.push(setData);
  apiPost({ action:'appendSet', data:setData })
    .then(r => {
      if (!r.ok) {
        console.error('appendSet failed:', r, setData);
        showToast('Set not saved — check connection', 'error');
      }
    })
    .catch(e => {
      console.error('appendSet error:', e, setData);
      showToast('Set not saved — ' + e.message, 'error');
    });
  if (!isUnilateral || justLoggedSide === 'R') startRestTimer();
  updateProgress();
  const logger = document.getElementById('set-logger');
  if (logger) { logger.classList.add('set-flash'); setTimeout(() => logger.classList.remove('set-flash'), 600); }
  if (slSide) { slSide = slSide === 'L' ? 'R' : 'L'; renderFieldsUI(); }
  const plannedSets = ex.sets||4;
  const targetLogs = isUnilateral ? plannedSets * 2 : plannedSets;
  const msg = isUnilateral
    ? `${ex.display_name} — Round ${Math.ceil(setNum/2)} of ${plannedSets} (${justLoggedSide}): ${slVals.reps} reps @ ${weightLabel} | RIR ${slVals.rir}`
    : `${ex.display_name} — Set ${setNum}: ${slVals.reps} reps @ ${weightLabel} | RIR ${slVals.rir}`;
  addMsg('you', msg);
  if (setNum >= targetLogs) {
    if (slExIdx < plan.length-1) { slExIdx++; renderSetLogger(); await getCoachReply(msg+'\n\nAll sets done. Moving to next exercise.'); }
    else { updateSetCounter(); await getCoachReply(msg+'\n\nAll sets complete.'); }
  } else { updateSetCounter(); await getCoachReply(msg); }
}

function endSession() {
  releaseWakeLock();
  const exDone = new Set(loggedSets.map(s=>s.exercise_id)).size;
  const totalSets = loggedSets.length;
  const statsEl = document.getElementById('modal-stats');
  if (statsEl) statsEl.textContent = totalSets>0
    ? `${totalSets} set${totalSets!==1?'s':''} logged across ${exDone} exercise${exDone!==1?'s':''}. Session will be saved without RPE.`
    : 'No sets logged yet. Discarding will remove the session record.';
  document.getElementById('end-modal').style.display='flex';
}

function closeEndModal() {
  document.getElementById('end-modal').style.display='none';
  _resetDiscardBtn();
}

let _discardPending = false;
let _discardTimer = null;

function _resetDiscardBtn() {
  _discardPending = false;
  clearTimeout(_discardTimer);
  const btn = document.getElementById('discard-btn');
  if (btn) { btn.textContent = 'Discard — delete all data'; btn.style.opacity = '1'; }
}

async function discardAndDelete() {
  if (!_discardPending) {
    _discardPending = true;
    const btn = document.getElementById('discard-btn');
    if (btn) { btn.textContent = 'Tap again to confirm delete'; btn.style.opacity = '0.7'; }
    _discardTimer = setTimeout(_resetDiscardBtn, 3000);
    return;
  }
  _resetDiscardBtn();
  closeEndModal();
  if (sessionId) await apiPost({ action:'deleteSession', session_id:sessionId });
  loggedSets=[]; sessionId=''; stopAllTimers(); goScreen('s-idle');
  document.getElementById('status').textContent='Session discarded';
}
