// End-to-end checks that go through the real API, the same way the phone app does.
// These prove the access rules hold for an ordinary signed-in user, not just inside the database.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
assert.ok(url && key, 'Run via supabase/tests/api/run.sh so the local URL and key are set.');

const run = Date.now();
const password = 'correct-horse-battery';
const eighteenYearsAgo = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 25);
  return d.toISOString().slice(0, 10);
};

async function newUser(label: string) {
  const client = createClient(url, key, { auth: { persistSession: false } });
  const email = `${label}-${run}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password });
  assert.ifError(error);
  assert.ok(data.user && data.session, 'sign-up should sign the user straight in (no email confirmation locally)');
  return { client, id: data.user.id, email };
}

let alice: Awaited<ReturnType<typeof newUser>>;
let bob: Awaited<ReturnType<typeof newUser>>;

before(async () => {
  alice = await newUser('alice');
  bob = await newUser('bob');
});

const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });

test('sign up creates an empty profile, and log in works', async () => {
  const { data } = await alice.client.from('profiles').select('*').single();
  assert.equal(data?.id, alice.id);
  assert.equal(data?.profile_completed_at, null);

  const again = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await again.auth.signInWithPassword({ email: alice.email, password });
  assert.ifError(error);
});

test('short passwords are rejected', async () => {
  const c = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await c.auth.signUp({ email: `short-${run}@example.com`, password: 'abc123' });
  assert.ok(error, 'a 6-character password should not be accepted');
});

test('minimum age is enforced through the API', async () => {
  const young = new Date();
  young.setFullYear(young.getFullYear() - 16);
  const { error } = await alice.client
    .from('profiles')
    .update({ birthday: young.toISOString().slice(0, 10) })
    .eq('id', alice.id);
  assert.match(error?.message ?? '', /at least 18/);
});

test('a user can build and finish a profile with a photo upload', async () => {
  const { error: e1 } = await alice.client
    .from('profiles')
    .update({ first_name: 'Alex', birthday: eighteenYearsAgo(), gender: 'Woman', interests: ['Hiking', 'Coffee'] })
    .eq('id', alice.id);
  assert.ifError(e1);

  const premature = await alice.client.rpc('complete_profile');
  assert.match(premature.error?.message ?? '', /at least 1 photo/);

  const path = `${alice.id}/1.jpg`;
  const up = await alice.client.storage.from('profile-photos').upload(path, jpeg, { contentType: 'image/jpeg' });
  assert.ifError(up.error);
  const ins = await alice.client.from('profile_photos').insert({ user_id: alice.id, position: 1, storage_path: path });
  assert.ifError(ins.error);

  const done = await alice.client.rpc('complete_profile');
  assert.ifError(done.error);
  assert.ok(done.data);
});

test('a user cannot read or change anyone else\'s profile, photos or filters', async () => {
  const seen = await bob.client.from('profiles').select('id');
  assert.deepEqual(seen.data?.map((r) => r.id), [bob.id]);

  const hack = await bob.client.from('profiles').update({ first_name: 'Hacked' }).eq('id', alice.id).select();
  assert.equal(hack.data?.length, 0);

  const photos = await bob.client.from('profile_photos').select('*');
  assert.equal(photos.data?.length, 0);

  const filters = await bob.client.from('filter_preferences').select('user_id');
  assert.deepEqual(filters.data?.map((r) => r.user_id), [bob.id]);

  const { data: a } = await alice.client.from('profiles').select('first_name').single();
  assert.equal(a?.first_name, 'Alex');
});

test('the first photo is the avatar; later photos stay private', async () => {
  const avatar = `${alice.id}/1.jpg`;
  const extra = `${alice.id}/2.jpg`;
  const up = await alice.client.storage.from('profile-photos').upload(extra, jpeg, { contentType: 'image/jpeg' });
  assert.ifError(up.error);
  assert.ifError((await alice.client.from('profile_photos').insert({
    user_id: alice.id, position: 2, storage_path: extra,
  })).error);

  const own = await alice.client.storage.from('profile-photos').download(avatar);
  assert.ifError(own.error);

  const otherAvatar = await bob.client.storage.from('profile-photos').download(avatar);
  assert.ifError(otherAvatar.error);

  const otherExtra = await bob.client.storage.from('profile-photos').download(extra);
  assert.ok(otherExtra.error, 'a later photo stays private to its owner');

  const anon = createClient(url, key, { auth: { persistSession: false } });
  const pub = await anon.storage.from('profile-photos').download(avatar);
  assert.ok(pub.error, 'a signed-out visitor must not be able to download the file');

  const intoOthers = await bob.client.storage.from('profile-photos').upload(`${alice.id}/evil.jpg`, jpeg, { contentType: 'image/jpeg' });
  assert.ok(intoOthers.error, 'a user must not be able to upload into another user\'s folder');

  const notImage = await alice.client.storage
    .from('profile-photos')
    .upload(`${alice.id}/notes.txt`, new Blob(['hi'], { type: 'text/plain' }), { contentType: 'text/plain' });
  assert.ok(notImage.error, 'only image files are accepted');
});

test('users cannot set server-controlled fields', async () => {
  const r1 = await bob.client.from('profiles').update({ profile_completed_at: new Date().toISOString() }).eq('id', bob.id);
  assert.ok(r1.error, 'completion time must not be settable by the user');
  const r2 = await bob.client.from('profiles').update({ created_at: '2000-01-01' }).eq('id', bob.id);
  assert.ok(r2.error, 'join date must not be settable by the user');
});

test('filter preferences are validated and private', async () => {
  const ok = await bob.client
    .from('filter_preferences')
    .update({ filters: { show_me: 'Men', age_range: { min: 25, max: 40 } } })
    .eq('user_id', bob.id);
  assert.ifError(ok.error);

  const bad = await bob.client.from('filter_preferences').update({ filters: { nonsense: true } }).eq('user_id', bob.id);
  assert.match(bad.error?.message ?? '', /Unknown filter/);
});

test('signed-out visitors see nothing', async () => {
  const anon = createClient(url, key, { auth: { persistSession: false } });
  const r = await anon.from('profiles').select('*');
  assert.ok(r.error, 'anon must not be able to read profiles');
  const rpc = await anon.rpc('complete_profile');
  assert.ok(rpc.error, 'anon must not be able to call complete_profile');
});
