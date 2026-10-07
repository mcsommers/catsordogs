// End-to-end checks for Phase 3, through the real Edge Functions and database,
// with a stand-in for Mux (see fake-mux.ts). Run via run.sh, which starts the
// functions with test-only Mux settings.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac, createPublicKey, verify } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { startFakeMux, type FakeMux } from './fake-mux.ts';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;
const webhookSecret = process.env.MUX_WEBHOOK_SECRET!;
const publicKeyPem = process.env.MUX_TEST_PUBLIC_KEY!;
const fakeMuxPort = Number(process.env.FAKE_MUX_PORT);
assert.ok(url && key && serviceKey && webhookSecret && publicKeyPem && fakeMuxPort, 'Run via supabase/tests/api/run.sh.');

const functionsUrl = `${url}/functions/v1`;
const run = Date.now();
const password = 'correct-horse-battery';
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

let fake: FakeMux;

async function newUser(label: string, { completeProfile }: { completeProfile: boolean }) {
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signUp({ email: `${label}-${run}@example.com`, password });
  assert.ifError(error);
  if (completeProfile) {
    const res = await admin.from('profiles').update({ profile_completed_at: new Date().toISOString() }).eq('id', data.user!.id);
    assert.ifError(res.error);
  }
  return { client, id: data.user!.id, token: data.session!.access_token };
}

function callFunction(name: string, token: string | null, body: unknown = {}) {
  return fetch(`${functionsUrl}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), apikey: key },
    body: JSON.stringify(body),
  });
}

async function sendWebhook(type: string, data: Record<string, unknown>, opts: { secret?: string } = {}) {
  const body = JSON.stringify({ type, data, created_at: new Date().toISOString() });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', opts.secret ?? webhookSecret).update(`${timestamp}.${body}`).digest('hex');
  return fetch(`${functionsUrl}/mux-webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'mux-signature': `t=${timestamp},v1=${signature}` },
    body,
  });
}

async function getVideo(id: string) {
  const { data, error } = await admin.from('videos').select('*').eq('id', id).single();
  assert.ifError(error);
  return data!;
}

function decodeJwt(token: string) {
  const [h, p, s] = token.split('.');
  const verified = verify('RSA-SHA256', Buffer.from(`${h}.${p}`), createPublicKey(publicKeyPem), Buffer.from(s, 'base64url'));
  return {
    verified,
    header: JSON.parse(Buffer.from(h, 'base64url').toString()),
    claims: JSON.parse(Buffer.from(p, 'base64url').toString()),
  };
}

let owner: Awaited<ReturnType<typeof newUser>>;
let stranger: Awaited<ReturnType<typeof newUser>>;
let newcomer: Awaited<ReturnType<typeof newUser>>;
let video: { video_id: string; upload_url: string; recording_length_seconds: number };
const assetId = `asset-${run}`;

before(async () => {
  fake = await startFakeMux(fakeMuxPort);
  owner = await newUser('vp-owner', { completeProfile: true });
  stranger = await newUser('vp-stranger', { completeProfile: true });
  newcomer = await newUser('vp-newcomer', { completeProfile: false });
});

after(async () => {
  await fake.close();
});

test('starting a recording needs a signed-in user', async () => {
  const res = await callFunction('create-video-upload', null);
  assert.equal(res.status, 401);
});

test('a user who has not finished their profile cannot start a recording', async () => {
  const res = await callFunction('create-video-upload', newcomer.token);
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /Finish your profile/);
  assert.equal(fake.uploadRequests.length, 0, 'Mux was not contacted');
});

test('starting a recording returns an upload link and asks Mux for private playback and captions', async () => {
  const res = await callFunction('create-video-upload', owner.token);
  assert.equal(res.status, 200);
  video = await res.json();
  assert.match(video.upload_url, /^http/);
  assert.equal(video.recording_length_seconds, 14);

  const row = await getVideo(video.video_id);
  assert.equal(row.status, 'awaiting_upload');
  assert.ok(row.mux_upload_id, 'the Mux upload id is stored');

  const asked = fake.uploadRequests.at(-1);
  assert.equal(asked.new_asset_settings.passthrough, video.video_id);
  assert.deepEqual(asked.new_asset_settings.playback_policies, ['signed']);
  assert.equal(asked.new_asset_settings.inputs[0].generated_subtitles[0].language_code, 'en');
});

test('the owner cannot play a video that is not ready yet', async () => {
  const res = await callFunction('get-playback-url', owner.token, { video_id: video.video_id });
  assert.equal(res.status, 404);
});

test('the Mux webhook rejects requests that are not signed by Mux', async () => {
  const wrong = await sendWebhook('video.asset.ready', { passthrough: video.video_id }, { secret: 'not-the-secret' });
  assert.equal(wrong.status, 400);
  const unsigned = await fetch(`${functionsUrl}/mux-webhook`, { method: 'POST', body: '{"type":"video.asset.ready","data":{}}' });
  assert.equal(unsigned.status, 400);
  assert.equal((await getVideo(video.video_id)).status, 'awaiting_upload', 'nothing changed');
});

test('Mux events move the video to ready, then fetch and store the captions', async () => {
  const uploadId = (await getVideo(video.video_id)).mux_upload_id;

  assert.equal((await sendWebhook('video.upload.asset_created', { id: uploadId, asset_id: assetId })).status, 200);
  assert.equal((await getVideo(video.video_id)).status, 'processing');

  const ready = { id: assetId, passthrough: video.video_id, duration: 12.4, playback_ids: [{ id: `pb-${assetId}`, policy: 'signed' }] };
  assert.equal((await sendWebhook('video.asset.ready', ready)).status, 200);
  let row = await getVideo(video.video_id);
  assert.equal(row.status, 'ready');
  assert.equal(row.mux_playback_id, `pb-${assetId}`);
  assert.equal(Number(row.duration_seconds), 12.4);
  assert.equal(row.captions_status, 'pending');

  // a repeated event changes nothing and is not an error
  assert.equal((await sendWebhook('video.asset.ready', ready)).status, 200);

  // some other kind of track is ignored
  assert.equal((await sendWebhook('video.asset.track.ready', { id: 'trk-audio', asset_id: assetId, type: 'audio' })).status, 200);
  assert.equal((await getVideo(video.video_id)).captions_status, 'pending');

  const track = { id: 'trk-1', asset_id: assetId, type: 'text', text_type: 'subtitles', text_source: 'generated_vod', language_code: 'en' };
  assert.equal((await sendWebhook('video.asset.track.ready', track)).status, 200);

  row = await getVideo(video.video_id);
  assert.equal(row.captions_status, 'ready');
  assert.deepEqual(row.caption_segments, [
    { start: 0, end: 2.5, text: 'Hi there' },
    { start: 2.5, end: 6, text: 'I love dogs' },
  ]);
  assert.deepEqual(row.auto_caption_segments, row.caption_segments);

  // the caption download was authorised with a properly signed, short-lived token
  const fetched = fake.vttRequests.at(-1)!;
  assert.equal(fetched.path, `/stream/pb-${assetId}/text/trk-1.vtt`);
  const jwt = decodeJwt(fetched.token!);
  assert.equal(jwt.verified, true, 'the token is signed with our signing key');
  assert.equal(jwt.claims.kid, 'test-signing-key-id');
  assert.equal(jwt.claims.sub, `pb-${assetId}`);
  assert.equal(jwt.claims.aud, 'v');
  assert.ok(jwt.claims.exp - Math.floor(Date.now() / 1000) <= 600, 'it expires within 10 minutes');
});

test('the owner can edit caption text but not timing, through the database function', async () => {
  const edit = await owner.client.rpc('update_caption_segments', { p_video_id: video.video_id, p_texts: ['Hello!', 'I love dogs and cats'] });
  assert.ifError(edit.error);
  assert.deepEqual(edit.data, [
    { start: 0, end: 2.5, text: 'Hello!' },
    { start: 2.5, end: 6, text: 'I love dogs and cats' },
  ]);
  const other = await stranger.client.rpc('update_caption_segments', { p_video_id: video.video_id, p_texts: ['a', 'b'] });
  assert.ok(other.error, 'someone else cannot edit them');
});

test('the owner gets short-lived signed links to watch their video; nobody else does', async () => {
  const res = await callFunction('get-playback-url', owner.token, { video_id: video.video_id });
  assert.equal(res.status, 200);
  const links = await res.json();

  const playback = new URL(links.playback_url);
  assert.equal(playback.pathname, `/stream/pb-${assetId}.m3u8`);
  const videoJwt = decodeJwt(playback.searchParams.get('token')!);
  assert.equal(videoJwt.verified, true);
  assert.equal(videoJwt.claims.aud, 'v');
  assert.equal(videoJwt.claims.sub, `pb-${assetId}`);

  const thumb = new URL(links.thumbnail_url);
  assert.equal(thumb.pathname, `/image/pb-${assetId}/thumbnail.jpg`);
  const thumbJwt = decodeJwt(thumb.searchParams.get('token')!);
  assert.equal(thumbJwt.verified, true);
  assert.equal(thumbJwt.claims.aud, 't');

  const theirs = await callFunction('get-playback-url', stranger.token, { video_id: video.video_id });
  assert.equal(theirs.status, 404, 'a different user is refused');
  const signedOut = await callFunction('get-playback-url', null, { video_id: video.video_id });
  assert.equal(signedOut.status, 401);
  const badInput = await callFunction('get-playback-url', owner.token, { video_id: 'nope' });
  assert.equal(badInput.status, 400);
});

test('a recording that is too long is rejected and deleted from Mux', async () => {
  const res = await callFunction('create-video-upload', owner.token);
  assert.equal(res.status, 200);
  const long = await res.json();
  const longAsset = `asset-long-${run}`;

  const event = { id: longAsset, passthrough: long.video_id, duration: 40, playback_ids: [{ id: `pb-${longAsset}`, policy: 'signed' }] };
  assert.equal((await sendWebhook('video.asset.ready', event)).status, 200);

  const row = await getVideo(long.video_id);
  assert.equal(row.status, 'rejected');
  assert.equal(row.reject_reason, 'too_long');
  assert.equal(row.mux_playback_id, null);
  assert.ok(fake.deletedAssets.includes(longAsset), 'the file was removed from Mux');

  const play = await callFunction('get-playback-url', owner.token, { video_id: long.video_id });
  assert.equal(play.status, 404, 'a rejected video cannot be played');
});

test('a failed caption download is reported as a temporary error so Mux retries', async () => {
  const res = await callFunction('create-video-upload', owner.token);
  const second = await res.json();
  const secondAsset = `asset-retry-${run}`;
  await sendWebhook('video.asset.ready', { id: secondAsset, passthrough: second.video_id, duration: 8, playback_ids: [{ id: `pb-${secondAsset}` }] });

  fake.failingTracks.add('trk-flaky');
  const track = { id: 'trk-flaky', asset_id: secondAsset, type: 'text', text_source: 'generated_vod' };
  const failed = await sendWebhook('video.asset.track.ready', track);
  assert.equal(failed.status, 500);
  assert.equal((await getVideo(second.video_id)).captions_status, 'pending');

  fake.failingTracks.delete('trk-flaky');
  assert.equal((await sendWebhook('video.asset.track.ready', track)).status, 200);
  assert.equal((await getVideo(second.video_id)).captions_status, 'ready', 'the retry succeeded');
});

test('captions that fail at Mux leave the video without captions rather than stuck', async () => {
  const res = await callFunction('create-video-upload', owner.token);
  const third = await res.json();
  const thirdAsset = `asset-nocap-${run}`;
  await sendWebhook('video.asset.ready', { id: thirdAsset, passthrough: third.video_id, duration: 5, playback_ids: [{ id: `pb-${thirdAsset}` }] });
  const errored = await sendWebhook('video.asset.track.errored', { id: 't', asset_id: thirdAsset, type: 'text', text_source: 'generated_vod' });
  assert.equal(errored.status, 200);
  assert.equal((await getVideo(third.video_id)).captions_status, 'unavailable');
});

test('cancelled and errored uploads and assets are recorded; unknown events are ignored', async () => {
  const a = await (await callFunction('create-video-upload', owner.token)).json();
  const uploadId = (await getVideo(a.video_id)).mux_upload_id;
  assert.equal((await sendWebhook('video.upload.cancelled', { id: uploadId })).status, 200);
  assert.equal((await getVideo(a.video_id)).status, 'cancelled');

  const b = await (await callFunction('create-video-upload', owner.token)).json();
  assert.equal((await sendWebhook('video.asset.errored', { id: 'x', passthrough: b.video_id })).status, 200);
  assert.equal((await getVideo(b.video_id)).status, 'failed');

  assert.equal((await sendWebhook('video.asset.ready', { id: 'z', passthrough: 'not-ours', duration: 3 })).status, 200);
  assert.equal((await sendWebhook('video.asset.created', { id: 'z' })).status, 200);
  assert.equal((await sendWebhook('video.upload.cancelled', { id: 'unknown-upload' })).status, 200);
});

test('the app cannot write to videos or call the server-only functions', async () => {
  const insert = await owner.client.from('videos').insert({ user_id: owner.id, question_id: crypto.randomUUID() });
  assert.ok(insert.error);
  const update = await owner.client.from('videos').update({ status: 'ready' }).eq('id', video.video_id).select();
  assert.ok(update.error);
  const rpc = await owner.client.rpc('video_asset_ready', {
    p_video_id: video.video_id, p_mux_asset_id: 'x', p_mux_playback_id: 'y', p_duration_seconds: 1,
  });
  assert.ok(rpc.error);
  const seen = await stranger.client.from('videos').select('id').eq('id', video.video_id);
  assert.deepEqual(seen.data, [], 'other people cannot see the video row');
});
