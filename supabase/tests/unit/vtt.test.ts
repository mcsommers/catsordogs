import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVtt } from '../../functions/_shared/vtt.ts';

test('parses a simple caption file', () => {
  const vtt = 'WEBVTT\n\n00:00:00.000 --> 00:00:02.500\nHi there\n\n00:00:02.500 --> 00:00:06.000\nI love dogs\n';
  assert.deepEqual(parseVtt(vtt), [
    { start: 0, end: 2.5, text: 'Hi there' },
    { start: 2.5, end: 6, text: 'I love dogs' },
  ]);
});

test('handles hours, short timestamps, windows line endings and a byte-order mark', () => {
  assert.deepEqual(parseVtt('\uFEFFWEBVTT\r\n\r\n01:02:03.004 --> 01:02:04.5\r\nLate\r\n\r\n00:05.250 --> 00:06.000\r\nShort\r\n'), [
    { start: 3723.004, end: 3724.5, text: 'Late' },
    { start: 5.25, end: 6, text: 'Short' },
  ]);
});

test('skips notes, styles, cue numbers and empty cues; joins lines; removes tags', () => {
  const vtt = [
    'WEBVTT - generated',
    '',
    'NOTE this is a comment',
    '',
    'STYLE',
    '::cue { color: red }',
    '',
    '1',
    '00:00:01.000 --> 00:00:03.000 align:start position:0%',
    '<v Mike>Hello <c.loud>there</c>',
    'friend &amp; neighbour',
    '',
    '2',
    '00:00:03.000 --> 00:00:04.000',
    '   ',
    '',
    '00:00:05.000 --> 00:00:04.000',
    'ends before it starts',
  ].join('\n');
  assert.deepEqual(parseVtt(vtt), [{ start: 1, end: 3, text: 'Hello there friend & neighbour' }]);
});

test('returns an empty list when there is no speech', () => {
  assert.deepEqual(parseVtt('WEBVTT\n\n'), []);
  assert.deepEqual(parseVtt(''), []);
});

test('truncates a very long caption to 500 characters', () => {
  const vtt = `WEBVTT\n\n00:00:00.000 --> 00:00:01.000\n${'a'.repeat(900)}\n`;
  assert.equal(parseVtt(vtt)[0].text.length, 500);
});
