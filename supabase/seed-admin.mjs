// Local-only demo data for the admin website. Never run this against staging
// or production. Creates signed-in accounts, profiles, videos, reports, and a
// chat so every admin screen has something to click.
//
//   npm run db:seed-admin
//
// Sign in at http://localhost:5173/admin/ as admin@local.demo
// Password: correct-horse-battery

import { execFileSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { createClient } from '@supabase/supabase-js';

const PASSWORD = 'correct-horse-battery';
const DOMAIN = 'local.demo';

const ids = {
  admin: 'a1000000-0000-4000-8000-000000000001',
  visitor: 'a1000000-0000-4000-8000-000000000002',
  alice: 'a1000000-0000-4000-8000-000000000003',
  bo: 'a1000000-0000-4000-8000-000000000004',
  carol: 'a1000000-0000-4000-8000-000000000005',
  dana: 'a1000000-0000-4000-8000-000000000006',
  eli: 'a1000000-0000-4000-8000-000000000007',
  fay: 'a1000000-0000-4000-8000-000000000008',
  gina: 'a1000000-0000-4000-8000-000000000009',
  hank: 'a1000000-0000-4000-8000-00000000000a',
};

function utcDate(offset) {
  const d = new Date();
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  utc.setUTCDate(utc.getUTCDate() + offset);
  return utc.toISOString().slice(0, 10);
}

function envFromStatus() {
  const raw = execFileSync('npx', ['supabase', 'status', '-o', 'env'], { encoding: 'utf8' });
  const env = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) env[match[1]] = match[2].replace(/^"|"$/g, '');
  }
  return env;
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function solidPng(r, g, b) {
  const size = 48;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      row[1 + x * 3] = r;
      row[2 + x * 3] = g;
      row[3 + x * 3] = b;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(Buffer.concat(rows))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function must(label, result) {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

const people = [
  { id: ids.admin, email: `admin@${DOMAIN}`, first: 'Pat', gender: 'Non-binary', pronouns: ['They/them'], done: true, about: 'I make lists, then ignore them. Weekends are for tacos, a long walk, and arguing about whether the lake is actually blue. Looking for someone who will try a new restaurant without reading every review first.', city: 'Austin', color: [30, 64, 175] },
  { id: ids.visitor, email: `visitor@${DOMAIN}`, first: 'Riley', gender: 'Woman', pronouns: ['She/her'], done: true, about: 'Denver mornings, too much iced coffee, and a hiking app I open more than I use. I will send you a voice note instead of a paragraph. If you also leave the dishes until morning we might get along.', city: 'Denver', color: [120, 113, 108] },
  { id: ids.alice, email: `alice@${DOMAIN}`, first: 'Alice', gender: 'Woman', pronouns: ['She/her'], done: true, about: 'Chicago weekends are for the dog park and a too-big coffee. I will cheer too loud at a mediocre baseball game and then cook you noodles. Looking for someone who can laugh when the plan falls apart.', city: 'Chicago', color: [190, 24, 93], extraPhoto: [244, 114, 182] },
  { id: ids.bo, email: `bo@${DOMAIN}`, first: 'Bo', gender: 'Man', pronouns: ['He/him'], done: true, about: 'I bike to work, I keep a sourdough starter alive by accident, and I have a running list of Chicago diners ranked by pie. Tell me the last thing that made you stay out later than you meant to.', city: 'Chicago', color: [21, 128, 61] },
  { id: ids.carol, email: `carol@${DOMAIN}`, first: 'Carol', gender: 'Woman', pronouns: ['She/her'], done: true, about: 'Product person by day, too many houseplants by night. I have strong opinions about which ferry is the best way off the city and I will defend a rainy hike. If your idea of a good time is a loud kitchen and a board game I am already interested.', city: 'Seattle', color: [180, 83, 9] },
  { id: ids.dana, email: `dana@${DOMAIN}`, first: 'Dana', gender: null, pronouns: [], done: false, about: null, city: null, color: null },
  { id: ids.eli, email: `eli@${DOMAIN}`, first: 'Eli', gender: 'Man', pronouns: ['He/him'], done: true, about: 'I used to hate cooking and now I meal-prep like it is a personality. Boston winters are an excuse to stay in and watch a whole season. Looking for someone who still wants to go out when it is 20 degrees.', city: 'Boston', color: [15, 118, 110] },
  { id: ids.fay, email: `fay@${DOMAIN}`, first: 'Fay', gender: 'Woman', pronouns: ['She/her'], done: true, about: 'Portland coffee, used bookstores, and a bike I still have not named. I start more projects than I finish and I am oddly proud of that. Ask me what I am reading, not what I do.', city: 'Portland', color: [126, 34, 206] },
  { id: ids.gina, email: `gina@${DOMAIN}`, first: 'Gina', gender: 'Woman', pronouns: ['She/her'], done: true, about: 'Miami nights, early ocean swims, and a group chat that never sleeps. I will dance at a wedding even if I do not know anyone. Looking for someone who can keep up and also sit still for a long breakfast.', city: 'Miami', color: [3, 105, 161] },
  { id: ids.hank, email: `hank@${DOMAIN}`, first: 'Hank', gender: 'Man', pronouns: ['He/him'], done: true, about: 'Dallas, barbecue, and a pickup basketball game I am too competitive about. I will remember your coffee order and forget where I parked. If you want a low-key weeknight with a movie I am in.', city: 'Dallas', color: [67, 20, 7] },
];

const env = envFromStatus();
const url = env.API_URL ?? env.SUPABASE_URL;
const service = env.SERVICE_ROLE_KEY;
if (!url || !service) throw new Error('Could not read the local Supabase URL and service key. Is the local database running (npm run db:start)?');

const db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

const existing = await db.auth.admin.listUsers({ perPage: 200 });
if (existing.error) throw new Error(existing.error.message);
for (const user of existing.data.users) {
  if (user.email?.endsWith(`@${DOMAIN}`)) {
    await db.auth.admin.deleteUser(user.id);
  }
}

for (const person of people) {
  const created = await db.auth.admin.createUser({
    id: person.id,
    email: person.email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (created.error) throw new Error(`create ${person.email}: ${created.error.message}`);
}

for (const person of people) {
  await must(`profile ${person.first}`, await db.from('profiles').update({
    first_name: person.first,
    gender: person.gender,
    pronouns: person.pronouns,
    birthday: person.done ? '1994-04-12' : null,
    city: person.city,
    about_me: person.about,
    sexual_orientation: person.done ? ['Straight'] : [],
    lifestyle_tags: person.done ? ['Non-smoker'] : [],
    languages: person.done ? ['English'] : [],
    interests: person.done ? ['Coffee', 'Movies'] : [],
    relationship_goal: person.done ? 'Long-term relationship' : null,
    allow_followers: true,
    job_title: person.done ? 'Designer' : null,
    company: person.done ? 'Independent' : null,
    school: person.done ? 'State University' : null,
    profile_completed_at: person.done ? new Date().toISOString() : null,
  }).eq('id', person.id));
}

// Coffee is not a lifestyle tag. Fix tags to real options.
await must('alice lifestyle', await db.from('profiles').update({
  lifestyle_tags: ['Cat lover', 'Night owl'],
}).eq('id', ids.alice));
for (const id of [ids.admin, ids.visitor, ids.bo, ids.carol, ids.eli, ids.fay, ids.gina, ids.hank]) {
  await must('lifestyle', await db.from('profiles').update({ lifestyle_tags: ['Non-smoker'] }).eq('id', id));
}

for (const person of people) {
  if (!person.color) continue;
  const path = `${person.id}/1.png`;
  await must(`photo ${person.first}`, await db.storage.from('profile-photos').upload(path, solidPng(...person.color), {
    contentType: 'image/png',
    upsert: true,
  }));
  await must(`photo row ${person.first}`, await db.from('profile_photos').insert({
    user_id: person.id, position: 1, storage_path: path,
  }));
  if (person.extraPhoto) {
    const second = `${person.id}/2.png`;
    await must('alice photo 2', await db.storage.from('profile-photos').upload(second, solidPng(...person.extraPhoto), {
      contentType: 'image/png',
      upsert: true,
    }));
    await must('alice photo 2 row', await db.from('profile_photos').insert({
      user_id: person.id, position: 2, storage_path: second,
    }));
  }
}

await must('admin list', await db.from('admin_users').upsert({ user_id: ids.admin }));

function runSql(sql) {
  execFileSync('docker', [
    'exec', '-i', 'supabase_db_cats-or-dogs',
    'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', sql,
  ], { encoding: 'utf8' });
}

const hoursAgo = (hours) => `now() - interval '${hours} hours'`;
runSql(`
  update auth.users set last_sign_in_at = ${hoursAgo(1)} where id = '${ids.alice}';
  update auth.users set last_sign_in_at = ${hoursAgo(5)} where id = '${ids.bo}';
  update auth.users set last_sign_in_at = ${hoursAgo(26)} where id = '${ids.carol}';
  update auth.users set last_sign_in_at = ${hoursAgo(48)} where id = '${ids.eli}';
  update auth.users set last_sign_in_at = ${hoursAgo(72)} where id = '${ids.fay}';
  update auth.users set last_sign_in_at = ${hoursAgo(4)} where id = '${ids.gina}';
  update auth.users set last_sign_in_at = ${hoursAgo(144)} where id = '${ids.hank}';
  update auth.users set last_sign_in_at = ${hoursAgo(0.25)} where id = '${ids.admin}';
  update auth.users set last_sign_in_at = ${hoursAgo(12)} where id = '${ids.visitor}';
`);

const today = utcDate(0);
const tomorrow = utcDate(1);
const inFour = utcDate(4);
await db.from('questions').delete().eq('question_date', tomorrow);
await db.from('questions').delete().eq('question_date', inFour);

const q = {};
for (const offset of [-5, -3, -2, -1, 0]) {
  const { data, error } = await db.from('questions').select('id, question_date, text').eq('question_date', utcDate(offset)).maybeSingle();
  if (error) throw new Error(error.message);
  if (data) q[offset] = data;
}
if (!q[0]) throw new Error('Today has no question. Run npm run db:reset first so the sample questions load.');

async function recording(userId, question, status, caption, answerStatus) {
  const videoId = crypto.randomUUID();
  await must('video', await db.from('videos').insert({
    id: videoId,
    user_id: userId,
    question_id: question.id,
    status: status === 'processing' ? 'processing' : 'ready',
    mux_playback_id: status === 'processing' ? null : `demo-${videoId.slice(0, 8)}`,
    duration_seconds: 8,
    captions_status: status === 'processing' ? 'pending' : 'unavailable',
    caption_segments: '[]',
    submitted_at: answerStatus ? new Date().toISOString() : null,
    reject_reason: status === 'rejected' ? 'too_long' : null,
  }));
  if (status === 'rejected') {
    await must('reject', await db.from('videos').update({ status: 'rejected', reject_reason: 'too_long' }).eq('id', videoId));
  }
  if (!answerStatus) return videoId;
  const answerId = crypto.randomUUID();
  await must('answer', await db.from('answers').insert({
    id: answerId,
    user_id: userId,
    question_id: question.id,
    video_id: videoId,
    duration_seconds: 8,
    caption_text: caption,
    status: answerStatus,
  }));
  return { videoId, answerId };
}

const aliceToday = await recording(ids.alice, q[0], 'ready', 'Dogs, because they greet you at the door.', 'disabled');
await recording(ids.bo, q[0], 'ready', 'Cats. They keep their own calendar.', 'live');
await recording(ids.admin, q[0], 'ready', 'Both. That is the whole point.', 'live');
if (q[-1]) {
  await recording(ids.alice, q[-1], 'ready', 'I changed my mind about early mornings.', 'live');
  await recording(ids.eli, q[-1], 'ready', 'I used to hate cooking. Now I do not.', 'live');
}
if (q[-2]) await recording(ids.bo, q[-2], 'ready', 'My grandmother.', 'live');
if (q[-3]) await recording(ids.alice, q[-3], 'ready', 'A bowl of noodles in a train station.', 'live');
await recording(ids.fay, q[0], 'processing', '', null);
const rejectedId = crypto.randomUUID();
await must('rejected video', await db.from('videos').insert({
  id: rejectedId,
  user_id: ids.fay,
  question_id: q[0].id,
  status: 'rejected',
  reject_reason: 'too_long',
  duration_seconds: 40,
  captions_status: 'unavailable',
  caption_segments: '[]',
}));

await must('flags', await db.from('flags').insert(
  [ids.bo, ids.gina, ids.hank, ids.eli, ids.carol].map((reporter) => ({
    answer_id: aliceToday.answerId,
    reporter_id: reporter,
    poster_id: ids.alice,
    question_text: q[0].text,
  })),
));
await must('hidden video queue', await db.from('moderation_actions').insert({
  kind: 'answer',
  answer_id: aliceToday.answerId,
  target_user_id: ids.alice,
  snapshot: { first_name: 'Alice', question_text: q[0].text, flag_count: 5 },
}));

await must('alice profile reports', await db.from('reports').insert({
  kind: 'profile', reporter_id: ids.bo, target_user_id: ids.alice, snapshot: { first_name: 'Alice' },
}));
await must('alice profile queue', await db.from('moderation_actions').insert({
  kind: 'profile', target_user_id: ids.alice, snapshot: { first_name: 'Alice' },
}));

await must('carol reports', await db.from('reports').insert([
  { kind: 'profile', reporter_id: ids.bo, target_user_id: ids.carol, snapshot: { first_name: 'Carol' } },
  { kind: 'profile', reporter_id: ids.gina, target_user_id: ids.carol, snapshot: { first_name: 'Carol' } },
  { kind: 'profile', reporter_id: ids.hank, target_user_id: ids.carol, snapshot: { first_name: 'Carol' } },
]));
await must('carol queue', await db.from('moderation_actions').insert({
  kind: 'profile', target_user_id: ids.carol, snapshot: { first_name: 'Carol' },
}));

const matchId = 'a3000000-0000-4000-8000-000000000001';
await must('match', await db.from('matches').insert({
  id: matchId, user_a: ids.alice, user_b: ids.bo,
}));
const reportedMessage = 'a4000000-0000-4000-8000-000000000003';
await must('chat', await db.from('messages').insert([
  { id: 'a4000000-0000-4000-8000-000000000001', match_id: matchId, sender_id: ids.bo, body: 'Hey Alice — I liked your answer today.' },
  { id: 'a4000000-0000-4000-8000-000000000002', match_id: matchId, sender_id: ids.alice, body: 'Thanks. Dogs really are the better roommate.' },
  { id: reportedMessage, match_id: matchId, sender_id: ids.alice, body: 'This is the reported line. It is the whole message, not a preview.' },
  { id: 'a4000000-0000-4000-8000-000000000004', match_id: matchId, sender_id: ids.bo, body: 'Okay, noted.' },
]));
await must('message report', await db.from('reports').insert({
  kind: 'message',
  reporter_id: ids.bo,
  target_user_id: ids.alice,
  message_id: reportedMessage,
  snapshot: { first_name: 'Alice', body: 'This is the reported line. It is the whole message, not a preview.' },
}));
await must('message queue', await db.from('moderation_actions').insert({
  kind: 'message',
  target_user_id: ids.alice,
  message_id: reportedMessage,
  snapshot: { first_name: 'Alice', body: 'This is the reported line. It is the whole message, not a preview.' },
}));

await must('follow', await db.from('follows').insert({ follower_id: ids.bo, followed_id: ids.alice }));

console.log(`
Admin demo data is ready.

Open http://localhost:5173/admin/ and sign in as:
  email     admin@${DOMAIN}
  password  ${PASSWORD}

A normal account that should be turned away:
  email     visitor@${DOMAIN}
  password  ${PASSWORD}

What to click through
- Questions: today has answers and View videos. Tomorrow is empty (highlighted).
  Four days from now is also empty. Show previous questions for older days
  with counts.
- Review queue: Videos (Alice, hidden), Profiles (Carol is high priority,
  Alice is a regular report), Chats (open the conversation and find the
  marked message).
- People: finished profiles with photos, plus Dana (not finished).
- Videos: date filter, Unhide on Alice's hidden answer, and Fay's unfinished
  and rejected recordings.
`);
