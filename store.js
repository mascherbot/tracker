// Reine Datenlogik (ohne DOM) – im Browser und in Node testbar.
export const PERIODS = { '7d': 'Letzte 7 Tage', month: 'Letzter Monat', year: 'Letztes Jahr', all: 'Alles' };
const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const emptyState = () => ({ buttons: [], entries: [] });

export function addButton(s, name, id = uid()) {
  name = String(name).trim();
  if (!name) return s;
  return { ...s, buttons: [...s.buttons, { id, name }] };
}

export function removeButton(s, id) {
  return { buttons: s.buttons.filter(b => b.id !== id), entries: s.entries.filter(e => e.buttonId !== id) };
}

export function addEntry(s, buttonId, ts = Date.now(), id = uid()) {
  return { ...s, entries: [...s.entries, { id, buttonId, ts }] };
}

export function removeEntry(s, id) {
  return { ...s, entries: s.entries.filter(e => e.id !== id) };
}

export function periodStart(period, now = Date.now()) {
  const d = new Date(now);
  if (period === '7d') d.setDate(d.getDate() - 7);
  else if (period === 'month') d.setMonth(d.getMonth() - 1);
  else if (period === 'year') d.setFullYear(d.getFullYear() - 1);
  else return -Infinity;
  return d.getTime();
}

export function entriesFor(s, buttonId, period = 'all', now = Date.now()) {
  const from = periodStart(period, now);
  return s.entries.filter(e => e.buttonId === buttonId && e.ts >= from).sort((a, b) => b.ts - a.ts);
}

const p2 = n => String(n).padStart(2, '0');
export const formatTime = ts => { const d = new Date(ts); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
export function formatDate(ts) {
  const d = new Date(ts);
  return `${DAYS[d.getDay()]}, ${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}, ${formatTime(ts)}`;
}
