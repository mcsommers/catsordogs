-- Phase 2 rules: the question calendar, settings, and who may change them.
begin;
select plan(68);

-- Start from a clean calendar (the local seed data is removed inside this test only).
delete from public.videos;
delete from public.questions;

insert into auth.users (id, email, aud, role, instance_id) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('b0000000-0000-0000-0000-00000000000b', 'user@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into public.admin_users (user_id) values ('a0000000-0000-0000-0000-00000000000a');

insert into public.questions (question_date, text) values
  (public.utc_today() - 1, 'Yesterday''s question'),
  (public.utc_today(),     'Today''s question'),
  (public.utc_today() + 1, 'Tomorrow''s question'),
  (public.utc_today() + 2, 'Day after tomorrow''s question');

-- ---------------------------------------------------------------------------
-- An ordinary signed-in user
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is(public.is_admin(), false, 'an ordinary user is not an admin');
select is((select text from public.get_todays_question()), 'Today''s question', 'get_todays_question returns today''s question');
select is((select question_date from public.get_todays_question()), public.utc_today(), 'today means the UTC day');
select is((select count(*) from public.get_todays_question()), 1::bigint, 'there is exactly one question for today');
select is((select count(*) from public.questions), 2::bigint, 'a user can read today''s and earlier questions only');
select is((select count(*) from public.questions where question_date > public.utc_today()), 0::bigint, 'future questions are hidden from users');

select throws_ok($$insert into public.questions (question_date, text) values (public.utc_today() + 10, 'Sneaky')$$,
  '42501', null, 'a user cannot add a question');
select is_empty($$update public.questions set text = 'Hacked' where question_date = public.utc_today() returning 1$$,
  'a user cannot change a question');
select is_empty($$delete from public.questions where question_date = public.utc_today() returning 1$$,
  'a user cannot delete a question');
select is((select count(*) from public.question_overrides), 0::bigint, 'a user cannot read override history');

select throws_ok($$select * from public.admin_users$$, '42501', null, 'a user cannot read the admin list');
select throws_ok($$insert into public.admin_users (user_id) values ('b0000000-0000-0000-0000-00000000000b')$$,
  '42501', null, 'a user cannot make themselves an admin');

select is((select count(*) from public.app_settings), 0::bigint, 'a user cannot read the settings table');
select is_empty($$update public.app_settings set recording_length_seconds = 60 returning 1$$,
  'a user cannot change settings');

select is((select recording_length_seconds from public.get_app_config()), 14, 'the app reads the recording length (default 14 seconds)');
select is((select min_watch_seconds from public.get_app_config()), 3, 'the app reads the minimum watch time');
select is((select help_support_url from public.get_app_config()), null, 'the help URL is empty until supplied');

select is((select prompt_text from public.get_onboarding_question()), 'Today''s question',
  'onboarding defaults to today''s question');
select is((select prompt_source from public.get_onboarding_question()), 'today', 'onboarding source is "today" by default');

-- ---------------------------------------------------------------------------
-- An admin
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is(public.is_admin(), true, 'an admin is recognised');
select is((select count(*) from public.questions), 4::bigint, 'an admin can read the whole calendar, including future days');

select lives_ok($$insert into public.questions (question_date, text) values (public.utc_today() + 30, 'A month from now')$$,
  'an admin can schedule a question far ahead');
select throws_ok($$insert into public.questions (question_date, text) values (public.utc_today() + 30, 'Duplicate day')$$,
  '23505', null, 'only one question per day');
select throws_ok($$insert into public.questions (question_date, text) values (public.utc_today() - 3, 'Back in time')$$,
  '23514', 'Questions cannot be scheduled in the past.', 'a question cannot be scheduled in the past');
select throws_ok($$insert into public.questions (question_date, text) values (public.utc_today() + 31, '')$$,
  '23514', null, 'an empty question is rejected');
select throws_ok(format($$insert into public.questions (question_date, text) values (public.utc_today() + 31, %L)$$, repeat('x', 201)),
  '23514', null, 'a question over 200 characters is rejected');
select throws_ok($$insert into public.questions (question_date, text, is_override) values (public.utc_today() + 31, 'Pre-flagged', true)$$,
  '42501', null, 'an admin cannot set the override flag by hand');

-- Overrides
select is((select is_override from public.questions where question_date = public.utc_today() + 1), false, 'a scheduled question starts un-overridden');
select lives_ok($$update public.questions set text = 'Breaking news question' where question_date = public.utc_today() + 1$$,
  'an admin can swap a scheduled question');
select is((select is_override from public.questions where question_date = public.utc_today() + 1), true, 'a swapped question is marked as overridden');
select is((select previous_text from public.question_overrides order by overridden_at desc limit 1), 'Tomorrow''s question',
  'the original text is kept in the override history');
select is((select overridden_by from public.question_overrides order by overridden_at desc limit 1), 'a0000000-0000-0000-0000-00000000000a'::uuid,
  'the history records which admin made the swap');
select lives_ok($$update public.questions set text = 'Second swap' where question_date = public.utc_today() + 1$$, 'a question can be swapped again');
select is((select count(*) from public.question_overrides), 2::bigint, 'every swap is recorded');
select lives_ok($$update public.questions set text = 'Today swapped' where question_date = public.utc_today()$$, 'today''s question can be swapped');
select is((select text from public.get_todays_question()), 'Today swapped', 'the app sees the swapped question for today');
select is((select is_override from public.get_todays_question()), true, 'the app is told today''s question was overridden');

-- History is protected
select throws_ok($$update public.questions set text = 'Rewrite history' where question_date = public.utc_today() - 1$$,
  '23514', 'Past questions cannot be changed.', 'a past question cannot be changed');
select throws_ok($$delete from public.questions where question_date = public.utc_today() - 1$$,
  '23514', 'Today''s and past questions cannot be removed.', 'a past question cannot be removed');
select throws_ok($$delete from public.questions where question_date = public.utc_today()$$,
  '23514', 'Today''s and past questions cannot be removed.', 'today''s question cannot be removed');
select lives_ok($$delete from public.questions where question_date = public.utc_today() + 2$$, 'a future question can be removed');
select throws_ok($$update public.questions set question_date = public.utc_today() + 50 where question_date = public.utc_today() + 1$$,
  '42501', null, 'a question cannot be moved to another date by editing (delete and re-add instead)');

-- Settings
select is((select recording_length_seconds from public.app_settings), 14, 'an admin can read the settings');
select lives_ok($$update public.app_settings set recording_length_seconds = 20, min_watch_seconds = 4$$, 'an admin can change settings');
select is((select updated_by from public.app_settings), 'a0000000-0000-0000-0000-00000000000a'::uuid, 'the settings record who changed them');
select throws_ok($$update public.app_settings set recording_length_seconds = 2$$, '23514', null, 'a recording length under 3 seconds is rejected');
select throws_ok($$update public.app_settings set recording_length_seconds = 61$$, '23514', null, 'a recording length over 60 seconds is rejected');
select throws_ok($$update public.app_settings set min_watch_seconds = 30$$, '23514', null, 'the minimum watch time cannot exceed the recording length');
select throws_ok($$update public.app_settings set onboarding_mode = 'whatever'$$, '23514', null, 'an unknown onboarding mode is rejected');
select throws_ok($$update public.app_settings set followed_content_cap_percent = 101$$, '23514', null, 'a feed share over 100 percent is rejected');
select throws_ok($$update public.app_settings set flag_threshold = 0$$, '23514', null, 'a flag threshold under 1 is rejected');
select throws_ok($$update public.app_settings set help_support_url = 'http://insecure.example.com'$$, '23514', null, 'the help URL must be https');
select lives_ok($$update public.app_settings set help_support_url = 'https://help.example.com/catsordogs'$$, 'a valid help URL is accepted');
select throws_ok($$delete from public.app_settings$$, '42501', null, 'the settings row cannot be deleted');
select throws_ok($$insert into public.app_settings (id) values (true)$$, '42501', null, 'a second settings row cannot be added');

select is((select recording_length_seconds from public.get_app_config()), 20, 'get_app_config reflects the admin''s new recording length');
select is((select help_support_url from public.get_app_config()), 'https://help.example.com/catsordogs', 'get_app_config returns the help URL');

-- Onboarding fixed-question mode
select lives_ok($$update public.app_settings set onboarding_mode = 'fixed_question', onboarding_fixed_question = 'Cats or dogs?'$$,
  'an admin can switch onboarding to a fixed question');
select is((select prompt_text from public.get_onboarding_question()), 'Cats or dogs?', 'onboarding shows the fixed question');
select is((select prompt_source from public.get_onboarding_question()), 'fixed', 'onboarding source is "fixed"');
select is((select question_id from public.get_onboarding_question()), (select id from public.questions where question_date = public.utc_today()),
  'a fixed onboarding question is still linked to today''s question (the first recording unlocks today''s feed)');
select is((select text from public.get_todays_question()), 'Today swapped', 'the daily question is unaffected by the onboarding mode');

-- ---------------------------------------------------------------------------
-- Signed-out visitors
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$select * from public.get_todays_question()$$, '42501', null, 'signed-out visitors cannot ask for today''s question');
select throws_ok($$select * from public.get_app_config()$$, '42501', null, 'signed-out visitors cannot read the app config');
select throws_ok($$select * from public.get_onboarding_question()$$, '42501', null, 'signed-out visitors cannot ask for the onboarding question');
select throws_ok($$select * from public.questions$$, '42501', null, 'signed-out visitors cannot read questions');
reset role;

-- ---------------------------------------------------------------------------
-- No question scheduled today
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '', true);
delete from public.questions where question_date = public.utc_today();
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is_empty($$select * from public.get_todays_question()$$, 'with nothing scheduled, there is no question for today');
select is_empty($$select * from public.get_onboarding_question()$$, 'with nothing scheduled, there is no onboarding question');
reset role;

select * from finish();
rollback;
