-- Phase 4 rules: submitting an answer, the daily gate, the feed (filters,
-- ranking, day rollover, paging), blocks, Not Interested, ranking settings,
-- locations, and who can read what.
-- (Followed-first ordering and its cap are in 05_feed_followed_cap.test.sql.)
begin;
select plan(133);

delete from public.answers;
delete from public.videos;
delete from public.questions;
insert into public.questions (question_date, text) values
  (public.utc_today(), 'Today''s question'),
  (public.utc_today() - 1, 'Yesterday''s question'),
  (public.utc_today() - 3, 'Question three days ago'),
  (public.utc_today() - 10, 'Question ten days ago');

-- ---------------------------------------------------------------------------
-- Test helpers (they vanish when the test ends)
-- ---------------------------------------------------------------------------
create function pg_temp.uid(n int) returns uuid language sql
as $$ select ('b' || lpad(n::text, 7, '0') || '-0000-0000-0000-000000000000')::uuid $$;

create function pg_temp.claims(n int) returns text language sql
as $$ select json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text $$;

create function pg_temp.person(n int, label text, p_gender text, p_age int, p_height int, p_interests text[],
                               p_job text, p_lat double precision, p_lng double precision, finished boolean default true)
returns void language plpgsql as $$
begin
  insert into auth.users (id, email, aud, role, instance_id)
  values (pg_temp.uid(n), label || '@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  update public.profiles set
    first_name = label, gender = p_gender, birthday = (current_date - make_interval(years => p_age) - interval '10 days')::date,
    height_cm = p_height, interests = p_interests, job_title = p_job, latitude = p_lat, longitude = p_lng,
    profile_completed_at = case when finished then now() end
  where id = pg_temp.uid(n);
end $$;

-- A recording for the question from p_days_ago days back.
create function pg_temp.video(n int, p_days_ago int, p_status text, p_captions text, p_words text default 'a b c')
returns uuid language plpgsql as $$
declare
  vid uuid := gen_random_uuid();
begin
  insert into public.videos (id, user_id, question_id, status, mux_playback_id, duration_seconds, captions_status,
                             auto_caption_segments, caption_segments)
  values (vid, pg_temp.uid(n), (select id from public.questions where question_date = public.utc_today() - p_days_ago),
          p_status, 'pb-' || vid, 10, p_captions,
          case when p_captions = 'ready' then jsonb_build_array(jsonb_build_object('start', 0, 'end', 5, 'text', p_words)) end,
          case when p_captions = 'ready' then jsonb_build_array(jsonb_build_object('start', 0, 'end', 5, 'text', p_words)) end);
  return vid;
end $$;

-- A finished answer (as if submitted at noon UTC on that day).
create function pg_temp.answer(n int, p_days_ago int, p_words text default 'a b c', p_status text default 'live')
returns uuid language plpgsql as $$
declare
  vid uuid := pg_temp.video(n, p_days_ago, 'ready', 'ready', p_words);
  aid uuid := gen_random_uuid();
  qd date := public.utc_today() - p_days_ago;
begin
  update public.videos set submitted_at = (qd::timestamp at time zone 'utc') + interval '12 hours' where id = vid;
  insert into public.answers (id, user_id, question_id, video_id, duration_seconds, caption_text, status, submitted_at)
  values (aid, pg_temp.uid(n), (select id from public.questions where question_date = qd), vid, 10, p_words, p_status,
          (qd::timestamp at time zone 'utc') + interval '12 hours');
  return aid;
end $$;

create temp table ids (name text primary key, id uuid not null);
grant select on ids to public;

-- ---------------------------------------------------------------------------
-- People
--  01 V viewer           02 W1 Woman 30    03 W2 Woman 25 (Boston)   04 M1 Man 35   05 N1 Non-binary 28
--  06 X1 (V blocks)      07 X2 (blocks V)  08 X3 (Not Interested)    09 X4 answer disabled
--  10 X5 answer removed  11 X6 unfinished profile                    12 W no answer yet
--  13 U unfinished       14 OLD answered 10 days ago                 15 D3 answered 3 days ago
-- ---------------------------------------------------------------------------
select pg_temp.person(1, 'V', 'Woman', 29, 165, array['Hiking', 'Coffee'], 'Designer', 40.7128, -74.0060);
update public.profiles set relationship_goal = 'Long-term relationship', lifestyle_tags = array['Dog lover'] where id = pg_temp.uid(1);
select pg_temp.person(2, 'W1', 'Woman', 30, 170, array['Hiking', 'Coffee'], 'Nurse', 40.73, -73.99);
select pg_temp.person(3, 'W2', 'Woman', 25, 160, array['Movies'], 'Teacher', 42.36, -71.06);
select pg_temp.person(4, 'M1', 'Man', 35, 185, array['Hiking'], 'Chef', null, null);
select pg_temp.person(5, 'N1', 'Non-binary', 28, 175, array['Yoga'], 'Writer', null, null);
select pg_temp.person(6, 'X1', 'Woman', 31, 168, array['Hiking'], 'Vet', 40.74, -73.98);
select pg_temp.person(7, 'X2', 'Woman', 32, 168, array['Hiking'], 'Vet', 40.75, -73.97);
select pg_temp.person(8, 'X3', 'Woman', 33, 168, array['Hiking'], 'Vet', 40.76, -73.96);
select pg_temp.person(9, 'X4', 'Woman', 34, 168, array['Hiking'], 'Vet', null, null);
select pg_temp.person(10, 'X5', 'Woman', 35, 168, array['Hiking'], 'Vet', null, null);
select pg_temp.person(11, 'X6', 'Woman', 36, 168, array['Hiking'], 'Vet', null, null, false);
select pg_temp.person(12, 'W', 'Woman', 27, 165, '{}', null, null, null);
select pg_temp.person(13, 'U', 'Woman', 27, 165, '{}', null, null, null, false);
select pg_temp.person(14, 'OLD', 'Woman', 40, 165, '{}', null, null, null);
select pg_temp.person(15, 'D3', 'Woman', 41, 165, '{}', null, null, null);


-- No question scheduled today
delete from public.questions where question_date = public.utc_today();
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select is((select state from public.get_gate_status()), 'no_question_today', 'the gate reports when no question is scheduled');
select is_empty($$select * from public.get_feed(50)$$, 'no question today means no feed');
reset role;
insert into public.questions (question_date, text) values (public.utc_today(), 'Today''s question');

select pg_temp.answer(2, 0);  select pg_temp.answer(2, 1);
select pg_temp.answer(3, 0);
select pg_temp.answer(4, 0);  select pg_temp.answer(4, 1);
select pg_temp.answer(5, 0);
select pg_temp.answer(6, 0);
select pg_temp.answer(7, 0);
select pg_temp.answer(8, 0);
select pg_temp.answer(9, 0, 'a b c', 'disabled');
select pg_temp.answer(10, 0, 'a b c', 'removed');
select pg_temp.answer(11, 0);
select pg_temp.answer(14, 10);
select pg_temp.answer(15, 3);
insert into ids select 'w1_answer', id from public.answers where user_id = pg_temp.uid(2) and question_id = (select id from public.questions where question_date = public.utc_today());
insert into ids select 'x1_answer', id from public.answers where user_id = pg_temp.uid(6);
insert into ids select 'x4_answer', id from public.answers where user_id = pg_temp.uid(9);
insert into ids select 'x5_answer', id from public.answers where user_id = pg_temp.uid(10);
insert into ids values
  ('ok_video', pg_temp.video(1, 0, 'ready', 'ready', 'Hello world')),
  ('ok_video2', pg_temp.video(1, 0, 'ready', 'ready')),
  ('pending_video', pg_temp.video(1, 0, 'ready', 'pending')),
  ('unavailable_video', pg_temp.video(1, 0, 'ready', 'unavailable')),
  ('processing_video', pg_temp.video(1, 0, 'processing', 'pending')),
  ('yesterday_video', pg_temp.video(1, 1, 'ready', 'ready')),
  ('other_users_video', pg_temp.video(12, 0, 'ready', 'ready'));

-- ---------------------------------------------------------------------------
-- The daily gate: before V has answered
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$select * from public.get_gate_status()$$, '42501', null, 'a signed-out visitor cannot ask about the gate');
select throws_ok($$select * from public.get_feed()$$, '42501', null, 'a signed-out visitor cannot read the feed');
select throws_ok($$select public.submit_answer(gen_random_uuid())$$, '42501', null, 'a signed-out visitor cannot submit an answer');
select throws_ok($$select * from public.get_answer_for_playback(gen_random_uuid())$$, '42501', null,
  'a signed-out visitor cannot get a playback id');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select is((select state from public.get_gate_status()), 'not_answered', 'the gate is closed before answering');
select is((select question_text from public.get_gate_status()), 'Today''s question', 'the gate screen can show today''s question');
select is_empty($$select * from public.get_feed(50)$$, 'the feed returns nothing before the user answers');
select is_empty($$select * from public.get_feed(50, 0, public.utc_today() - 1)$$, 'the feed returns nothing for a past day either');
select is_empty($$select * from public.get_answer_for_playback((select id from ids where name = 'w1_answer'))$$,
  'someone else''s video cannot be played while the gate is closed');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(13), true);
set local role authenticated;
select is((select state from public.get_gate_status()), 'profile_incomplete', 'the gate is closed for an unfinished profile');
select is_empty($$select * from public.get_feed(50)$$, 'an unfinished profile gets no feed');

-- ---------------------------------------------------------------------------
-- Submitting an answer
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', pg_temp.claims(13), true);
set local role authenticated;
select throws_ok($$select public.submit_answer((select id from ids where name = 'ok_video'))$$, '23514',
  'Finish your profile before answering.', 'an unfinished profile cannot submit an answer');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select throws_ok($$select public.submit_answer((select id from ids where name = 'other_users_video'))$$, 'P0002', 'Video not found.',
  'a user cannot submit someone else''s recording');
select throws_ok($$select public.submit_answer(gen_random_uuid())$$, 'P0002', 'Video not found.', 'an unknown recording cannot be submitted');
select throws_ok($$select public.submit_answer((select id from ids where name = 'yesterday_video'))$$, '23514',
  'That recording is not for today''s question.', 'a recording for an earlier question cannot be submitted');
select throws_ok($$select public.submit_answer((select id from ids where name = 'processing_video'))$$, '23514',
  'That recording is not ready yet.', 'a recording that is still processing cannot be submitted');
select throws_ok($$select public.submit_answer((select id from ids where name = 'pending_video'))$$, '23514',
  'Your captions are still being prepared. Try again in a moment.', 'the user waits while captions are still being prepared');
select is((select count(*) from public.answers), 0::bigint, 'nothing was submitted by those failed attempts');
select is((select state from public.get_gate_status()), 'not_answered', 'the gate is still closed after failed attempts');

select lives_ok($$select public.submit_answer((select id from ids where name = 'unavailable_video'))$$,
  'a recording whose captions are unavailable (no speech) can be submitted');
reset role;
-- (put that one back so V can submit the main recording below)
delete from public.answers where user_id = pg_temp.uid(1);
update public.videos set submitted_at = null where user_id = pg_temp.uid(1);
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;

create temp table submitted as select public.submit_answer((select id from ids where name = 'ok_video')) as answer_id;
grant select on submitted to public;
select is((select count(*) from submitted), 1::bigint, 'a ready recording with captions can be submitted');
select is((select caption_text from public.answers where id = (select answer_id from submitted)), 'Hello world',
  'the caption words are kept for ranking');
select is((select status from public.answers where id = (select answer_id from submitted)), 'live', 'a submitted answer is live');
select isnt((select submitted_at from public.videos where id = (select id from ids where name = 'ok_video')), null,
  'submitting marks the recording as the answer');
select is((select state from public.get_gate_status()), 'open', 'the gate opens once the answer is submitted');
select throws_ok($$select public.submit_answer((select id from ids where name = 'ok_video2'))$$, '23514',
  'You have already answered today''s question.', 'a second answer to the same question is refused');
select throws_ok($$select public.update_caption_segments((select id from ids where name = 'ok_video'), array['changed'])$$,
  '23514', 'Captions cannot be edited after the answer is submitted.', 'captions are locked once submitted');
select throws_ok($$select * from public.request_video_upload()$$, '23514', 'You have already answered today''s question.',
  'no new recording can be started after submitting');

select throws_ok($$update public.answers set status = 'removed'$$, '42501', null, 'a user cannot edit an answer');
select throws_ok($$delete from public.answers$$, '42501', null, 'a user cannot delete an answer');
select throws_ok($$insert into public.answers (user_id, question_id, video_id, duration_seconds) select user_id, question_id, id, 5 from public.videos$$,
  '42501', null, 'a user cannot create an answer directly');
select is((select count(*) from public.answers), 1::bigint, 'a user reads only their own answers');
select is_empty($$select * from public.answers where user_id = 'b0000002-0000-0000-0000-000000000000'$$,
  'a user cannot read someone else''s answer row');

-- ---------------------------------------------------------------------------
-- The feed (default filters, everyone medium)
-- ---------------------------------------------------------------------------
select is((select array_agg(first_name order by first_name) from public.get_feed(50, 0, public.utc_today())),
  array['M1', 'N1', 'W1', 'W2', 'X1', 'X2', 'X3'],
  'today''s feed has everyone who answered, minus disabled, removed, unfinished profiles and the viewer');
select is((select array_agg(first_name order by first_name) from public.get_feed(50, 0, public.utc_today() - 1)),
  array['M1', 'W1'], 'a past day can be shown on its own');
select is_empty($$select * from public.get_feed(50, 0, public.utc_today() + 1)$$, 'the future has no feed');
select is((select array_agg(question_date) from public.get_feed(50)),
  array[public.utc_today(), public.utc_today(), public.utc_today(), public.utc_today(), public.utc_today(), public.utc_today(), public.utc_today(),
        public.utc_today() - 1, public.utc_today() - 1, public.utc_today() - 3],
  'the feed continues from today into earlier days, newest day first, within the look-back');
select is((select question_text from public.get_feed(1)), 'Today''s question', 'each row says which question it answers');
select ok((select bool_and(caption_segments is not null and caption_text <> '' and duration_seconds > 0) from public.get_feed(50)),
  'each row carries its captions and length');
select is((select distance_miles from public.get_feed(50, 0, public.utc_today()) where first_name = 'W1'), 1,
  'distance is shown rounded to whole miles');
select is((select distance_miles from public.get_feed(50, 0, public.utc_today()) where first_name = 'M1'), null,
  'no distance is shown for someone with no location');
select ok(not exists (select 1 from public.get_feed(50) where first_name in ('X4', 'X5', 'X6', 'V')),
  'disabled, removed, unfinished and own answers are never in the feed');
select is((select count(*) from information_schema.columns
           where table_schema = 'public' and table_name = 'profiles' and column_name in ('latitude', 'longitude')), 2::bigint,
  'profiles store a location');
select is((select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = 'get_feed' and pg_get_function_result(p.oid) ~* 'latitude|longitude|email'), 0::bigint,
  'the feed never returns coordinates or email');

-- Look-back days come from the admin setting
reset role;
update public.app_settings set feed_lookback_days = 0;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select is((select count(distinct question_date) from public.get_feed(50)), 1::bigint, 'look-back 0 shows only today');
reset role;
update public.app_settings set feed_lookback_days = 2;
set local role authenticated;
select is((select count(distinct question_date) from public.get_feed(50)), 2::bigint, 'look-back 2 reaches yesterday but not 3 days ago');
reset role;
update public.app_settings set feed_lookback_days = 14;
set local role authenticated;
select is((select count(distinct question_date) from public.get_feed(50)), 4::bigint, 'look-back 14 reaches 10 days ago');
reset role;
update public.app_settings set feed_lookback_days = 7;
set local role authenticated;
select ok(not exists (select 1 from public.get_feed(50) where first_name = 'OLD'), 'the default 7-day look-back excludes 10 days ago');

-- Paging
select is((select count(*) from public.get_feed(3, 0)), 3::bigint, 'paging: the first page has the requested size');
select is((select max(total_count) from public.get_feed(3, 0)), 10::bigint, 'paging: the total is reported');
select is((select array_agg(answer_id order by answer_id) from (select answer_id from public.get_feed(5, 0) union all select answer_id from public.get_feed(5, 5)) x),
  (select array_agg(answer_id order by answer_id) from public.get_feed(50)), 'paging: pages do not overlap or skip');
select is_empty($$select * from public.get_feed(5, 50)$$, 'paging: past the end is empty');
select is((select count(*) from public.get_feed(1000)), 10::bigint, 'an oversized page request is capped, not an error');

-- ---------------------------------------------------------------------------
-- Filters (all stored in the viewer's own filter_preferences row)
-- ---------------------------------------------------------------------------
create function pg_temp.filtered(f jsonb) returns text[] language plpgsql as $$
declare r text[];
begin
  update public.filter_preferences set filters = f where user_id = pg_temp.uid(1);
  select array_agg(first_name order by first_name) into r from public.get_feed(50, 0, public.utc_today());
  return r;
end $$;

reset role;
select is(pg_temp.filtered('{"show_me":"Women"}'), array['W1', 'W2', 'X1', 'X2', 'X3'], 'filter: show me women');
select is(pg_temp.filtered('{"show_me":"Men"}'), array['M1'], 'filter: show me men');
select is(pg_temp.filtered('{"show_me":"Everyone"}'), array['M1', 'N1', 'W1', 'W2', 'X1', 'X2', 'X3'], 'filter: everyone shows all');
select is(pg_temp.filtered('{"age_range":{"min":26,"max":32}}'), array['N1', 'W1', 'X1', 'X2'], 'filter: age range');
select is(pg_temp.filtered('{"height_range":{"min":180,"max":200}}'), array['M1'], 'filter: height range');
select is(pg_temp.filtered('{"interests":["hiking"]}'), array['M1', 'W1', 'X1', 'X2', 'X3'], 'filter: interests (any overlap, ignoring case)');
select is(pg_temp.filtered('{"occupation":["Nurse","Chef"]}'), array['M1', 'W1'], 'filter: occupation');
select is(pg_temp.filtered('{"max_distance":10}'), array['W1', 'X1', 'X2', 'X3'], 'filter: maximum distance (people with no location are excluded)');
select is(pg_temp.filtered('{"show_me":"Women","max_distance":10,"interests":["Coffee"]}'), array['W1'], 'filters combine');
select is(pg_temp.filtered('{"interests":[]}'), array['M1', 'N1', 'W1', 'W2', 'X1', 'X2', 'X3'], 'an empty pick-list means Any');
update public.profiles set latitude = null, longitude = null where id = pg_temp.uid(1);
select is(pg_temp.filtered('{"max_distance":1}'), array['M1', 'N1', 'W1', 'W2', 'X1', 'X2', 'X3'],
  'the distance filter is skipped when the viewer has no location');
update public.profiles set latitude = 40.7128, longitude = -74.0060 where id = pg_temp.uid(1);
select is(pg_temp.filtered('{}'), array['M1', 'N1', 'W1', 'W2', 'X1', 'X2', 'X3'], 'clearing the filters shows everyone again');

-- ---------------------------------------------------------------------------
-- Ranking: the viewer's Low / Medium / High weights change the order
-- ---------------------------------------------------------------------------
update public.answers set caption_text = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo twentythree twentyfour twentyfive twentysix twentyseven twentyeight twentynine thirty thirtyone thirtytwo thirtythree thirtyfour thirtyfive thirtysix thirtyseven thirtyeight thirtynine forty'
  where user_id = pg_temp.uid(5);
set local role authenticated;
update public.feed_settings set shared_interests = 'high', relationship_goals = 'low', response_depth = 'low',
  lifestyle_compatibility = 'low', distance = 'low', recency = 'low';
select is((select first_name from public.get_feed(50, 0, public.utc_today()) limit 1), 'W1', 'ranking: high weight on shared interests puts the best interest match first');
update public.feed_settings set shared_interests = 'low', response_depth = 'high';
select is((select first_name from public.get_feed(50, 0, public.utc_today()) limit 1), 'N1', 'ranking: high weight on response depth puts the longest answer first');
update public.feed_settings set response_depth = 'low', distance = 'high';
select is((select first_name from public.get_feed(50, 0, public.utc_today()) offset 6 limit 1), 'W2', 'ranking: with high weight on distance, the farthest person is last');
select lives_ok($$select public.reset_feed_settings()$$, 'ranking can be reset to the recommended weights');
select is((select shared_interests || response_depth || distance from public.feed_settings), 'mediummediummedium', 'reset puts every signal back to Medium');
select throws_ok($$update public.feed_settings set recency = 'extreme'$$, '23514', null, 'a weight must be low, medium or high');
select is_empty($$update public.feed_settings set recency = 'high' where user_id = 'b0000002-0000-0000-0000-000000000000' returning 1$$,
  'a user cannot change someone else''s ranking settings');
select is((select count(*) from public.feed_settings), 1::bigint, 'a user reads only their own ranking settings');

-- ---------------------------------------------------------------------------
-- Blocks and Not Interested
-- ---------------------------------------------------------------------------
select throws_ok($$insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), 'b0000002-0000-0000-0000-000000000000')$$,
  '42501', null, 'a user cannot write the blocks table directly');
select throws_ok($$insert into public.not_interested (user_id, target_id) values (auth.uid(), 'b0000002-0000-0000-0000-000000000000')$$,
  '42501', null, 'a user cannot write the not-interested table directly');
select throws_ok($$select public.block_user(auth.uid())$$, '23514', 'Choose someone else.', 'you cannot block yourself');
select throws_ok($$select public.mark_not_interested(auth.uid())$$, '23514', 'Choose someone else.', 'you cannot mark yourself Not Interested');
select throws_ok($$select public.block_user(gen_random_uuid())$$, 'P0002', 'Person not found.', 'blocking an unknown person is refused');

reset role;
-- X2 blocks V (V is never told)
select set_config('request.jwt.claims', pg_temp.claims(7), true);
set local role authenticated;
select lives_ok($$select public.block_user('b0000001-0000-0000-0000-000000000000')$$, 'X2 can block V');
select lives_ok($$select public.block_user('b0000001-0000-0000-0000-000000000000')$$, 'blocking twice is harmless');
select ok(not exists (select 1 from public.get_feed(50) where first_name = 'V'), 'X2 no longer sees V in the feed');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select ok(not exists (select 1 from public.get_feed(50) where first_name = 'X2'),
  'V no longer sees X2, even though V did not block them (a block hides both ways)');
select is((select count(*) from public.blocks), 0::bigint, 'V cannot see that X2 blocked them');
select is_empty($$select * from public.list_blocked_and_not_interested()$$, 'nothing in V''s lists reveals the block');
select is_empty($$select * from public.get_answer_for_playback((select id from public.answers where user_id = 'b0000007-0000-0000-0000-000000000000'))$$,
  'V cannot play X2''s video (it looks exactly like a missing video)');

-- V blocks X1
select lives_ok($$select public.block_user('b0000006-0000-0000-0000-000000000000')$$, 'V can block X1');
select ok(not exists (select 1 from public.get_feed(50) where first_name = 'X1'), 'X1 disappears from V''s feed');
select is((select count(*) from public.blocks), 1::bigint, 'V can read their own block');
select is_empty($$select * from public.get_answer_for_playback((select id from ids where name = 'x1_answer'))$$,
  'V cannot play X1''s video');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(6), true);
set local role authenticated;
select ok(not exists (select 1 from public.get_feed(50) where first_name = 'V'), 'X1 does not see V either (hidden in both directions)');
select ok(exists (select 1 from public.get_feed(50) where first_name = 'W1'), 'X1 still sees everyone else');
select is((select count(*) from public.blocks), 0::bigint, 'X1 cannot read the table to find out V blocked them');
select is_empty($$select * from public.list_blocked_and_not_interested()$$, 'X1''s lists show nothing about it');
select is_empty($$select * from public.get_answer_for_playback((select id from public.answers where user_id = 'b0000001-0000-0000-0000-000000000000'))$$,
  'X1 cannot play V''s video');

-- Not Interested (even for someone V follows)
reset role;
insert into public.follows (follower_id, followed_id) values (pg_temp.uid(1), pg_temp.uid(8));
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select is((select is_followed from public.get_feed(50, 0, public.utc_today()) where first_name = 'X3'), true, 'a followed person is marked as followed');
select lives_ok($$select public.mark_not_interested('b0000008-0000-0000-0000-000000000000')$$, 'V can mark X3 Not Interested');
select ok(not exists (select 1 from public.get_feed(50) where first_name = 'X3'), 'a Not Interested person is hidden, even though V follows them');
select is((select count(*) from public.not_interested), 1::bigint, 'V can read their own Not Interested list');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(8), true);
set local role authenticated;
select ok(exists (select 1 from public.get_feed(50) where first_name = 'V'), 'Not Interested is one-way: X3 still sees V');
select is((select count(*) from public.not_interested), 0::bigint, 'X3 cannot see that V hid them');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select is((select array_agg(kind || ':' || first_name order by kind) from public.list_blocked_and_not_interested()),
  array['blocked:X1', 'not_interested:X3'], 'V''s list shows who they blocked and hid, and nobody else');
select ok((select bool_and(age is not null and created_at is not null) from public.list_blocked_and_not_interested()), 'each person in the list has an age and a date');

select lives_ok($$select public.undo_not_interested('b0000008-0000-0000-0000-000000000000')$$, 'V can undo Not Interested');
select ok(exists (select 1 from public.get_feed(50) where first_name = 'X3'), 'the person is back in the feed after Undo');
select lives_ok($$select public.unblock_user('b0000006-0000-0000-0000-000000000000')$$, 'V can unblock X1');
select ok(exists (select 1 from public.get_feed(50) where first_name = 'X1'), 'X1 is back in the feed after Unblock');
select ok(not exists (select 1 from public.get_feed(50) where first_name = 'X2'), 'X2 stays hidden because X2''s own block is still in place');
select lives_ok($$select public.block_user('b0000007-0000-0000-0000-000000000000')$$, 'V can also block X2');
select lives_ok($$select public.unblock_user('b0000007-0000-0000-0000-000000000000')$$, 'V can unblock X2');
select ok(not exists (select 1 from public.get_feed(50) where first_name = 'X2'), 'when both blocked each other, lifting one block does not bring them back');

-- ---------------------------------------------------------------------------
-- Watching other people's videos
-- ---------------------------------------------------------------------------
select is((select count(*) from public.get_answer_for_playback((select id from ids where name = 'w1_answer'))), 1::bigint,
  'with the gate open V can play a live answer');
select is((select count(*) from public.get_answer_for_playback((select answer_id from submitted))), 1::bigint, 'V can play their own answer');
select is_empty($$select * from public.get_answer_for_playback((select id from ids where name = 'x4_answer'))$$,
  'a disabled answer cannot be played by other people');
select is_empty($$select * from public.get_answer_for_playback((select id from ids where name = 'x5_answer'))$$,
  'a removed answer cannot be played by other people');
select is_empty($$select * from public.get_answer_for_playback(gen_random_uuid())$$, 'an unknown answer cannot be played');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(9), true);
set local role authenticated;
select is((select state from public.get_gate_status()), 'open', 'a user whose answer was disabled by flags still has the feed (a flag never locks a person out)');
select is((select count(*) from public.get_answer_for_playback((select id from ids where name = 'x4_answer'))), 1::bigint,
  'the owner can still play their own disabled answer');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(12), true);
set local role authenticated;
select is_empty($$select * from public.get_answer_for_playback((select id from ids where name = 'w1_answer'))$$,
  'a user who has not answered cannot play other people''s videos');

-- ---------------------------------------------------------------------------
-- Nobody can read follows (follower anonymity)
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select throws_ok($$select * from public.follows$$, '42501', null, 'a signed-in user cannot read follows');
select throws_ok($$insert into public.follows (follower_id, followed_id) values (auth.uid(), 'b0000002-0000-0000-0000-000000000000')$$,
  '42501', null, 'a signed-in user cannot write follows');
select throws_ok($$delete from public.follows$$, '42501', null, 'a signed-in user cannot delete follows');
reset role;
set local role anon;
select throws_ok($$select * from public.follows$$, '42501', null, 'a signed-out visitor cannot read follows');

-- ---------------------------------------------------------------------------
-- Location
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select throws_ok($$update public.profiles set latitude = 1, longitude = 1$$, '42501', null, 'a user cannot set their own coordinates');
select throws_ok($$select public.set_profile_location(auth.uid(), 'x', 1, 1)$$, '42501', null, 'a user cannot call the location function');

reset role;
select set_config('request.jwt.claims', '', true);
update public.profiles set city = 'Boston' where id = pg_temp.uid(3);
select is((select latitude from public.profiles where id = pg_temp.uid(3)), null, 'changing the city clears the old coordinates');
set local role service_role;
select is(public.set_profile_location(pg_temp.uid(3), 'Cambridge', 42.37, -71.11), false, 'coordinates for a city that is no longer on the profile are ignored');
select is(public.set_profile_location(pg_temp.uid(3), 'Boston', 42.36, -71.06), true, 'the server can store coordinates for the current city');
select is((select latitude from public.profiles where id = pg_temp.uid(3)), 42.36::double precision, 'the coordinates are stored');
select throws_ok($$select public.set_profile_location(pg_temp.uid(3), 'Boston', 42.36, null)$$, '23514', null, 'a latitude needs a longitude');
select throws_ok($$select public.set_profile_location(pg_temp.uid(3), 'Boston', 142, 10)$$, '23514', null, 'a latitude must be a real latitude');
reset role;
update public.profiles set city = 'Boston' where id = pg_temp.uid(3);
select is((select latitude from public.profiles where id = pg_temp.uid(3)), 42.36::double precision, 'saving the same city keeps the coordinates');

select * from finish();
rollback;
