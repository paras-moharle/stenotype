import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYouTubeId, youtubeWatchUrl } from '../lib/youtube.ts';

test('admin YouTube input accepts IDs and canonicalizes known share links', () => {
  const id = 'dQw4w9WgXcQ';
  for (const value of [id, 'https://youtu.be/' + id + '?t=12',
    'https://www.youtube.com/watch?v=' + id, 'https://m.youtube.com/shorts/' + id,
    'https://www.youtube.com/live/' + id]) {
    assert.equal(parseYouTubeId(value), id);
    assert.equal(youtubeWatchUrl(parseYouTubeId(value)), 'https://www.youtube.com/watch?v=' + id);
  }
});

test('external links reject unsupported hosts, protocol and stored values', () => {
  for (const value of ['https://youtube.com.invalid/watch?v=dQw4w9WgXcQ',
    'http://youtu.be/dQw4w9WgXcQ', 'https://a@youtu.be/dQw4w9WgXcQ',
    'https://youtu.be/a/dQw4w9WgXcQ', 'javascript:alert(1)']) {
    assert.equal(parseYouTubeId(value), null);
    assert.equal(youtubeWatchUrl(value), null);
  }
});
