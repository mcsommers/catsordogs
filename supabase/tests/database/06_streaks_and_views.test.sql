-- Phase 4 rules: streaks, answer view counts, profile view counts.
begin;
select plan(58);

delete from public.answers;
delete from public.videos;
delete from public.questions;
insert into public.questions (question_date, text)
select public.utc_today() - n, 'Question ' || n from generate_series(0, 8) n;

create function pg_temp.uid(n int) returns uuid language sql
as $$ select ('d' || lpad(n::text, 7, '0') || '-0000-0000-0000-000000000000')::uuid $$;

create function pg_temp.claims(n int) returns text language sql
as $$ select json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text $$;

create function pg_temp.person(n int, label text, finished boolean default true) returns void language plpgsql as $$
begin
  insert into auth.users (id, email, aud, role, instance_id)
  values (pg_temp.uid(n), label || '@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  update public.profiles set first_name = label, gender = 'Woman', birthday = '1995-05-05',
         profile_completed_at = case when finished then now() end where id = pg_temp.uid(n);
end $$;

-- answers on the given days-ago list
create function pg_temp.answers_on(n int, days int[]) returns void language plpgsql as $$
declare
  d int;
  vid uuid;
  qid uuid;
begin
  foreach d in array days loop
    vid := gen_random_uuid();
    qid := (select id from public.questions where question_date = public.utc_today() - d);
    insert into public.videos (id, user_id, question_id, status, mux_playback_id, duration_seconds, captions_status,
                               auto_caption_segments, caption_segments, submitted_at)
    values (vid, pg_temp.uid(n), qid, 'ready', 'pb-' || vid, 10, 'ready', '[]', '[]', now());
    insert into public.answers (user_id, question_id, video_id, duration_seconds)
    values (pg_temp.uid(n), qid, vid, 10);
  end loop;
end $$;

-- 1 V viewer (answered today)   2 S0 no answers   3 S1 today only   4 S3 today, -1, -2
-- 5 S1b gap yesterday (today, -2, -3)   6 S2y not yet today (-1, -2)   7 SOld only 3 days ago
-- 8 SBig 0..7 (eight days)   9 Blocker (blocks V)   10 U unfinished   11 Other viewer   12 Locked (not answered)
select pg_temp.person(1, 'V');  select pg_temp.answers_on(1, array[0]);
select pg_temp.person(2, 'S0');
select pg_temp.person(3, 'S1'); select pg_temp.answers_on(3, array[0]);
select pg_temp.person(4, 'S3'); select pg_temp.answers_on(4, array[0, 1, 2]);
select pg_temp.person(5, 'S1b'); select pg_temp.answers_on(5, array[0, 2, 3]);
select pg_temp.person(6, 'S2y'); select pg_temp.answers_on(6, array[1, 2]);
select pg_temp.person(7, 'SOld'); select pg_temp.answers_on(7, array[3]);
select pg_temp.person(8, 'SBig'); select pg_temp.answers_on(8, array[0, 1, 2, 3, 4, 5, 6, 7]);
select pg_temp.person(9, 'Blocker'); select pg_temp.answers_on(9, array[0]);
select pg_temp.person(10, 'U', false);
select pg_temp.person(11, 'Other'); select pg_temp.answers_on(11, array[0]);
select pg_temp.person(12, 'Locked');
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.uid(9), pg_temp.uid(1));

create temp table ids (name text primary key, id uuid not null);
grant select on ids to public;
insert into ids select case user_id when pg_temp.uid(3) then 's1_answer' when pg_temp.uid(9) then 'blocker_answer' else 'v_answer' end, id
  from public.answers where user_id in (pg_temp.uid(1), pg_temp.uid(3), pg_temp.uid(9));

-- ---------------------------------------------------------------------------
-- Streaks (counted in UTC days)
-- ---------------------------------------------------------------------------
select is(private.streak_days(pg_temp.uid(2)), 0, 'no answers: streak 0');
select is(private.streak_days(pg_temp.uid(3)), 1, 'answered today only: streak 1');
select is(private.streak_days(pg_temp.uid(4)), 3, 'answered today and the two days before: streak 3');
select is(private.streak_days(pg_temp.uid(5)), 1, 'missing yesterday resets the streak: only today counts');
select is(private.streak_days(pg_temp.uid(6)), 2, 'not answered yet today: the streak still counts up to yesterday');
select is(private.streak_days(pg_temp.uid(7)), 0, 'a day with no answer, then another day with none: streak back to 0');
select is(private.streak_days(pg_temp.uid(8)), 8, 'a longer run counts every day');

-- answering later the same day keeps the run
select pg_temp.answers_on(6, array[0]);
select is(private.streak_days(pg_temp.uid(6)), 3, 'answering later on the same day keeps the streak going');

set local role anon;
select throws_ok($$select public.get_streak()$$, '42501', null, 'a signed-out visitor cannot read streaks');
select throws_ok($$select public.record_profile_view('d0000002-0000-0000-0000-000000000000')$$, '42501', null,
  'a signed-out visitor cannot record a profile view');
select throws_ok($$select * from public.get_my_answers()$$, '42501', null, 'a signed-out visitor cannot read answers');
select throws_ok($$select public.record_answer_view(gen_random_uuid())$$, '42501', null, 'a signed-out visitor cannot report a view');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select is(public.get_streak(), 1, 'a user sees their own streak');
select is(public.get_streak('d0000004-0000-0000-0000-000000000000'), 3, 'a streak is public to other signed-in users');
select is(public.get_streak('d0000009-0000-0000-0000-000000000000'), null, 'a streak is hidden when the other person has blocked you');
select is(public.get_streak('d000000a-0000-0000-0000-000000000000'), null, 'a streak is hidden for an unfinished profile');
select is((select streak_days from public.get_feed(50, 0, public.utc_today()) where first_name = 'S3'), 3, 'the feed carries each person''s streak');
select is((select streak_days from public.get_feed(50, 0, public.utc_today()) where first_name = 'SBig'), 8, 'including a long streak');

-- ---------------------------------------------------------------------------
-- Answer views: counted only after the minimum watch time (default 3 seconds)
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', pg_temp.claims(3), true);
set local role authenticated;
select is((select view_count from public.get_my_answers()), 0::bigint, 'a new answer has no views');

-- V (gate open) is given a link to S1's answer
reset role;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select is((select count(*) from public.get_answer_for_playback((select id from ids where name = 's1_answer'))), 1::bigint,
  'V can watch S1''s answer');
select is(public.record_answer_view((select id from ids where name = 's1_answer')), false,
  'reporting a view straight away does not count: the minimum watch time has not passed');
select is((select count(*) from public.get_answer_for_playback((select id from ids where name = 's1_answer'))), 1::bigint,
  'asking for the link again is fine');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(3), true);
set local role authenticated;
select is((select view_count from public.get_my_answers()), 0::bigint, 'getting a link alone is not a view');

-- three seconds later
reset role;
update public.answer_views set link_issued_at = clock_timestamp() - interval '3 seconds' where viewer_id = pg_temp.uid(1);
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select is(public.record_answer_view((select id from ids where name = 's1_answer')), true, 'after the minimum watch time the view counts');
select is(public.record_answer_view((select id from ids where name = 's1_answer')), true, 'reporting it again changes nothing');
select is((select count(*) from public.get_answer_for_playback((select id from ids where name = 's1_answer'))), 1::bigint,
  'watching it again is allowed');
select is(public.record_answer_view((select id from ids where name = 's1_answer')), true, 'and still counts once');

-- cannot report a view without being given a link, or for videos you cannot see
select is_empty($$select * from public.get_answer_for_playback((select id from ids where name = 'blocker_answer'))$$,
  'V cannot watch a video of someone who blocked them');
select is(public.record_answer_view((select id from ids where name = 'blocker_answer')), false,
  'and cannot report a view of it');
select is(public.record_answer_view((select id from ids where name = 'blocker_answer')), false, 'repeating it still reveals nothing');
select is(public.record_answer_view(gen_random_uuid()), false, 'an unknown answer is just not counted');
select is((select count(*) from public.get_answer_for_playback((select id from ids where name = 'v_answer'))), 1::bigint,
  'V can watch their own answer');
select is(public.record_answer_view((select id from ids where name = 'v_answer')), false, 'watching your own answer never counts');

-- the minimum watch time is an admin setting, read from app_settings
reset role;
update public.app_settings set min_watch_seconds = 6;
select set_config('request.jwt.claims', pg_temp.claims(8), true);
set local role authenticated;
select is((select count(*) from public.get_answer_for_playback((select id from ids where name = 's1_answer'))), 1::bigint, 'SBig is given a link');
reset role;
update public.answer_views set link_issued_at = clock_timestamp() - interval '5 seconds' where viewer_id = pg_temp.uid(8);
select set_config('request.jwt.claims', pg_temp.claims(8), true);
set local role authenticated;
select is(public.record_answer_view((select id from ids where name = 's1_answer')), false, 'with a 6 second setting, 5 seconds is not enough');
reset role;
update public.answer_views set link_issued_at = clock_timestamp() - interval '7 seconds' where viewer_id = pg_temp.uid(8);
select set_config('request.jwt.claims', pg_temp.claims(8), true);
set local role authenticated;
select is(public.record_answer_view((select id from ids where name = 's1_answer')), true, 'and 7 seconds is');

-- a viewer who has since been blocked cannot add a view
reset role;
select set_config('request.jwt.claims', pg_temp.claims(4), true);
set local role authenticated;
select is((select count(*) from public.get_answer_for_playback((select id from ids where name = 's1_answer'))), 1::bigint, 'S3 is given a link');
reset role;
update public.answer_views set link_issued_at = clock_timestamp() - interval '7 seconds' where viewer_id = pg_temp.uid(4);
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.uid(3), pg_temp.uid(4));
select set_config('request.jwt.claims', pg_temp.claims(4), true);
set local role authenticated;
select is(public.record_answer_view((select id from ids where name = 's1_answer')), false, 'a viewer blocked after getting the link cannot add a view');

-- a second person, with the setting back at 0
reset role;
update public.app_settings set min_watch_seconds = 0;
select set_config('request.jwt.claims', pg_temp.claims(11), true);
set local role authenticated;
select is((select count(*) from public.get_answer_for_playback((select id from ids where name = 's1_answer'))), 1::bigint,
  'a second person watches S1''s answer');
select is(public.record_answer_view((select id from ids where name = 's1_answer')), true, 'with no minimum, the view counts straight away');

-- a person behind the gate cannot watch, so cannot add a view
reset role;
select set_config('request.jwt.claims', pg_temp.claims(12), true);
set local role authenticated;
select is_empty($$select * from public.get_answer_for_playback((select id from ids where name = 's1_answer'))$$,
  'someone who has not answered cannot watch');
select is(public.record_answer_view((select id from ids where name = 's1_answer')), false, 'and cannot report a view');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(3), true);
set local role authenticated;
select is((select view_count from public.get_my_answers()), 3::bigint, 'the owner sees only the counted views, one per different person');
select is((select count(*) from public.get_my_answers()), 1::bigint, 'the owner sees only their own answers');
select is((select question_text from public.get_my_answers()), 'Question 0', 'each of their answers says which question it is for');
select throws_ok($$select * from public.answer_views$$, '42501', null, 'the app cannot read who viewed an answer');
select throws_ok($$insert into public.answer_views (answer_id, viewer_id) select id, user_id from public.answers$$, '42501', null,
  'the app cannot write answer views');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(4), true);
set local role authenticated;
select is((select view_count from public.get_my_answers() where question_date = public.utc_today()), 0::bigint, 'other people''s views do not leak to other users');

-- ---------------------------------------------------------------------------
-- Profile views
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select lives_ok($$select public.record_profile_view('d0000003-0000-0000-0000-000000000000')$$, 'V opens S1''s profile');
select lives_ok($$select public.record_profile_view('d0000003-0000-0000-0000-000000000000')$$, 'and opens it again');
select lives_ok($$select public.record_profile_view('d0000001-0000-0000-0000-000000000000')$$, 'opening your own profile is ignored, not an error');
select lives_ok($$select public.record_profile_view('d0000009-0000-0000-0000-000000000000')$$, 'opening a profile that blocked you is ignored silently');
select lives_ok($$select public.record_profile_view('d000000a-0000-0000-0000-000000000000')$$, 'opening an unfinished profile is ignored silently');
select is(public.get_my_profile_view_count(), 0::bigint, 'V''s own profile has no views yet');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(11), true);
set local role authenticated;
select lives_ok($$select public.record_profile_view('d0000003-0000-0000-0000-000000000000')$$, 'a second person opens S1''s profile');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(3), true);
set local role authenticated;
select is(public.get_my_profile_view_count(), 2::bigint, 'S1 sees a count of different people (opening twice counts once)');
select throws_ok($$select * from public.profile_views$$, '42501', null, 'the app cannot read who viewed a profile');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(9), true);
set local role authenticated;
select is(public.get_my_profile_view_count(), 0::bigint, 'a person who blocked V gets no view from V');

select * from finish();
rollback;
