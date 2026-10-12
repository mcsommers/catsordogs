// Staging-only demo people with live answers so the Feed tab has videos to scroll.
// Never run against production.
//
//   SUPABASE_URL=https://<staging>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<staging service role> \
//   node supabase/seed-staging-feed.mjs
//
// Safe to re-run: skips accounts that already exist (email feed-demo-N@catsordogs.demo).

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the staging project.');
  process.exit(1);
}
if (/fvnbcofflierdlnnglko/.test(url)) {
  console.error('This script is for staging only. Aborting.');
  process.exit(1);
}

const admin = createClient(url, key, { auth: { persistSession: false } });
const PASSWORD = 'feed-demo-staging-2026';
const DOMAIN = 'catsordogs.demo';
const DEMO_NAMES = [
  'Jordan',
  'Sam',
  'Riley',
  'Casey',
  'Avery',
  'Quinn',
  'Morgan',
  'Parker',
  'Taylor',
  'Reese',
  'Dakota',
  'Skyler',
  'Jamie',
];

function utcDate(offset) {
  const d = new Date();
  const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  utc.setUTCDate(utc.getUTCDate() + offset);
  return utc.toISOString().slice(0, 10);
}

async function ensureUser(n) {
  const email = `feed-demo-${n}@${DOMAIN}`;
  const { data: existing } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const hit = existing?.users?.find((u) => u.email === email);
  if (hit) return hit.id;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
  return data.user.id;
}

async function main() {
  const { data: qToday } = await admin.from('questions').select('id').eq('question_date', utcDate(0)).maybeSingle();
  if (!qToday) {
    console.error('No question scheduled for today on staging. Add one in the admin panel first.');
    process.exit(1);
  }
  const questionId = qToday.id;

  for (let i = 0; i < DEMO_NAMES.length; i++) {
    const id = await ensureUser(i + 1);
    const name = DEMO_NAMES[i];
    await admin.from('profiles').upsert({
      id,
      first_name: name,
      gender: i % 2 === 0 ? 'Woman' : 'Man',
      birthday: '1995-06-15',
      city: 'Brooklyn, NY',
      profile_completed_at: new Date().toISOString(),
    });
    const { data: existingAnswer } = await admin
      .from('answers')
      .select('id')
      .eq('user_id', id)
      .eq('question_id', questionId)
      .maybeSingle();
    if (existingAnswer) {
      console.log(`Skip ${name} — already has today's answer`);
      continue;
    }

    const videoId = crypto.randomUUID();
    await admin.from('videos').insert({
      id: videoId,
      user_id: id,
      question_id: questionId,
      status: 'ready',
      mux_playback_id: `demo-feed-${i}`,
      duration_seconds: 12,
      captions_status: 'ready',
      caption_segments: [{ start: 0, end: 12, text: `Hi, I'm ${name}. This is my answer for today's question.` }],
      submitted_at: new Date().toISOString(),
    });
    await admin.from('answers').insert({
      user_id: id,
      question_id: questionId,
      video_id: videoId,
      duration_seconds: 12,
      caption_text: `Hi, I'm ${name}. This is my answer for today's question.`,
      status: 'live',
    });
    console.log(`Seeded ${name} (feed-demo-${i + 1}@${DOMAIN})`);
  }
  console.log('Done. Demo password for feed-demo-* accounts:', PASSWORD);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
