// End-to-end checks for Phase 5, through the real API and Edge Functions as
// signed-in users, with stand-ins for Expo push and Resend email: follow and
// nudge, the one-notification-a-day limit, push and email delivery honoring
// each person's settings, unsubscribe links, and follower anonymity.
// Run via run.sh.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { startFakeNotify, type FakeNotify } from './fake-notify.ts';
import { signUpAndSignIn } from './signup.ts';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;
const workerSecret = process.env.NOTIFICATION_WORKER_SECRET!;
const fakePort = Number(process.env.FAKE_NOTIFY_PORT);
assert.ok(url && key && serviceKey && workerSecret && fakePort, 'Run via supabase/tests/api/run.sh.');

const functionsUrl = `${url}/functions/v1`;
const run = Date.now();
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

let fake: FakeNotify;

async function newUser(label: string) {
  const email = `${label}-${run}@example.com`;
  const signed = await signUpAndSignIn(email);
  const done = await admin.from('profiles')
    .update({ first_name: label, gender: 'Woman', birthday: '1995-05-05', profile_completed_at: new Date().toISOString() })
    .eq('id', signed.id);
  assert.ifError(done.error);
  return { client: signed.client, id: signed.id, token: signed.token, label, email };
}
type User = Awaited<ReturnType<typeof newUser>>;

function callFunction(name: string, headers: Record<string, string> = {}, body: unknown = {}) {
  return fetch(`${functionsUrl}/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, ...headers },
    body: JSON.stringify(body),
  });
}
const runWorker = () => callFunction('process-notifications', { 'x-worker-secret': workerSecret });

let alice: User;  // gets followed and nudged
let bob: User;    // follower
let carol: User;  // follower
let dave: User;   // answered today? no: used for the email path
const aliceToken = `ExponentPushToken[alice-${run}]`;
const deadToken = `ExponentPushToken[dead-${run}]`;

before(async () => {
  fake = await startFakeNotify(fakePort);
  alice = await newUser('alice');
  bob = await newUser('bob');
  carol = await newUser('carol');
  dave = await newUser('dave');
});

after(async () => {
  await fake.close();
});

test('people can follow, and see only a follower count', async () => {
  assert.ifError((await bob.client.rpc('follow_user', { p_user_id: alice.id })).error);
  assert.ifError((await carol.client.rpc('follow_user', { p_user_id: alice.id })).error);

  const count = await alice.client.rpc('get_follower_count');
  assert.equal(count.data, 2);
  assert.equal((await bob.client.rpc('get_follower_count')).data, 0);

  assert.ok((await alice.client.from('follows').select('*')).error, 'Alice cannot read the follows table');
  assert.ok((await alice.client.from('nudges').select('*')).error, 'or the nudges table');
  assert.ok((await bob.client.from('follows').select('*')).error, 'and neither can a follower');
  const state = await bob.client.rpc('get_follow_state', { p_user_id: alice.id });
  assert.deepEqual(state.data[0], { following: true, can_nudge: true, already_nudged: false });
});

test('followers can nudge, once each, and Alice gets one notification that never says who', async () => {
  assert.ifError((await alice.client.rpc('register_device_token', { p_token: aliceToken, p_platform: 'ios' })).error);
  assert.ifError((await alice.client.rpc('register_device_token', { p_token: deadToken, p_platform: 'android' })).error);

  assert.ifError((await bob.client.rpc('nudge_user', { p_user_id: alice.id })).error);
  assert.ok((await bob.client.rpc('nudge_user', { p_user_id: alice.id })).error, 'a second nudge the same day is refused');
  assert.ifError((await carol.client.rpc('nudge_user', { p_user_id: alice.id })).error);
  assert.ok((await dave.client.rpc('nudge_user', { p_user_id: alice.id })).error, 'a non-follower cannot nudge');

  // the notification waits a few minutes; skip the wait
  await admin.from('notification_outbox').update({ send_after: new Date(Date.now() - 1000).toISOString() }).eq('user_id', alice.id);

  const pushedBefore = fake.pushMessages.length;
  assert.equal((await callFunction('process-notifications')).status, 401, 'the worker needs its secret');
  assert.equal((await callFunction('process-notifications', { 'x-worker-secret': 'wrong' })).status, 401);
  assert.equal((await alice.client.functions.invoke('process-notifications')).error !== null, true, 'a signed-in user cannot run it either');

  const res = await runWorker();
  assert.equal(res.status, 200);
  assert.ok((await res.json()).sent >= 1);

  const mine = fake.pushMessages.slice(pushedBefore).filter((m) => m.to === aliceToken);
  assert.equal(mine.length, 1, 'Alice phone got exactly one push');
  assert.equal(mine[0].body, '2 followers want to hear your answer to today\'s question.');
  const everything = JSON.stringify(fake.pushMessages.slice(pushedBefore));
  assert.ok(!everything.includes(bob.id) && !everything.includes(carol.id) && !everything.includes('bob') && !everything.includes('carol'),
    'nothing sent names a follower');

  const tokens = await admin.from('device_tokens').select('token').eq('user_id', alice.id);
  assert.deepEqual(tokens.data!.map((t) => t.token), [aliceToken], 'the phone Expo says is gone was removed');

  const row = await admin.from('notification_outbox').select('status').eq('user_id', alice.id).eq('kind', 'nudge').single();
  assert.equal(row.data!.status, 'sent');

  // running the worker again sends nothing more
  const again = fake.pushMessages.length;
  await runWorker();
  assert.equal(fake.pushMessages.length, again);
});

test('email goes only to people who turned it on, with a working unsubscribe link', async () => {
  // Dave turns email on for daily questions and has no phone; Bob keeps the defaults and has a phone but turns push off
  assert.ifError((await dave.client.rpc('set_notification_preference', { p_type: 'daily_question', p_channel: 'email', p_enabled: true })).error);
  assert.ifError((await dave.client.rpc('set_notification_preference', { p_type: 'daily_question', p_channel: 'push', p_enabled: false })).error);
  assert.ifError((await bob.client.rpc('register_device_token', { p_token: `ExponentPushToken[bob-${run}]`, p_platform: 'ios' })).error);
  assert.ifError((await bob.client.rpc('set_notification_preference', { p_type: 'daily_question', p_channel: 'push', p_enabled: false })).error);

  // late on today's UTC date, so everyone (all in UTC here) is past the 9 AM send time
  const lateToday = new Date();
  lateToday.setUTCHours(23, 59, 0, 0);
  const queued = await admin.rpc('enqueue_daily_question_notifications', { p_now: lateToday.toISOString() });
  assert.ifError(queued.error);
  assert.ok(queued.data >= 4, 'everyone with a finished profile is queued');

  const emailsBefore = fake.emails.length;
  const pushBefore = fake.pushMessages.length;
  assert.equal((await runWorker()).status, 200);

  const daveMail = fake.emails.slice(emailsBefore).filter((e) => e.body.to.includes(dave.email));
  assert.equal(daveMail.length, 1, 'Dave got one email');
  assert.equal(daveMail[0].authorization, 'Bearer test-resend-key');
  assert.match(daveMail[0].body.from, /noreply@catsordogs\.net/);
  assert.equal(daveMail[0].body.subject, 'Today\'s question is live');
  assert.match(daveMail[0].body.text, /unsubscribe|turn these emails off/i);
  const listUnsub = daveMail[0].body.headers['List-Unsubscribe'] as string;
  assert.match(listUnsub, /unsubscribe\?u=/);
  assert.equal(daveMail[0].body.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');

  assert.ok(!fake.emails.slice(emailsBefore).some((e) => e.body.to.includes(alice.email)), 'people with email off get none');
  assert.ok(!fake.pushMessages.slice(pushBefore).some((m) => m.to === `ExponentPushToken[bob-${run}]`), 'Bob turned push off, so no push');
  assert.ok(fake.pushMessages.slice(pushBefore).some((m) => m.to === aliceToken), 'Alice still gets the daily question by push');

  // the unsubscribe link
  const link = new URL(listUnsub.replace(/^<|>$/g, ''));
  const bad = new URL(link);
  bad.searchParams.set('s', '0'.repeat(64));
  assert.equal((await fetch(bad)).status, 400, 'a tampered link is refused');
  const swapped = new URL(link);
  swapped.searchParams.set('t', 'all');
  assert.equal((await fetch(swapped)).status, 400, 'a link cannot be widened to all types');

  const before = (await dave.client.rpc('get_notification_preferences')).data.find((p: any) => p.type === 'daily_question');
  assert.equal(before.email_enabled, true);
  assert.equal((await fetch(link, { method: 'POST' })).status, 200, 'one-click unsubscribe works without signing in');
  const after = (await dave.client.rpc('get_notification_preferences')).data.find((p: any) => p.type === 'daily_question');
  assert.equal(after.email_enabled, false, 'email is now off for that type');
  assert.equal((await fetch(link)).status, 200, 'opening the link again is harmless');
});

test('a failed email is retried, and does not repeat a push that already went out', async () => {
  const eve = await newUser('eve');
  await eve.client.rpc('register_device_token', { p_token: `ExponentPushToken[eve-${run}]`, p_platform: 'ios' });
  await eve.client.rpc('set_notification_preference', { p_type: 'messages', p_channel: 'email', p_enabled: true });
  const queued = await admin.from('notification_outbox').insert({
    user_id: eve.id, type: 'messages', kind: 'generic', title: 'New message', body: 'Hi Eve', dedupe_key: `test:${run}`,
  });
  assert.ifError(queued.error);

  fake.emailFailsWith = 500;
  const pushBefore = fake.pushMessages.length;
  await runWorker();
  const row = await admin.from('notification_outbox').select('status, attempts').eq('user_id', eve.id).single();
  assert.equal(row.data!.status, 'sent', 'the push went out, so it counts as sent');
  assert.equal(fake.pushMessages.slice(pushBefore).filter((m) => m.to === `ExponentPushToken[eve-${run}]`).length, 1);

  // an email-only person whose email fails is retried
  const frank = await newUser('frank');
  await frank.client.rpc('set_notification_preference', { p_type: 'messages', p_channel: 'email', p_enabled: true });
  await admin.from('notification_outbox').insert({
    user_id: frank.id, type: 'messages', kind: 'generic', title: 'New message', body: 'Hi Frank', dedupe_key: `test:${run}`,
  });
  await runWorker();
  const failed = await admin.from('notification_outbox').select('status, attempts, last_error').eq('user_id', frank.id).single();
  assert.equal(failed.data!.status, 'pending');
  assert.equal(failed.data!.attempts, 1);
  assert.match(failed.data!.last_error, /Resend failed with status 500/);

  fake.emailFailsWith = null;
  await admin.from('notification_outbox').update({ send_after: new Date(Date.now() - 1000).toISOString() }).eq('user_id', frank.id);
  await runWorker();
  assert.equal((await admin.from('notification_outbox').select('status').eq('user_id', frank.id).single()).data!.status, 'sent');
});

test('the app cannot touch the queue, tokens or server-only functions', async () => {
  assert.ok((await alice.client.from('notification_outbox').select('*')).error);
  assert.ok((await alice.client.from('device_tokens').insert({ user_id: alice.id, token: 'ExponentPushToken[x]', platform: 'ios' })).error);
  assert.ok((await alice.client.from('notification_preferences').insert({ user_id: alice.id, type: 'nudges', push_enabled: true, email_enabled: true })).error);
  assert.ok((await alice.client.rpc('claim_notifications')).error);
  assert.ok((await alice.client.rpc('enqueue_daily_question_notifications')).error);
  assert.ok((await alice.client.rpc('unsubscribe_email', { p_user_id: bob.id, p_type: 'all' })).error);
  const anon = createClient(url, key, { auth: { persistSession: false } });
  assert.ok((await anon.rpc('get_follower_count')).error);
  assert.ok((await anon.from('follows').select('*')).error);
});

test('the app can report its time zone, but only a real one', async () => {
  assert.ifError((await alice.client.rpc('set_time_zone', { p_time_zone: 'America/Chicago' })).error);
  const mine = await alice.client.from('profiles').select('time_zone').eq('id', alice.id).single();
  assert.equal(mine.data?.time_zone, 'America/Chicago');
  assert.ok((await alice.client.rpc('set_time_zone', { p_time_zone: 'Not/AZone' })).error);
  assert.ok((await alice.client.from('profiles').update({ time_zone: 'UTC' }).eq('id', alice.id)).error);
});
