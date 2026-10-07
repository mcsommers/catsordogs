-- 20 sample daily questions: one for today and each of the next 19 days (UTC).
-- Placeholders for an admin to edit once the admin panel exists.
--
-- Safe to run more than once: days that already have a question are left alone.
-- Loaded automatically on `npm run db:reset`. To add them to staging or
-- production (where seed.sql never runs), paste this file into that project's
-- SQL editor and run it, or: npx supabase db query --linked -f supabase/sample_questions.sql
-- Past questions can never be changed, so only run this where you are happy
-- for these to go live on the dates shown.

insert into public.questions (question_date, text)
select (now() at time zone 'utc')::date + (n - 1)::int, q
from unnest(array[
  'Cats or dogs? Make your case.',
  'What would you do with a free day in a new city?',
  'What''s a tradition you''d never give up?',
  'What''s the kindest thing a stranger has done for you?',
  'What song is on repeat for you right now?',
  'What''s your most useless talent?',
  'What does a good friendship look like to you?',
  'What''s a small thing that always makes your day better?',
  'Describe your ideal Saturday morning.',
  'What''s the best piece of advice you''ve ever been given?',
  'What''s something you''re proud of that no one knows about?',
  'What''s a food you could eat every day for a week?',
  'What''s the most spontaneous thing you''ve ever done?',
  'Who in your life makes you laugh the most, and why?',
  'What''s a place that feels like home to you?',
  'What''s a hobby you''d pick up if time were no issue?',
  'What''s a movie or show you can watch over and over?',
  'What''s something you''re learning right now?',
  'What does being a good partner mean to you?',
  'What''s a risk you took that paid off?'
]) with ordinality as t(q, n)
on conflict (question_date) do nothing;
