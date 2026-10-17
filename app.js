import * as S from './store.js';

const KEY = 'tracker-v1';
let state = (() => { try { return S.normalize(JSON.parse(localStorage.getItem(KEY))); } catch { return S.emptyState(); } })();
let current = null, period = '7d', editing = null, toastTimer;
const $ = id => document.getElementById(id);
const esc = t => t.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const set = s => { state = s; save(); render(); };

function render() {
  $('main').hidden = !!current; $('detail').hidden = !current;
  if (!current) {
    $('buttons').innerHTML = state.buttons.length ? state.buttons.map(b => `
      <div class="row" data-id="${b.id}">
        <span class="handle" aria-label="Verschieben">≡</span>
        <button class="track" data-track="${b.id}">${esc(b.name)}</button>
        <button class="list" data-open="${b.id}" aria-label="Liste ${esc(b.name)}">Liste ›</button>
      </div>`).join('') : '<p class="hint">Noch keine Buttons. Lege unten deinen ersten an.</p>';
    return;
  }
  const b = state.buttons.find(x => x.id === current);
  if (!b) { current = null; return render(); }
  const list = S.entriesFor(state, b.id, period), withTime = state.settings.showTime;
  $('title').textContent = b.name;
  $('showtime').checked = withTime;
  $('filters').innerHTML = Object.entries(S.PERIODS).map(([k, v]) =>
    `<button data-period="${k}" class="${k === period ? 'on' : ''}">${v}</button>`).join('');
  $('count').textContent = `${list.length} ${list.length === 1 ? 'Eintrag' : 'Einträge'}`;
  $('entries').innerHTML = list.map(e => `<li><button data-edit="${e.id}">
      <span>${S.formatDate(e.ts, withTime)}</span>${e.note ? `<small>${esc(e.note)}</small>` : ''}<i>›</i></button></li>`).join('')
    || '<li class="hint">Keine Einträge in diesem Zeitraum.</li>';
}

function toast(text, id) {
  $('toast-text').textContent = text;
  $('undo').onclick = () => { set(S.removeEntry(state, id)); $('toast').hidden = true; };
  $('note-now').onclick = () => { $('toast').hidden = true; openEdit(id); };
  $('toast').hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 5000);
}

function openEdit(id) {
  const e = state.entries.find(x => x.id === id); if (!e) return;
  editing = id;
  $('edit-ts').value = S.toInputValue(e.ts);
  $('edit-note').value = e.note;
  $('editor').showModal();
}

document.addEventListener('click', ev => {
  const t = ev.target.closest('button'); if (!t) return;
  const d = t.dataset;
  if (d.track && $('main').classList.contains('editing')) return;  // im Bearbeiten-Modus nichts speichern
  if (d.track) {
    const id = Math.random().toString(36).slice(2), ts = Date.now();
    set(S.addEntry(state, d.track, ts, id));
    t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash');
    navigator.vibrate?.(30);
    toast(`Gespeichert ${S.formatTime(ts)}`, id);
  } else if (d.open) { current = d.open; period = '7d'; render(); scrollTo(0, 0); }
  else if (d.period) { period = d.period; render(); }
  else if (d.edit) openEdit(d.edit);
  else if (t.id === 'editmode') t.textContent = $('main').classList.toggle('editing') ? 'Fertig' : 'Bearbeiten';
  else if (t.id === 'back') { current = null; render(); }
  else if (t.id === 'edit-delete') {
    if (confirm('Diesen Eintrag löschen?')) { set(S.removeEntry(state, editing)); $('editor').close(); }
  } else if (t.id === 'remove') {
    const b = state.buttons.find(x => x.id === current);
    if (confirm(`Button „${b.name}“ löschen?`) && confirm('Möchten Sie den Button inkl. aller Einträge löschen?')) {
      current = null; set(S.removeButton(state, b.id));
    }
  }
});

$('editor').addEventListener('close', () => {
  if ($('editor').returnValue === 'save' && state.entries.some(e => e.id === editing))
    set(S.updateEntry(state, editing, { ts: S.fromInputValue($('edit-ts').value), note: $('edit-note').value }));
  $('editor').returnValue = '';
});

// Buttons per Griff (≡) verschieben – Pointer Events, funktioniert mit Finger und Maus.
let drag = null;
$('buttons').addEventListener('pointerdown', ev => {
  const h = ev.target.closest('.handle'); if (!h) return;
  ev.preventDefault();
  const rows = [...$('buttons').children], row = h.parentElement, from = rows.indexOf(row);
  drag = { row, rows, from, to: from, y: ev.clientY, step: rows[1] ? rows[1].offsetTop - rows[0].offsetTop : 0,
    mids: rows.map(r => r.offsetTop + r.offsetHeight / 2) };
  h.setPointerCapture(ev.pointerId); row.classList.add('dragging');
});
$('buttons').addEventListener('pointermove', ev => {
  if (!drag) return;
  const dy = ev.clientY - drag.y, c = drag.mids[drag.from] + dy;
  drag.row.style.transform = `translateY(${dy}px)`;
  drag.to = drag.mids.filter((m, i) => i !== drag.from && m < c).length;
  drag.rows.forEach((r, i) => {
    const shift = i > drag.from && i <= drag.to ? -1 : i < drag.from && i >= drag.to ? 1 : 0;
    if (r !== drag.row) r.style.transform = shift ? `translateY(${shift * drag.step}px)` : '';
  });
});
const drop = () => { if (!drag) return; const { row, to } = drag; drag = null; set(S.moveButton(state, row.dataset.id, to)); };
$('buttons').addEventListener('pointerup', drop);
$('buttons').addEventListener('pointercancel', drop);

$('showtime').addEventListener('change', ev => set(S.setSetting(state, 'showTime', ev.target.checked)));

$('add').addEventListener('submit', ev => {
  ev.preventDefault();
  const name = $('name').value.trim(); if (!name) return;
  set(S.addButton(state, name)); $('name').value = '';
});

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
