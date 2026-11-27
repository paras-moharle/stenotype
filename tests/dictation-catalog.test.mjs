import test from 'node:test';
import assert from 'node:assert/strict';
import { dictationMetadata } from '../lib/dictation-catalog.ts';

const item = { id: 'sample', title: 'Sample', category: 'LEGAL', youtubeId: 'dQw4w9WgXcQ', durationSeconds: 272 };

test('recording duration requires a supported video and a positive whole number', () => {
  assert.equal(dictationMetadata(item), 'Legal · 4:32 recording');
  for (const youtubeId of [null, '', 'invalid', 'https://example.test']) {
    assert.equal(dictationMetadata({ ...item, youtubeId }), 'Legal');
  }
  for (const durationSeconds of [null, 0, -1, NaN, Infinity, 12.5]) {
    assert.equal(dictationMetadata({ ...item, durationSeconds }), 'Legal');
  }
});
