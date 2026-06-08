function showInjuryModal() {
  renderInjuryList();
  document.getElementById('inj-modal').style.display='flex';
}

function closeInjuryModal() { document.getElementById('inj-modal').style.display='none'; }

function renderInjuryList() {
  const list = document.getElementById('inj-list');
  if (!list) return;
  if (!injuries.length) { list.innerHTML='<div style="color:var(--text3);font-size:12px;">No active injuries.</div>'; return; }
  list.innerHTML = injuries.map((inj,i) =>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:12px;color:var(--text)">${inj.body_part}</span>
      <button onclick="resolveInjury(${inj.id})" style="font-family:var(--font);font-size:10px;color:var(--text2);background:none;border:1px solid var(--border2);border-radius:4px;padding:2px 8px;cursor:pointer;">Resolve</button>
    </div>`
  ).join('');
}

async function resolveInjury(id) {
  await apiPost({ action:'updateInjury', id, active: 0 });
  injuries = injuries.filter(i => i.id !== id);
  renderInjuryList();
  const b = document.getElementById('inj-banner');
  if (!injuries.length) b.style.display='none';
  else b.textContent = '⚠ Active: ' + injuries.map(i=>i.body_part).join(', ') + ' — exercises filtered';
}

async function addInjury() {
  const body = document.getElementById('inj-body').value.trim();
  const restrict = document.getElementById('inj-restrict').value.trim();
  if (!body) return;
  const r = await apiPost({ action:'addInjury', body_part: body, restrictions: restrict });
  if (r.ok) {
    injuries.push({ id: r.id, body_part: body, restrictions: restrict, active: 1 });
    document.getElementById('inj-body').value='';
    document.getElementById('inj-restrict').value='';
    renderInjuryList();
    const b = document.getElementById('inj-banner');
    b.style.display='block';
    b.textContent = '⚠ Active: ' + injuries.map(i=>i.body_part).join(', ') + ' — exercises filtered';
  }
}
