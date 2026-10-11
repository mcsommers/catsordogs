import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signUpAndSignIn } from './signup.ts';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
assert.ok(url && key, 'Run via supabase/tests/api/run.sh.');

const functionsUrl = `${url}/functions/v1`;
const run = Date.now();

async function callFunction(name: string, token: string | null, body: unknown = {}) {
  const res = await fetch(`${functionsUrl}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      apikey: key,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

test('search-locations requires sign-in and returns US city suggestions', async () => {
  assert.equal((await callFunction('search-locations', null, { q: 'bro' })).status, 401);

  const signed = await signUpAndSignIn(`loc-search-${run}@example.com`);
  const empty = await callFunction('search-locations', signed.token, { q: 'b' });
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.json.suggestions, []);

  const res = await callFunction('search-locations', signed.token, { q: 'brook' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.suggestions, ['Brooklyn, NY', 'Brooklyn Center, MN']);
});
