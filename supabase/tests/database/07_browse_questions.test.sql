-- Phase 4 (addition): Browse Questions and question search.
begin;
select plan(17);

delete from public.answers;
delete from public.videos;
delete from public.questions;
insert into public.questions (question_date, text) values
  (public.utc_today() + 1, 'Tomorrow: a secret question'),
  (public.utc_today(), 'Cats or dogs? Make your case.'),
  (public.utc_today() - 1, 'What are your thoughts on graffiti?'),
  (public.utc_today() - 2, 'Describe your perfect lazy Sunday.'),
  (public.utc_today() - 3, '100% sure? Use_underscores'),
  (public.utc_today() - 4, 'Who is your favorite cat or dog?');

insert into auth.users (id, email, aud, role, instance_id) values
  ('d0000001-0000-0000-0000-000000000000', 'a@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('d0000002-0000-0000-0000-000000000000', 'b@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('d0000003-0000-0000-0000-000000000000', 'c@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
update public.profiles set profile_completed_at = now(), first_name = 'x', gender = 'Woman', birthday = '1995-05-05';

-- two live answers and one disabled answer to yesterday's question; one live answer today
create function pg_temp.ans(u uuid, days_ago int, st text) returns void language plpgsql as $$
declare vid uuid := gen_random_uuid(); q uuid := (select id from public.questions where question_date = public.utc_today() - days_ago);
begin
  insert into public.videos (id, user_id, question_id, status, mux_playback_id, duration_seconds, captions_status, caption_segments, submitted_at)
  values (vid, u, q, 'ready', 'pb', 5, 'unavailable', '[]', now());
  insert into public.answers (user_id, question_id, video_id, duration_seconds, status) values (u, q, vid, 5, st);
end $$;
select pg_temp.ans('d0000001-0000-0000-0000-000000000000', 0, 'live');
select pg_temp.ans('d0000001-0000-0000-0000-000000000000', 1, 'live');
select pg_temp.ans('d0000002-0000-0000-0000-000000000000', 1, 'live');
select pg_temp.ans('d0000003-0000-0000-0000-000000000000', 1, 'disabled');

set local role anon;
select throws_ok($$select * from public.browse_questions()$$, '42501', null, 'a signed-out visitor cannot browse questions');

reset role;
select set_config('request.jwt.claims', '{"sub":"d0000003-0000-0000-0000-000000000000","role":"authenticated"}', true);
set local role authenticated;
-- user three's only answer is for yesterday and was disabled; they have not answered today
select is_empty($$select * from public.browse_questions()$$, 'browsing questions is behind the daily gate');

reset role;
select set_config('request.jwt.claims', '{"sub":"d0000001-0000-0000-0000-000000000000","role":"authenticated"}', true);
set local role authenticated;
select is((select array_agg(question_text) from public.browse_questions()),
  array['Cats or dogs? Make your case.', 'What are your thoughts on graffiti?', 'Describe your perfect lazy Sunday.', '100% sure? Use_underscores', 'Who is your favorite cat or dog?'],
  'questions are listed newest first, today and earlier only (never the calendar ahead)');
select is((select response_count from public.browse_questions() where question_date = public.utc_today() - 1), 2::bigint,
  'the response count is the number of live answers (disabled ones are not counted)');
select is((select response_count from public.browse_questions() where question_date = public.utc_today() - 2), 0::bigint, 'a question with no answers shows zero');
select is((select array_agg(is_today) from public.browse_questions() where question_date >= public.utc_today() - 1), array[true, false], 'today''s question is marked');
select is((select max(total_count) from public.browse_questions()), 5::bigint, 'the total is reported');
select is((select count(*) from public.browse_questions(null, 2, 0)), 2::bigint, 'paging: page size');
select is((select question_text from public.browse_questions(null, 2, 4)), 'Who is your favorite cat or dog?', 'paging: offset');
select is((select array_agg(question_text) from public.browse_questions('CAT')),
  array['Cats or dogs? Make your case.', 'Who is your favorite cat or dog?'], 'search ignores case and matches inside words');
select is((select array_agg(question_text) from public.browse_questions('cat dog favorite')), array['Who is your favorite cat or dog?'],
  'every typed word must match');
select is((select count(*) from public.browse_questions('secret')), 0::bigint, 'search never finds scheduled future questions');
select is((select count(*) from public.browse_questions('zzz')), 0::bigint, 'no match returns nothing');
select is((select count(*) from public.browse_questions('%')), 1::bigint, 'a percent sign is matched literally, not as a wildcard');
select is((select count(*) from public.browse_questions('_')), 1::bigint, 'an underscore is matched literally');
select is((select count(*) from public.browse_questions('   ')), 5::bigint, 'blank search text lists everything');
select is((select count(*) from public.browse_questions(repeat('a', 5000))), 0::bigint, 'very long search text is handled');

select * from finish();
rollback;
