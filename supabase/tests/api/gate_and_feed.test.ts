// End-to-end checks for Phase 4, through the real API and Edge Functions as
// signed-in users: recording and submitting an answer, the daily gate, the
// feed, blocks, who can watch whose video, the city lookup, and which tables
// the app can read. Run via run.sh.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { startFakeMux, type FakeMux } from './fake-mux.ts';
import { startFakeGeocoder, type FakeGeocoder } from './fake-geocoder.ts';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;
const webhookSecret = process.env.MUX_WEBHOOK_SECRET!;
const fakeMuxPort = Number(process.env.FAKE_MUX_PORT);
const fakeGeocoderPort = Number(process.env.FAKE_GEOCODER_PORT);
assert.ok(url && key && serviceKey && webhookSecret && fakeMuxPort && fakeGeocoderPort, 'Run via supabase/tests/api/run.sh.');

const functionsUrl = `${url}/functions/v1`;
const run = Date.now();
const password = 'correct-horse-battery';
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

let fakeMux: FakeMux;
let geocoder: FakeGeocoder;

async function newUser(label: string) {
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signUp({ email: `${label}-${run}@example.com`, password });
  assert.ifError(error);
  const done = await admin.from('profiles')
    .update({ first_name: label, gender: 'Woman', birthday: '1995-05-05', profile_completed_at: new Date().toISOString() })
    .eq('id', data.user!.id);
  assert.ifError(done.error);
  return { client, id: data.user!.id, token: data.session!.access_token, label };
}
type User = Awaited<ReturnType<typeof newUser>>;

function callFunction(name: string, token: string | null, body: unknown = {}) {
  return fetch(`${functionsUrl}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), apikey: key },
    body: JSON.stringify(body),
  });
}

async function sendWebhook(type: string, data: Record<string, unknown>) {
  const body = JSON.stringify({ type, data, created_at: new Date().toISOString() });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', webhookSecret).update(`${timestamp}.${body}`).digest('hex');
  return fetch(`${functionsUrl}/mux-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'mux-signature': `t=${timestamp},v1=${signature}` },
    body,
  });
}

// Records a video the real way (upload link, then Mux reporting it ready with
// captions) and returns its id, ready to submit.
async function recordVideo(user: User): Promise<string> {
  const started = await callFunction('create-video-upload', user.token);
  assert.equal(started.status, 200, await started.clone().text());
  const { video_id } = await started.json();
  const { data: row } = await admin.from('videos').select('mux_upload_id').eq('id', video_id).single();
  const assetId = `asset-feed-${user.label}-${run}-${video_id.slice(0, 4)}`;
  await sendWebhook('video.upload.asset_created', { id: row!.mux_upload_id, asset_id: assetId });
  await sendWebhook('video.asset.ready', { id: assetId, passthrough: video_id, duration: 9, playback_ids: [{ id: `pb-${assetId}`, policy: 'signed' }] });
  const track = { id: `trk-${assetId}`, asset_id: assetId, type: 'text', text_source: 'generated_vod' };
  assert.equal((await sendWebhook('video.asset.track.ready', track)).status, 200);
  return video_id;
}

async function answerToday(user: User) {
  const video = await recordVideo(user);
  const submitted = await user.client.rpc('submit_answer', { p_video_id: video });
  assert.ifError(submitted.error);
  return submitted.data as string;
}

let alice: User; // the viewer
let bob: User;   // answers before alice does
let carol: User; // never answers
let aliceAnswer: string;
let bobAnswer: string;

before(async () => {
  fakeMux = await startFakeMux(fakeMuxPort);
  geocoder = await startFakeGeocoder(fakeGeocoderPort);
  alice = await newUser(`alice${run}`);
  bob = await newUser(`bob${run}`);
  carol = await newUser(`carol${run}`);
});

after(async () => {
  await fakeMux.close();
  await geocoder.close();
});

test('before answering, the gate is closed: no feed and no watching other people\'s videos', async () => {
  bobAnswer = await answerToday(bob);

  const gate = await alice.client.rpc('get_gate_status');
  assert.ifError(gate.error);
  assert.equal(gate.data[0].state, 'not_answered');
  assert.ok(gate.data[0].question_text);

  const feed = await alice.client.rpc('get_feed', { p_limit: 50 });
  assert.ifError(feed.error);
  assert.deepEqual(feed.data, [], 'the feed is empty even though Bob has answered');

  const watch = await callFunction('get-playback-url', alice.token, { answer_id: bobAnswer });
  assert.equal(watch.status, 404, 'Bob\'s video cannot be watched through the gate');

  const signedOut = await callFunction('get-playback-url', null, { answer_id: bobAnswer });
  assert.equal(signedOut.status, 401);
  const anon = createClient(url, key, { auth: { persistSession: false } });
  assert.ok((await anon.rpc('get_feed')).error, 'a signed-out visitor cannot read the feed');
});

test('submitting an answer opens the gate', async () => {
  const video = await recordVideo(alice);

  // someone else's recording cannot be submitted
  const stolen = await carol.client.rpc('submit_answer', { p_video_id: video });
  assert.ok(stolen.error);

  const first = await alice.client.rpc('submit_answer', { p_video_id: video });
  assert.ifError(first.error);
  aliceAnswer = first.data;

  const second = await alice.client.rpc('submit_answer', { p_video_id: video });
  assert.ok(second.error, 'an answer cannot be submitted twice');
  const again = await callFunction('create-video-upload', alice.token);
  assert.equal(again.status, 409, 'and no new recording can be started');

  const gate = await alice.client.rpc('get_gate_status');
  assert.equal(gate.data[0].state, 'open');
});

test('with the gate open, the feed shows other people\'s answers and never one\'s own', async () => {
  const { data, error } = await alice.client.rpc('get_feed', { p_limit: 50 });
  assert.ifError(error);
  const rows = data as any[];
  const bobRow = rows.find((r) => r.answer_id === bobAnswer);
  assert.ok(bobRow, 'Bob\'s answer is in Alice\'s feed');
  assert.equal(bobRow.first_name, bob.label);
  assert.equal(bobRow.user_id, bob.id);
  assert.ok(bobRow.caption_segments.length > 0, 'it carries captions');
  assert.equal(bobRow.is_followed, false);
  assert.ok(!rows.some((r) => r.answer_id === aliceAnswer), 'Alice\'s own answer is not in her feed');
  assert.ok(!('latitude' in bobRow) && !('email' in bobRow), 'no coordinates or email are returned');

  const carolFeed = await carol.client.rpc('get_feed', { p_limit: 50 });
  assert.deepEqual(carolFeed.data, [], 'Carol has not answered, so her feed is still empty');
});

test('with the gate open, a signed link to watch Bob\'s answer is issued', async () => {
  const res = await callFunction('get-playback-url', alice.token, { answer_id: bobAnswer });
  assert.equal(res.status, 200);
  const links = await res.json();
  assert.match(links.playback_url, /\.m3u8\?token=/);

  const carolWatch = await callFunction('get-playback-url', carol.token, { answer_id: bobAnswer });
  assert.equal(carolWatch.status, 404, 'Carol is behind the gate');
  assert.equal((await callFunction('get-playback-url', alice.token, { answer_id: 'nope' })).status, 400);
});

test('a block hides both people from each other everywhere, and tells no one', async () => {
  assert.ifError((await alice.client.rpc('block_user', { p_user_id: bob.id })).error);

  const aliceFeed = (await alice.client.rpc('get_feed', { p_limit: 50 })).data as any[];
  assert.ok(!aliceFeed.some((r) => r.user_id === bob.id), 'Bob is gone from Alice\'s feed');
  const bobFeed = (await bob.client.rpc('get_feed', { p_limit: 50 })).data as any[];
  assert.ok(!bobFeed.some((r) => r.user_id === alice.id), 'Alice is gone from Bob\'s feed');

  assert.equal((await callFunction('get-playback-url', alice.token, { answer_id: bobAnswer })).status, 404);
  assert.equal((await callFunction('get-playback-url', bob.token, { answer_id: aliceAnswer })).status, 404);

  const seenByBob = await bob.client.from('blocks').select('*');
  assert.deepEqual(seenByBob.data, [], 'Bob cannot read anything about the block');
  const bobList = await bob.client.rpc('list_blocked_and_not_interested');
  assert.deepEqual(bobList.data, []);
  const aliceList = await alice.client.rpc('list_blocked_and_not_interested');
  assert.equal(aliceList.data.length, 1);
  assert.equal(aliceList.data[0].kind, 'blocked');
  assert.equal(aliceList.data[0].user_id, bob.id);

  assert.ifError((await alice.client.rpc('unblock_user', { p_user_id: bob.id })).error);
  const after = (await alice.client.rpc('get_feed', { p_limit: 50 })).data as any[];
  assert.ok(after.some((r) => r.user_id === bob.id), 'Bob is back after unblocking');
});

test('Not Interested hides someone from the feed, silently', async () => {
  assert.ifError((await alice.client.rpc('mark_not_interested', { p_user_id: bob.id })).error);
  assert.ok(!((await alice.client.rpc('get_feed', { p_limit: 50 })).data as any[]).some((r) => r.user_id === bob.id));
  const bobFeed = (await bob.client.rpc('get_feed', { p_limit: 50 })).data as any[];
  assert.ok(bobFeed.some((r) => r.user_id === alice.id), 'Bob still sees Alice');
  assert.ifError((await alice.client.rpc('undo_not_interested', { p_user_id: bob.id })).error);
  assert.ok(((await alice.client.rpc('get_feed', { p_limit: 50 })).data as any[]).some((r) => r.user_id === bob.id));
});

test('the app cannot read follows or other people\'s answers, and cannot write the new tables', async () => {
  assert.ok((await alice.client.from('follows').select('*')).error, 'follows is closed');
  assert.ok((await alice.client.from('follows').insert({ follower_id: alice.id, followed_id: bob.id })).error);
  assert.ok((await alice.client.from('blocks').insert({ blocker_id: alice.id, blocked_id: bob.id })).error);
  assert.ok((await alice.client.from('not_interested').insert({ user_id: alice.id, target_id: bob.id })).error);
  assert.ok((await alice.client.from('answers').update({ status: 'removed' }).eq('id', aliceAnswer).select()).error);

  const answers = await alice.client.from('answers').select('id');
  assert.deepEqual(answers.data!.map((r) => r.id), [aliceAnswer], 'Alice can see only her own answer row');

  const anon = createClient(url, key, { auth: { persistSession: false } });
  assert.ok((await anon.from('follows').select('*')).error);
  assert.ok((await anon.from('answers').select('*')).error);
});

test('ranking settings are private to each user and validated', async () => {
  const mine = await alice.client.from('feed_settings').select('*');
  assert.equal(mine.data!.length, 1);
  assert.ok((await alice.client.from('feed_settings').update({ recency: 'extreme' }).eq('user_id', alice.id)).error);
  assert.ifError((await alice.client.from('feed_settings').update({ recency: 'high' }).eq('user_id', alice.id)).error);
  assert.ifError((await alice.client.rpc('reset_feed_settings')).error);
  assert.equal((await alice.client.from('feed_settings').select('recency').single()).data!.recency, 'medium');
});

test('the city on a profile is looked up for distance, and people cannot set coordinates themselves', async () => {
  assert.equal((await callFunction('update-location', null)).status, 401);

  const set = await alice.client.from('profiles').update({ city: 'New York' }).eq('id', alice.id);
  assert.ifError(set.error);
  const lookupsBefore = geocoder.requests.length;
  const res = await callFunction('update-location', alice.token);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { found: true });
  assert.equal(geocoder.requests.at(-1), 'new york');
  const stored = await admin.from('profiles').select('latitude, longitude').eq('id', alice.id).single();
  assert.equal(stored.data!.latitude, 40.7128);

  await callFunction('update-location', alice.token);
  assert.equal(geocoder.requests.length, lookupsBefore + 1, 'a city already looked up is not looked up again');

  // changing the city clears the coordinates until the next lookup
  await alice.client.from('profiles').update({ city: 'Boston' }).eq('id', alice.id);
  assert.equal((await admin.from('profiles').select('latitude').eq('id', alice.id).single()).data!.latitude, null);
  await callFunction('update-location', alice.token);
  assert.equal((await admin.from('profiles').select('latitude').eq('id', alice.id).single()).data!.latitude, 42.3601);

  // an unknown place finds nothing but is not an error
  await alice.client.from('profiles').update({ city: 'Nowhereville' }).eq('id', alice.id);
  const unknown = await callFunction('update-location', alice.token);
  assert.deepEqual(await unknown.json(), { found: false });
  assert.equal((await admin.from('profiles').select('latitude').eq('id', alice.id).single()).data!.latitude, null);

  // coordinates cannot be written from the app, or by calling the server function
  assert.ok((await alice.client.from('profiles').update({ latitude: 1, longitude: 1 }).eq('id', alice.id)).error);
  assert.ok((await alice.client.rpc('set_profile_location', { p_user_id: alice.id, p_city: 'x', p_latitude: 1, p_longitude: 1 })).error);
});

test('streaks and view counts: counts are visible, who viewed never is', async () => {
  // Alice was given a link to Bob's answer earlier (Carol was refused and left no trace),
  // but a link alone is not a view.
  const mine = await bob.client.rpc('get_my_answers');
  assert.ifError(mine.error);
  assert.equal(mine.data.length, 1);
  assert.equal(mine.data[0].answer_id, bobAnswer);
  assert.equal(mine.data[0].view_count, 0);

  // reporting too early does not count; after the minimum watch time (an admin setting) it does
  const minWatch = (await admin.from('app_settings').select('min_watch_seconds').single()).data!.min_watch_seconds;
  assert.ok(minWatch > 0, 'the default setting needs some watch time');
  assert.equal((await alice.client.rpc('record_answer_view', { p_answer_id: bobAnswer })).data, false);
  await new Promise((r) => setTimeout(r, minWatch * 1000 + 300));
  assert.equal((await alice.client.rpc('record_answer_view', { p_answer_id: bobAnswer })).data, true);
  assert.equal((await alice.client.rpc('record_answer_view', { p_answer_id: bobAnswer })).data, true);
  assert.equal((await carol.client.rpc('record_answer_view', { p_answer_id: bobAnswer })).data, false, 'Carol never got a link');
  assert.equal((await bob.client.rpc('get_my_answers')).data[0].view_count, 1);
  assert.ok(!('viewer_id' in mine.data[0]));

  const streak = await alice.client.rpc('get_streak');
  assert.equal(streak.data, 1);
  const bobsStreakSeenByAlice = await alice.client.rpc('get_streak', { p_user_id: bob.id });
  assert.equal(bobsStreakSeenByAlice.data, 1);
  const feed = (await alice.client.rpc('get_feed', { p_limit: 50 })).data as any[];
  assert.equal(feed.find((r) => r.user_id === bob.id).streak_days, 1);

  assert.ifError((await alice.client.rpc('record_profile_view', { p_user_id: bob.id })).error);
  assert.ifError((await alice.client.rpc('record_profile_view', { p_user_id: bob.id })).error);
  assert.equal((await bob.client.rpc('get_my_profile_view_count')).data, 1);
  assert.equal((await alice.client.rpc('get_my_profile_view_count')).data, 0);

  assert.ok((await alice.client.from('answer_views').select('*')).error, 'answer views are closed to the app');
  assert.ok((await bob.client.from('profile_views').select('*')).error, 'profile views are closed to the app');
});
