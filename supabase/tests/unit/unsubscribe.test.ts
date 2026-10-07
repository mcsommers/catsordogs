import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unsubscribeUrl, verifyUnsubscribe } from '../../functions/_shared/unsubscribe.ts';

const secret = 'test-secret-that-is-long-enough';
const user = '11111111-2222-3333-4444-555555555555';

async function parts(type: string) {
  const url = new URL(await unsubscribeUrl('https://x.supabase.co/functions/v1/', secret, user, type));
  return { path: url.pathname, u: url.searchParams.get('u')!, t: url.searchParams.get('t')!, s: url.searchParams.get('s')! };
}

test('a link we made verifies', async () => {
  const p = await parts('nudges');
  assert.equal(p.path, '/functions/v1/unsubscribe');
  assert.equal(await verifyUnsubscribe(secret, p.u, p.t, p.s), true);
  const all = await parts('all');
  assert.equal(await verifyUnsubscribe(secret, all.u, all.t, all.s), true);
});

test('a link cannot be reused for another person, another type, or with another secret', async () => {
  const p = await parts('nudges');
  assert.equal(await verifyUnsubscribe(secret, '99999999-2222-3333-4444-555555555555', p.t, p.s), false);
  assert.equal(await verifyUnsubscribe(secret, p.u, 'matches', p.s), false);
  assert.equal(await verifyUnsubscribe(secret, p.u, 'all', p.s), false);
  assert.equal(await verifyUnsubscribe('a-different-secret-entirely', p.u, p.t, p.s), false);
  assert.equal(await verifyUnsubscribe(secret, p.u, p.t, ''), false);
  assert.equal(await verifyUnsubscribe(secret, p.u, p.t, p.s.slice(0, -1) + (p.s.endsWith('0') ? '1' : '0')), false);
});

test('unknown types are refused even with a matching signature', async () => {
  const p = await parts('spam');
  assert.equal(await verifyUnsubscribe(secret, p.u, p.t, p.s), false);
});
