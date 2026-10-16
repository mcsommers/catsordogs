import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { signUpAndSignIn } from './signup.ts';
import { startFakeGeocoder, type FakeGeocoder } from './fake-geocoder.ts';
import { startFakeGooglePlaces, type FakeGooglePlaces } from './fake-google-places.ts';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;
const fakeGeocoderPort = Number(process.env.FAKE_GEOCODER_PORT);
const fakeGooglePort = Number(process.env.FAKE_GOOGLE_PLACES_PORT);
assert.ok(url && key && serviceKey && fakeGeocoderPort && fakeGooglePort, 'Run via supabase/tests/api/run.sh.');

const functionsUrl = `${url}/functions/v1`;
const run = Date.now();
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
const GOOGLE_KEY = 'test-google-places-key';

let geocoder: FakeGeocoder;
let google: FakeGooglePlaces;

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

async function setProvider(value: 'open_meteo' | 'google_places') {
  const { error } = await admin.from('app_settings').update({ location_provider: value }).eq('id', true);
  assert.ifError(error);
}

before(async () => {
  geocoder = await startFakeGeocoder(fakeGeocoderPort);
  google = await startFakeGooglePlaces(fakeGooglePort, GOOGLE_KEY);
  await setProvider('open_meteo');
});

after(async () => {
  await setProvider('open_meteo');
  await geocoder.close();
  await google.close();
});

test('search-locations requires sign-in and returns US city suggestions from Open-Meteo', async () => {
  assert.equal((await callFunction('search-locations', null, { q: 'bro' })).status, 401);

  const signed = await signUpAndSignIn(`loc-search-${run}@example.com`);
  const empty = await callFunction('search-locations', signed.token, { q: 'b' });
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.json.suggestions, []);

  const res = await callFunction('search-locations', signed.token, { q: 'brook' });
  assert.equal(res.status, 200);
  assert.deepEqual(res.json.suggestions, ['Brooklyn, NY', 'Brooklyn Center, MN']);
  assert.ok(geocoder.requests.some((q) => q.includes('brook')));
});

test('Google Places is used when the admin setting is google_places', async () => {
  const signed = await signUpAndSignIn(`loc-google-${run}@example.com`);
  await setProvider('google_places');
  try {
    const geoBefore = geocoder.requests.length;
    const res = await callFunction('search-locations', signed.token, { q: 'brook' });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json.suggestions, ['Brooklyn, NY', 'Brooklyn Center, MN']);
    assert.equal(geocoder.requests.length, geoBefore, 'Open-Meteo is not called when Google Places is selected');
    assert.ok(google.requests.some((r) => r === 'autocomplete:brook'));

    const set = await signed.client.from('profiles').update({ city: 'Brooklyn, NY' }).eq('id', signed.id);
    assert.ifError(set.error);
    const lookup = await callFunction('update-location', signed.token);
    assert.equal(lookup.status, 200);
    assert.deepEqual(lookup.json, { found: true });
    assert.ok(google.requests.some((r) => r === 'details:brooklyn-ny'));
    const stored = await admin.from('profiles').select('latitude, longitude').eq('id', signed.id).single();
    assert.equal(stored.data!.latitude, 40.65);
    assert.equal(stored.data!.longitude, -73.95);
  } finally {
    await setProvider('open_meteo');
  }
});
