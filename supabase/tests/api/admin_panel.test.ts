// Phase 8 through the real API: only an admin can list people or watch a hidden
// video, and that watch does not count as a view.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { signUpAndSignIn } from './signup.ts';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;
assert.ok(url && key && serviceKey, 'Run via supabase/tests/api/run.sh.');

const functionsUrl = `${url}/functions/v1`;
const run = Date.now();
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

let user: Awaited<ReturnType<typeof signUpAndSignIn>>;
let boss: Awaited<ReturnType<typeof signUpAndSignIn>>;
let answerId: string;

before(async () => {
  user = await signUpAndSignIn(`admin-user-${run}@example.com`);
  boss = await signUpAndSignIn(`admin-boss-${run}@example.com`);
  assert.ifError((await admin.from('admin_users').insert({ user_id: boss.id })).error);
  assert.ifError((await admin.from('profiles').update({
    first_name: 'Ada', gender: 'Woman', birthday: '1994-04-04', profile_completed_at: new Date().toISOString(),
  }).eq('id', user.id)).error);

  const today = new Date().toISOString().slice(0, 10);
  const question = await admin.from('questions').select('id').eq('question_date', today).single();
  assert.ok(question.data?.id, 'today needs a question');
  const video = await admin.from('videos').insert({
    user_id: user.id, question_id: question.data.id, status: 'ready', mux_playback_id: `pb-admin-${run}`,
    mux_asset_id: `asset-admin-${run}`, duration_seconds: 8, captions_status: 'unavailable', caption_segments: [],
    submitted_at: new Date().toISOString(),
  }).select('id').single();
  assert.ifError(video.error);
  const answer = await admin.from('answers').insert({
    user_id: user.id, question_id: question.data.id, video_id: video.data!.id,
    duration_seconds: 8, status: 'disabled', caption_text: 'hidden',
  }).select('id').single();
  assert.ifError(answer.error);
  answerId = answer.data!.id;
});

after(async () => {
  await admin.from('admin_users').delete().eq('user_id', boss.id);
});

function callPlayback(token: string, body: unknown) {
  return fetch(`${functionsUrl}/get-playback-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: key },
    body: JSON.stringify(body),
  });
}

test('a normal person cannot open the admin lists or take an admin watch link', async () => {
  const people = await user.client.rpc('admin_list_people');
  assert.match(people.error?.message ?? '', /Not allowed/);
  const stranger = await signUpAndSignIn(`admin-stranger-${run}@example.com`);
  const hidden = await callPlayback(stranger.token, { answer_id: answerId });
  assert.equal(hidden.status, 404);
  const sneaky = await callPlayback(stranger.token, { as_admin: true, answer_id: answerId });
  assert.equal(sneaky.status, 401);
});

test('an admin can watch a hidden video and it does not count as a view', async () => {
  const people = await boss.client.rpc('admin_list_people');
  assert.ifError(people.error);
  const listed = (people.data as {
    id: string; follower_count: number; following_count: number;
    match_count: number; answer_count: number; last_sign_in_at: string | null;
  }[]).find((person) => person.id === user.id);
  assert.ok(listed);
  assert.equal(typeof listed.follower_count, 'number');
  assert.equal(typeof listed.following_count, 'number');
  assert.equal(typeof listed.match_count, 'number');
  assert.equal(listed.answer_count, 1);

  const watched = await callPlayback(boss.token, { as_admin: true, answer_id: answerId });
  assert.equal(watched.status, 200);
  const body = await watched.json();
  assert.ok(String(body.playback_url).includes('.m3u8'));

  const views = await admin.from('answer_views').select('answer_id').eq('answer_id', answerId);
  assert.ifError(views.error);
  assert.equal(views.data?.length ?? 0, 0);
});
