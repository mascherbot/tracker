import test from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../store.js';

const now = new Date(2026, 9, 17, 11, 20).getTime();
const day = 864e5;

test('Button anlegen und löschen (inkl. Einträge)', () => {
  let s = S.addButton(S.emptyState(), '  Kopfweh ', 'b1');
  s = S.addButton(s, '   ', 'x');
  assert.deepEqual(s.buttons, [{ id: 'b1', name: 'Kopfweh' }]);
  s = S.addEntry(s, 'b1', now, 'e1');
  s = S.removeButton(s, 'b1');
  assert.deepEqual(s, S.emptyState());
});

test('Einträge hinzufügen, neueste zuerst, löschen', () => {
  let s = S.addButton(S.emptyState(), 'A', 'a');
  s = S.addButton(s, 'B', 'b');
  s = S.addEntry(s, 'a', now - 2 * day, 'e1');
  s = S.addEntry(s, 'a', now, 'e2');
  s = S.addEntry(s, 'b', now, 'e3');
  assert.deepEqual(S.entriesFor(s, 'a', 'all', now).map(e => e.id), ['e2', 'e1']);
  s = S.removeEntry(s, 'e2');
  assert.deepEqual(S.entriesFor(s, 'a', 'all', now).map(e => e.id), ['e1']);
});

test('Zeitraum-Filter', () => {
  let s = S.emptyState();
  const ages = { d1: 1, d6: 6, d8: 8, d20: 20, d40: 40, d200: 200, d400: 400 };
  for (const [id, a] of Object.entries(ages)) s = S.addEntry(s, 'a', now - a * day, id);
  const ids = p => S.entriesFor(s, 'a', p, now).map(e => e.id);
  assert.deepEqual(ids('7d'), ['d1', 'd6']);
  assert.deepEqual(ids('month'), ['d1', 'd6', 'd8', 'd20']);
  assert.deepEqual(ids('year'), ['d1', 'd6', 'd8', 'd20', 'd40', 'd200']);
  assert.equal(ids('all').length, 7);
});

test('Deutsches Datumsformat', () => {
  assert.equal(S.formatDate(now), 'Sa, 17.10.2026, 11:20');
  assert.equal(S.formatDate(new Date(2026, 0, 5, 9, 3).getTime()), 'Mo, 05.01.2026, 09:03');
  assert.equal(S.formatTime(now), '11:20');
});

test('Eintrag bearbeiten: Datum und Kommentar', () => {
  let s = S.addEntry(S.emptyState(), 'a', now, 'e1');
  s = S.addEntry(s, 'a', now - day, 'e2');
  s = S.updateEntry(s, 'e1', { ts: now - 3 * day, note: '  leichte Kopfschmerzen ' });
  assert.deepEqual(S.entriesFor(s, 'a', 'all', now).map(e => e.id), ['e2', 'e1']);  // neu sortiert
  assert.equal(s.entries[0].note, 'leichte Kopfschmerzen');
  s = S.updateEntry(s, 'e1', { ts: NaN, note: '' });  // ungültiges Datum ändert nichts
  assert.equal(s.entries[0].ts, now - 3 * day);
  assert.equal(s.entries[0].note, '');
});

test('Migration alter Daten (v1 ohne Kommentar/Einstellungen)', () => {
  const old = { buttons: [{ id: 'b', name: 'Kopfweh' }], entries: [{ id: 'e', buttonId: 'b', ts: now }] };
  const s = S.normalize(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(s.buttons, old.buttons);
  assert.deepEqual(s.entries, [{ id: 'e', buttonId: 'b', ts: now, note: '' }]);
  assert.equal(s.settings.showTime, true);
  assert.deepEqual(S.normalize(null), S.emptyState());
  assert.equal(S.normalize({ ...old, settings: { showTime: false } }).settings.showTime, false);
});

test('Einstellung und Datum ohne Uhrzeit, datetime-local', () => {
  assert.equal(S.setSetting(S.emptyState(), 'showTime', false).settings.showTime, false);
  assert.equal(S.formatDate(now, false), 'Sa, 17.10.2026');
  assert.equal(S.toInputValue(now), '2026-10-17T11:20');
  assert.equal(S.fromInputValue('2026-10-17T11:20'), now);
  assert.ok(Number.isNaN(S.fromInputValue('')));
});
