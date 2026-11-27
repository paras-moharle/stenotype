import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { once } from 'node:events';
import { align, scoreFromAlignment } from '../lib/typing/scoring.ts';

test('typing worker returns exactly the shared alignment and review data', async (t) => {
  const worker = new Worker(`
    const { parentPort, workerData } = require('node:worker_threads');
    globalThis.self = { postMessage: (message) => parentPort.postMessage(message) };
    require('tsx/cjs');
    require(require('node:url').fileURLToPath(workerData));
    parentPort.on('message', (data) => self.onmessage({ data }));
    parentPort.postMessage({ ready: true });
  `, { eval: true, workerData: new URL('../components/typing/alignment.worker.ts', import.meta.url).href });
  t.after(() => worker.terminate());
  assert.deepEqual((await once(worker, 'message'))[0], { ready: true });
  const reference = 'alpha beta gamma delta '.repeat(175).trim();
  const typed = reference.replaceAll('a', 'x');
  worker.postMessage({ id: 7, reference, typed });
  const [reply] = await once(worker, 'message');
  const expected = align(reference, typed);
  assert.equal(reply.id, 7);
  assert.deepEqual(reply.alignment, expected);
  assert.deepEqual(scoreFromAlignment(reply.alignment, 60_000), scoreFromAlignment(expected, 60_000));

  worker.postMessage({ id: 8, reference: 'a '.repeat(2500), typed: 'b '.repeat(2500) });
  assert.deepEqual((await once(worker, 'message'))[0], { id: 8, error: 'budget' });
});
