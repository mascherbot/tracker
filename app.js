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
      <div class="row">
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
  if (d.track) {
    const id = Math.random().toString(36).slice(2), ts = Date.now();
    set(S.addEntry(state, d.track, ts, id));
    t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash');
    navigator.vibrate?.(30);
    toast(`Gespeichert ${S.formatTime(ts)}`, id);
  } else if (d.open) { current = d.open; period = '7d'; render(); scrollTo(0, 0); }
  else if (d.period) { period = d.period; render(); }
  else if (d.edit) openEdit(d.edit);
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

$('showtime').addEventListener('change', ev => set(S.setSetting(state, 'showTime', ev.target.checked)));

$('add').addEventListener('submit', ev => {
  ev.preventDefault();
  const name = $('name').value.trim(); if (!name) return;
  set(S.addButton(state, name)); $('name').value = '';
});

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
