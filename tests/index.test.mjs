import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { analyzeFunnel } from '../dist/esm/index.js';
const options = { steps: ['view', 'buy'], windowMs: 10 };
const e = (id, event, timestamp, userId = 'u') => ({ id, event, timestamp, userId });
test('CommonJS output yields matching deterministic funnel report', () => {
  const cjs = createRequire(import.meta.url)('../dist/cjs/index.js');
  const events = [e('a', 'view', 0), e('b', 'buy', 1)];
  assert.deepEqual(cjs.analyzeFunnel(events, options), analyzeFunnel(events, options));
});
test('chronological deterministic journeys and inclusive first-step window', () => {
  const report = analyzeFunnel(
    [
      { ...e('b', 'buy', 10), privatePayload: 'original-secret' },
      e('a', 'view', 0),
      e('c', 'view', 2, 'v'),
    ],
    options,
  );
  assert.deepEqual(report.counts, [2, 1]);
  assert.deepEqual(report.dropOff, [1, 0]);
  assert.equal(report.conversion, 0.5);
  assert.deepEqual(report.journeys[0].eventIds, ['a', 'b']);
  assert.equal(report.journeys[0].completedAt, 10);
  assert.ok(Object.isFrozen(report.journeys[0].eventIds));
  assert.ok(!JSON.stringify(report).includes('original-secret'));
  assert.throws(
    () => analyzeFunnel([e('original-secret', 'view', -1)], options),
    (error) => !error.message.includes('original-secret'),
  );
});
test('window anchored at earliest start, no restart or inferred causality', () => {
  const report = analyzeFunnel([e('a', 'view', 0), e('b', 'view', 10), e('c', 'buy', 11)], options);
  assert.deepEqual(report.counts, [1, 0]);
  assert.equal(report.journeys[0].completedAt, null);
  assert.equal(analyzeFunnel([e('a', 'buy', 0)], options).conversion, 0);
});
test('ties explicit input order or code-unit ID order', () => {
  const events = [e('b', 'buy', 0), e('a', 'view', 0)];
  assert.deepEqual(analyzeFunnel(events, options).counts, [1, 0]);
  assert.deepEqual(analyzeFunnel(events, { ...options, ties: 'id' }).counts, [1, 1]);
});
test('duplicate identity is per user; first input wins before sorting', () => {
  const events = [e('a', 'view', 0), e('a', 'buy', 1), e('a', 'view', 0, 'v')];
  assert.throws(() => analyzeFunnel(events, options), TypeError);
  const report = analyzeFunnel(events, { ...options, duplicates: 'first' });
  assert.equal(report.duplicateCount, 1);
  assert.deepEqual(report.counts, [2, 0]);
});
test('exclusion covers entire user even outside attribution window', () => {
  const report = analyzeFunnel([e('a', 'view', 0), e('b', 'buy', 1), e('x', 'bot', 100)], {
    ...options,
    excludeEvents: ['bot'],
  });
  assert.deepEqual(report.excludedUsers, ['u']);
  assert.deepEqual(report.counts, [0, 0]);
});
test('repeated steps require distinct events; Unicode identities are exact', () => {
  const report = analyzeFunnel(
    [e('1', '🙂', 0, 'é'), e('2', '🙂', 1, 'é'), e('3', '🙂', 0, 'e\u0301')],
    { steps: ['🙂', '🙂'], windowMs: 1 },
  );
  assert.deepEqual(report.counts, [2, 1]);
  assert.equal(report.journeys.length, 2);
  assert.deepEqual(
    report.journeys.map((j) => j.userId),
    ['e\u0301', 'é'],
  );
});
test('strict options, timestamps and bounded users/events', () => {
  assert.throws(() => analyzeFunnel([], { ...options, windowMs: Infinity }), RangeError);
  assert.throws(() => analyzeFunnel([], { ...options, ties: 'random' }), TypeError);
  assert.throws(() => analyzeFunnel([e('1', 'view', -1)], options), TypeError);
  assert.throws(
    () => analyzeFunnel([e('1', 'view', 0), e('2', 'view', 0, 'v')], { ...options, maxUsers: 1 }),
    RangeError,
  );
  assert.throws(
    () => analyzeFunnel([e('1', 'view', 0), e('2', 'view', 0)], { ...options, maxEvents: 1 }),
    RangeError,
  );
  assert.deepEqual(analyzeFunnel([], options).counts, [0, 0]);
});
