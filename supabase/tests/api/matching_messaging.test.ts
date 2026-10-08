// Phase 6 through the real API: match requests, mutual match, chat, block
// ending the conversation, and that match_interests stays closed.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { startFakeNotify, type FakeNotify } from './fake-notify.ts';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;
const workerSecret = process.env.NOTIFICATION_WORKER_SECRET!;
const fakePort = Number(process.env.FAKE_NOTIFY_PORT);
assert.ok(url && key && serviceKey && workerSecret && fakePort, 'Run via supabase/tests/api/run.sh.');

const functionsUrl = `${url}/functions/v1`;
const run = Date.now();
const password = 'correct-horse-battery';
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

let fake: FakeNotify;

async function newUser(label: string) {
  const client = createClient(url, key, { auth: { persistSession: false } });
  const email = `${label}-${run}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password });
  assert.ifError(error);
  const done = await admin.from('profiles')
    .update({ first_name: label, gender: 'Woman', birthday: '1995-05-05', profile_completed_at: new Date().toISOString() })
    .eq('id', data.user!.id);
  assert.ifError(done.error);
  assert.ifError((await admin.from('profile_photos').insert({
    user_id: data.user!.id, position: 1, storage_path: `${data.user!.id}/1.jpg`,
  })).error);
  return { client, id: data.user!.id, token: data.session!.access_token, label, email };
}
type User = Awaited<ReturnType<typeof newUser>>;

const runWorker = () => fetch(`${functionsUrl}/process-notifications`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: key, 'x-worker-secret': workerSecret },
  body: '{}',
});

let alice: User;
let bob: User;
const bobToken = `ExponentPushToken[bob-match-${run}]`;
const aliceToken = `ExponentPushToken[alice-match-${run}]`;

before(async () => {
  fake = await startFakeNotify(fakePort);
  alice = await newUser('alice');
  bob = await newUser('bob');
});

after(async () => {
  await fake.close();
});

test('a match request from a profile does not need the feed, and Incoming has no liked answer', async () => {
  assert.ok((await alice.client.from('match_interests').select('*')).error, 'the app cannot read match_interests');

  const sent = await alice.client.rpc('send_match_request', { p_user_id: bob.id });
  assert.ifError(sent.error);
  assert.equal(sent.data, 'sent');

  const incoming = await bob.client.rpc('get_incoming_match_requests');
  assert.ifError(incoming.error);
  assert.equal(incoming.data.length, 1);
  assert.equal(incoming.data[0].user_id, alice.id);
  assert.equal(incoming.data[0].question_text, null);
  assert.equal(incoming.data[0].photo_path, `${alice.id}/1.jpg`);

  const outgoing = await alice.client.rpc('get_outgoing_match_requests');
  assert.equal(outgoing.data[0].user_id, bob.id);
  assert.equal(outgoing.data[0].photo_path, `${bob.id}/1.jpg`);
});

test('accepting opens a chat; a decline is never revealed', async () => {
  const carol = await newUser('carol');
  assert.ifError((await alice.client.rpc('send_match_request', { p_user_id: carol.id })).error);
  assert.ifError((await carol.client.rpc('decline_match_request', { p_user_id: alice.id })).error);
  const still = await alice.client.rpc('get_outgoing_match_requests');
  assert.ok(still.data.some((r: { user_id: string }) => r.user_id === carol.id), 'Alice still sees Waiting');
  const carolIn = await carol.client.rpc('get_incoming_match_requests');
  assert.ok(!carolIn.data.some((r: { user_id: string }) => r.user_id === alice.id), 'Carol no longer sees it');

  const accepted = await bob.client.rpc('accept_match_request', { p_user_id: alice.id });
  assert.ifError(accepted.error);
  assert.ok(accepted.data);
  const state = await alice.client.rpc('get_match_state', { p_user_id: bob.id });
  assert.equal(state.data[0].state, 'matched');
  const chats = await alice.client.rpc('get_conversations');
  assert.ok(chats.data.some((c: { user_id: string }) => c.user_id === bob.id));
});

test('matched people can message, and a block ends the chat for both', async () => {
  assert.ifError((await alice.client.rpc('register_device_token', { p_token: aliceToken, p_platform: 'ios' })).error);
  assert.ifError((await bob.client.rpc('register_device_token', { p_token: bobToken, p_platform: 'ios' })).error);

  const matchId = (await alice.client.rpc('get_conversations')).data
    .find((c: { user_id: string }) => c.user_id === bob.id).match_id;
  const sent = await alice.client.rpc('send_message', { p_match_id: matchId, p_body: 'hey bob' });
  assert.ifError(sent.error);
  const thread = await bob.client.rpc('get_messages', { p_match_id: matchId });
  assert.equal(thread.data[0].body, 'hey bob');

  const pushBefore = fake.pushMessages.length;
  assert.equal((await runWorker()).status, 200);
  assert.ok(fake.pushMessages.slice(pushBefore).some((m) => m.to === bobToken && /hey bob/.test(m.body)));

  assert.ifError((await alice.client.rpc('block_user', { p_user_id: bob.id })).error);
  assert.ok((await alice.client.rpc('send_message', { p_match_id: matchId, p_body: 'still there?' })).error);
  assert.ok((await bob.client.rpc('get_messages', { p_match_id: matchId })).error);
  const bobState = await bob.client.rpc('get_match_state', { p_user_id: alice.id });
  assert.equal(bobState.data[0].state, 'none', 'Bob is never told he was blocked');
  assert.ok((await bob.client.from('match_interests').select('*')).error);
});

test('unmatch ends the chat without hiding the other person', async () => {
  const dana = await newUser('dana');
  const ed = await newUser('ed');
  assert.ifError((await dana.client.rpc('send_match_request', { p_user_id: ed.id })).error);
  assert.ifError((await ed.client.rpc('accept_match_request', { p_user_id: dana.id })).error);
  const matchId = (await dana.client.rpc('get_conversations')).data[0].match_id;
  assert.ifError((await dana.client.rpc('send_message', { p_match_id: matchId, p_body: 'hi' })).error);

  assert.ifError((await dana.client.rpc('unmatch_user', { p_user_id: ed.id })).error);
  assert.equal((await dana.client.rpc('get_conversations')).data.length, 0);
  assert.equal((await ed.client.rpc('get_conversations')).data.length, 0);
  assert.equal((await ed.client.rpc('get_match_state', { p_user_id: dana.id })).data[0].state, 'none');
  assert.ok((await dana.client.rpc('send_message', { p_match_id: matchId, p_body: 'still?' })).error);
  assert.ifError((await dana.client.rpc('send_match_request', { p_user_id: ed.id })).error);
});
