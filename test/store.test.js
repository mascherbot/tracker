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
