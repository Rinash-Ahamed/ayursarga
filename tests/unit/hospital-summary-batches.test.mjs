import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { performance } from 'node:perf_hooks';
import { loadTypeScript } from '../helpers/loadTypeScript.mjs';
const { loadHospitalPackageSummaryBatches: run } = loadTypeScript('features/hospitals/packageSummary.ts');
const summary = { total: 1, approved: 1, pending: 0, draft: 0, changesRequested: 0 };
const ids = Array.from({ length: 100 }, (_, i) => `hospital-${i}`);
const result = batch => ({ summaries: Object.fromEntries(batch.map(id => [id, summary])) });

test('100 loaded hospitals use five bounded batches, at most two in flight, with no duplicate IDs', async () => {
  let active = 0, maximum = 0;
  const calls = [], saved = {};
  const failures = await run(ids, async batch => {
    calls.push(batch); active++; maximum = Math.max(maximum, active);
    await delay(5); active--; return result(batch);
  }, batch => Object.assign(saved, batch), new AbortController().signal);
  assert.equal(calls.length, 5); assert.equal(maximum, 2);
  assert.ok(calls.every(batch => batch.length <= 20));
  assert.deepEqual(calls.flat(), ids); assert.equal(Object.keys(saved).length, 100);
  assert.deepEqual(failures, []);
});

test('one failed or incomplete batch does not discard independent successful batches', async () => {
  const saved = {};
  const failed = await run(ids, async batch => {
    if (batch[0] === ids[0]) throw new Error('Synthetic failure');
    if (batch[0] === ids[20]) return { summaries: {} };
    return result(batch);
  }, batch => Object.assign(saved, batch), new AbortController().signal);
  assert.deepEqual(failed.sort(), ids.slice(0, 40).sort());
  assert.equal(Object.keys(saved).length, 60);
});

test('aborted runs cannot publish late responses or start remaining batches', async () => {
  const controller = new AbortController(); let calls = 0, published = 0;
  await run(ids, async batch => { calls++; await delay(5); controller.abort(); return result(batch); }, () => published++, controller.signal);
  assert.equal(calls, 2); assert.equal(published, 0);
  await run(ids, async () => { throw new Error('Must not request'); }, () => published++, controller.signal);
});

test('controlled network simulation compares sequential with bounded concurrency, not production latency', async () => {
  const request = async batch => { await delay(25); return result(batch); };
  const before = performance.now();
  for (let i = 0; i < ids.length; i += 20) await request(ids.slice(i, i + 20));
  const sequentialMs = performance.now() - before, start = performance.now();
  await run(ids, request, () => {}, new AbortController().signal);
  console.log(JSON.stringify({ simulation: '100 loaded hospital summaries', requests: 5, simulatedRequestMs: 25, sequentialMs: Math.round(sequentialMs), concurrentMs: Math.round(performance.now() - start) }));
});
