// Phase 7 through the real API: flagging hides one video, reports do not hide
// a profile, the queue is admin-only, and deleting an account removes Mux files.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { startFakeMux, type FakeMux } from './fake-mux.ts';
import { startFakeNotify, type FakeNotify } from './fake-notify.ts';
import { signUpAndSignIn } from './signup.ts';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;
const workerSecret = process.env.NOTIFICATION_WORKER_SECRET!;
const fakeMuxPort = Number(process.env.FAKE_MUX_PORT);
const fakePort = Number(process.env.FAKE_NOTIFY_PORT);
assert.ok(url && key && serviceKey && workerSecret && fakeMuxPort && fakePort, 'Run via supabase/tests/api/run.sh.');

const functionsUrl = `${url}/functions/v1`;
const run = Date.now();
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

let fakeMux: FakeMux;
let fake: FakeNotify;

async function newUser(label: string) {
  const email = `${label}-${run}@example.com`;
  const signed = await signUpAndSignIn(email);
  assert.ifError((await admin.from('profiles')
    .update({ first_name: label, gender: 'Woman', birthday: '1995-05-05', profile_completed_at: new Date().toISOString() })
    .eq('id', signed.id)).error);
  assert.ifError((await admin.from('profile_photos').insert({
    user_id: signed.id, position: 1, storage_path: `${signed.id}/1.jpg`,
  })).error);
  return { client: signed.client, id: signed.id, token: signed.token, label, email };
}
type User = Awaited<ReturnType<typeof newUser>>;

async function answerToday(user: User, assetId: string) {
  const { data: questions } = await admin.from('questions').select('id').eq('question_date', new Date().toISOString().slice(0, 10)).single();
  assert.ok(questions?.id, 'today needs a question');
  const video = await admin.from('videos').insert({
    user_id: user.id, question_id: questions.id, status: 'ready', mux_playback_id: `pb-${assetId}`,
    mux_asset_id: assetId, duration_seconds: 8, captions_status: 'unavailable', caption_segments: [],
    submitted_at: new Date().toISOString(),
  }).select('id').single();
  assert.ifError(video.error);
  const answer = await admin.from('answers').insert({
    user_id: user.id, question_id: questions.id, video_id: video.data!.id, duration_seconds: 8, status: 'live',
  }).select('id').single();
  assert.ifError(answer.error);
  return answer.data!.id as string;
}

let alice: User;
let bob: User;
let carol: User;

before(async () => {
  fakeMux = await startFakeMux(fakeMuxPort);
  fake = await startFakeNotify(fakePort);
  alice = await newUser('alice');
  bob = await newUser('bob');
  carol = await newUser('carol');
  assert.ifError((await admin.from('app_settings').update({ flag_threshold: 1, profile_report_priority_count: 2 }).eq('id', true)).error);
});

after(async () => {
  await fakeMux.close();
  await fake.close();
  await admin.from('app_settings').update({ flag_threshold: 5, profile_report_priority_count: 3 }).eq('id', true);
});

test('flagging hides that video, never the account, and tells the poster', async () => {
  assert.ok((await bob.client.from('flags').select('*')).error, 'the app cannot read flags');

  const aliceAnswer = await answerToday(alice, `asset-alice-${run}`);
  await answerToday(bob, `asset-bob-${run}`);
  await answerToday(carol, `asset-carol-${run}`);

  const flagged = await bob.client.rpc('flag_answer', { p_answer_id: aliceAnswer });
  assert.ifError(flagged.error);
  assert.equal(flagged.data, 'disabled');

  const feed = await carol.client.rpc('get_feed');
  assert.ifError(feed.error);
  assert.ok(!(feed.data ?? []).some((row: { answer_id: string }) => row.answer_id === aliceAnswer));

  const { data: aliceProfile } = await admin.from('profiles').select('first_name').eq('id', alice.id).single();
  assert.equal(aliceProfile?.first_name, 'alice');

  const gate = await alice.client.rpc('get_gate_status');
  assert.equal(gate.data[0].state, 'open');

  assert.ifError((await alice.client.rpc('register_device_token', {
    p_token: `ExponentPushToken[alice-mod-${run}]`, p_platform: 'ios',
  })).error);
  const worker = await fetch(`${functionsUrl}/process-notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, 'x-worker-secret': workerSecret },
    body: '{}',
  });
  assert.equal(worker.status, 200);
  assert.ok(fake.pushMessages.some((m) => m.to === `ExponentPushToken[alice-mod-${run}]` && /hidden/i.test(m.body)));
});

test('a profile report never hides the person, and only admins see the queue', async () => {
  const reported = await bob.client.rpc('report_profile', { p_user_id: carol.id });
  assert.ifError(reported.error);
  assert.equal(reported.data, 'reported');
  assert.equal((await bob.client.rpc('report_profile', { p_user_id: carol.id })).data, 'already_reported');

  const feed = await alice.client.rpc('get_feed');
  assert.ok((feed.data ?? []).some((row: { user_id: string }) => row.user_id === carol.id),
    'Carol is still in the feed');

  const queue = await bob.client.rpc('get_moderation_queue');
  assert.ok(queue.error, 'an ordinary user cannot read the queue');

  await admin.from('admin_users').insert({ user_id: bob.id });
  const asAdmin = await bob.client.rpc('get_moderation_queue');
  assert.ifError(asAdmin.error);
  assert.ok((asAdmin.data ?? []).some((row: { kind: string; target_user_id: string }) =>
    row.kind === 'profile' && row.target_user_id === carol.id));
  await admin.from('admin_users').delete().eq('user_id', bob.id);
});

test('deleting an account removes the profile and the Mux video', async () => {
  const dana = await newUser('dana');
  const assetId = `asset-dana-${run}`;
  await answerToday(dana, assetId);

  const res = await fetch(`${functionsUrl}/delete-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dana.token}`, apikey: key },
    body: '{}',
  });
  assert.equal(res.status, 200, await res.text());
  assert.ok(fakeMux.deletedAssets.includes(assetId), "Mux was asked to delete Dana's video");

  const { data: profile } = await admin.from('profiles').select('id').eq('id', dana.id);
  assert.equal(profile?.length, 0);
  assert.ok((await bob.client.rpc('send_match_request', { p_user_id: dana.id })).error);
});
