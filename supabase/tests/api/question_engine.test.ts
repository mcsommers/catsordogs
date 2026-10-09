// End-to-end checks for Phase 2, through the real API. Needs the local seed data (a question for today).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { signUpAndSignIn } from './signup.ts';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
const serviceKey = process.env.SERVICE_ROLE_KEY!;
assert.ok(url && key && serviceKey, 'Run via supabase/tests/api/run.sh so the local URL and keys are set.');

const run = Date.now();
const admin = createClient(url, serviceKey, { auth: { persistSession: false } }); // server-side only, bypasses all rules

async function newUser(label: string) {
  const signed = await signUpAndSignIn(`${label}-${run}@example.com`);
  return { client: signed.client, id: signed.id };
}

const farFuture = (daysAhead: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d.toISOString().slice(0, 10);
};

let user: Awaited<ReturnType<typeof newUser>>;
let boss: Awaited<ReturnType<typeof newUser>>;
const testDates: string[] = [];

before(async () => {
  user = await newUser('qe-user');
  boss = await newUser('qe-admin');
  const { error } = await admin.from('admin_users').insert({ user_id: boss.id });
  assert.ifError(error);
});

after(async () => {
  for (const d of testDates) await admin.from('questions').delete().eq('question_date', d);
  await admin.from('app_settings').update({
    recording_length_seconds: 14, min_watch_seconds: 3, onboarding_mode: 'todays_question', help_support_url: null,
  }).eq('id', true);
});

test('a signed-in user gets today\'s question and the app config', async () => {
  const q = await user.client.rpc('get_todays_question');
  assert.ifError(q.error);
  assert.equal(q.data.length, 1);
  assert.equal(q.data[0].question_date, new Date().toISOString().slice(0, 10), 'today is the UTC day');

  const cfg = await user.client.rpc('get_app_config');
  assert.ifError(cfg.error);
  assert.equal(cfg.data[0].recording_length_seconds, 14);
  assert.deepEqual(Object.keys(cfg.data[0]).sort(), ['help_support_url', 'min_watch_seconds', 'recording_length_seconds']);
});

test('a user cannot see the calendar ahead, the settings, or change anything', async () => {
  const future = await user.client.from('questions').select('*').gt('question_date', farFuture(0));
  assert.equal(future.data?.length, 0, 'future questions are hidden');

  const settings = await user.client.from('app_settings').select('*');
  assert.equal(settings.data?.length, 0, 'settings table is hidden');

  const change = await user.client.from('app_settings').update({ recording_length_seconds: 60 }).eq('id', true).select();
  assert.equal(change.data?.length ?? 0, 0, 'settings cannot be changed by a user');

  const add = await user.client.from('questions').insert({ question_date: farFuture(300), text: 'Sneaky' });
  assert.ok(add.error, 'a user cannot add a question');

  const admins = await user.client.from('admin_users').select('*');
  assert.ok(admins.error, 'a user cannot read the admin list');
});

test('an admin can schedule and swap a question, and the history is private', async () => {
  const date = farFuture(200 + (run % 50));
  testDates.push(date);

  const add = await boss.client.from('questions').insert({ question_date: date, text: 'Scheduled question' });
  assert.ifError(add.error);

  const swap = await boss.client.from('questions').update({ text: 'Breaking news question' }).eq('question_date', date).select().single();
  assert.ifError(swap.error);
  assert.equal(swap.data?.is_override, true);

  const history = await boss.client.from('question_overrides').select('previous_text,new_text').eq('question_id', swap.data!.id);
  assert.deepEqual(history.data, [{ previous_text: 'Scheduled question', new_text: 'Breaking news question' }]);

  const seenByUser = await user.client.from('question_overrides').select('*');
  assert.equal(seenByUser.data?.length, 0);

  const past = await boss.client.from('questions').update({ text: 'Rewrite' }).eq('question_date', farFuture(-3));
  assert.match(past.error?.message ?? '', /Past questions cannot be changed/, 'even an admin cannot rewrite a past question');
  const todayQ = await user.client.rpc('get_todays_question');
  assert.notEqual(todayQ.data[0].text, 'Rewrite');
});

test('admin settings changes reach the app', async () => {
  const set = await boss.client.from('app_settings').update({ recording_length_seconds: 20, help_support_url: 'https://help.example.com' }).eq('id', true);
  assert.ifError(set.error);

  const cfg = await user.client.rpc('get_app_config');
  assert.equal(cfg.data[0].recording_length_seconds, 20);
  assert.equal(cfg.data[0].help_support_url, 'https://help.example.com');

  const bad = await boss.client.from('app_settings').update({ min_watch_seconds: 99 }).eq('id', true);
  assert.ok(bad.error, 'the minimum watch time cannot exceed the recording length');
});

test('onboarding can use a fixed question instead of today\'s', async () => {
  const before = await user.client.rpc('get_onboarding_question');
  assert.equal(before.data[0].prompt_source, 'today');

  const set = await boss.client.from('app_settings').update({ onboarding_mode: 'fixed_question', onboarding_fixed_question: 'Cats or dogs?' }).eq('id', true);
  assert.ifError(set.error);

  const after = await user.client.rpc('get_onboarding_question');
  assert.equal(after.data[0].prompt_text, 'Cats or dogs?');
  assert.equal(after.data[0].prompt_source, 'fixed');

  const todays = await user.client.rpc('get_todays_question');
  assert.equal(after.data[0].question_id, todays.data[0].question_id);
});

test('signed-out visitors get nothing', async () => {
  const anon = createClient(url, key, { auth: { persistSession: false } });
  for (const fn of ['get_todays_question', 'get_app_config', 'get_onboarding_question', 'is_admin']) {
    const r = await anon.rpc(fn);
    assert.ok(r.error, `${fn} must not work signed out`);
  }
});
