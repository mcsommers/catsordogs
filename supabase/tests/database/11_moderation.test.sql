-- Phase 7: flagging a video disables only that video, profile and message
-- reports never hide anything on their own, the queue is admin-only, the
-- poster is told when a video is hidden, and deleting an account removes
-- what people can see while keeping anonymous moderation records.
begin;
select plan(68);

delete from public.moderation_actions;
delete from public.flags;
delete from public.reports;
delete from public.answers;
delete from public.videos;
delete from public.questions;
insert into public.questions (question_date, text) values
  (public.utc_today(), 'Coffee or tea — defend your answer.'),
  (public.utc_today() - 1, 'Describe your ideal Sunday.');

update public.app_settings set flag_threshold = 2, profile_report_priority_count = 3;

create function pg_temp.uid(n int) returns uuid language sql
as $$ select ('c' || lpad(n::text, 7, '0') || '-0000-0000-0000-000000000000')::uuid $$;
create function pg_temp.claims(n int) returns text language sql
as $$ select json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text $$;
create function pg_temp.become(n int) returns void language sql as $$
  select set_config('request.jwt.claims', pg_temp.claims(n), true)
$$;
create function pg_temp.person(n int, label text, finished boolean default true) returns void language plpgsql as $$
begin
  insert into auth.users (id, email, aud, role, instance_id)
  values (pg_temp.uid(n), label || '@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  update public.profiles set first_name = label, gender = 'Woman', birthday = '1995-05-05',
    profile_completed_at = case when finished then now() end where id = pg_temp.uid(n);
  if finished then
    insert into public.profile_photos (user_id, position, storage_path)
    values (pg_temp.uid(n), 1, pg_temp.uid(n)::text || '/1.jpg');
  end if;
end $$;
create function pg_temp.video(n int, p_days_ago int default 0, p_asset text default null) returns uuid language plpgsql as $$
declare vid uuid := gen_random_uuid();
begin
  insert into public.videos (id, user_id, question_id, status, mux_playback_id, mux_asset_id, duration_seconds, captions_status, caption_segments, submitted_at)
  values (vid, pg_temp.uid(n), (select id from public.questions where question_date = public.utc_today() - p_days_ago),
          'ready', 'pb', p_asset, 8, 'unavailable', '[]', now());
  return vid;
end $$;
create function pg_temp.answer(n int, p_days_ago int default 0, p_status text default 'live', p_asset text default null) returns uuid language plpgsql as $$
declare vid uuid := pg_temp.video(n, p_days_ago, p_asset); aid uuid := gen_random_uuid();
begin
  insert into public.answers (id, user_id, question_id, video_id, duration_seconds, status, submitted_at)
  values (aid, pg_temp.uid(n), (select id from public.questions where question_date = public.utc_today() - p_days_ago),
          vid, 8, p_status, now());
  return aid;
end $$;

-- 1 A poster  2 B  3 C  4 D  5 U unfinished  6 X blocks A  7 E match  8 Admin  9 F
select pg_temp.person(1, 'A'); select pg_temp.person(2, 'B'); select pg_temp.person(3, 'C');
select pg_temp.person(4, 'D'); select pg_temp.person(5, 'U', false);
select pg_temp.person(6, 'X'); select pg_temp.person(7, 'E'); select pg_temp.person(8, 'Admin');
select pg_temp.person(9, 'F');
insert into public.admin_users (user_id) values (pg_temp.uid(8));
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.uid(6), pg_temp.uid(1));
insert into public.device_tokens (user_id, token, platform) values
  (pg_temp.uid(1), 'ExponentPushToken[a-mod]', 'ios');

create temp table ids as
  select pg_temp.answer(1, 0, 'live', 'mux-asset-a-today') as today_a,
         pg_temp.answer(1, 1) as yesterday_a,
         pg_temp.answer(2, 0) as today_b,
         pg_temp.answer(3, 0) as today_c,
         pg_temp.answer(4, 0) as today_d,
         pg_temp.answer(7, 0) as today_e,
         pg_temp.answer(9, 0) as today_f;
grant select on ids to public;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$select public.flag_answer(gen_random_uuid())$$, '42501', null, 'a signed-out visitor cannot flag');
select throws_ok($$select public.report_profile('c0000001-0000-0000-0000-000000000000')$$, '42501', null,
  'or report a profile');
select throws_ok($$select * from public.get_moderation_queue()$$, '42501', null, 'or read the queue');

reset role;
select pg_temp.become(2);
set local role authenticated;
select throws_ok($$select * from public.flags$$, '42501', null, 'the app cannot read flags');
select throws_ok($$select * from public.reports$$, '42501', null, 'or reports');
select throws_ok($$select * from public.moderation_actions$$, '42501', null, 'or the queue table');
select throws_ok($$select * from public.get_moderation_queue()$$, '42501', 'Not allowed.',
  'an ordinary user cannot read the queue');

-- ---------------------------------------------------------------------------
-- Flagging: only that video, never the account
-- ---------------------------------------------------------------------------
select is(public.flag_answer((select today_a from ids)), 'flagged', 'the first flag does not hide the video');
reset role;
select is((select status from public.answers where id = (select today_a from ids)), 'live',
  'two flags are required (the admin-set threshold)');
select pg_temp.become(2);
set local role authenticated;
select is(public.flag_answer((select today_a from ids)), 'already_flagged', 'a second tap from the same person is a no-op');

reset role;
select pg_temp.become(3);
set local role authenticated;
select is(public.flag_answer((select today_a from ids)), 'disabled', 'the second distinct flag hides the video');
reset role;
select is((select status from public.answers where id = (select today_a from ids)), 'disabled',
  'that answer is disabled');
select is((select status from public.answers where id = (select yesterday_a from ids)), 'live',
  'A''s other answer is untouched');
select ok(exists (select 1 from public.profiles where id = pg_temp.uid(1) and first_name = 'A'),
  'A''s account is still there');

reset role;
select pg_temp.become(1);
set local role authenticated;
select is((select state from public.get_gate_status()), 'open',
  'a disabled answer still counts as answered, so A keeps the feed');
select ok((select mux_playback_id from public.get_answer_for_playback((select today_a from ids))) is not null,
  'A can still play their own disabled answer');

reset role;
select pg_temp.become(4);
set local role authenticated;
select is((select count(*) from public.get_feed() where answer_id = (select today_a from ids)), 0::bigint,
  'other people no longer see the disabled answer in the feed');
select ok((select count(*) from public.get_feed() where answer_id = (select yesterday_a from ids)) >= 0,
  'the feed function still runs');
select is((select count(*) from public.get_feed(20, 0, public.utc_today() - 1) where answer_id = (select yesterday_a from ids)),
  1::bigint, 'A''s yesterday answer is still in that day''s feed');

select throws_ok($$select public.flag_answer(gen_random_uuid())$$, 'P0002', 'Answer not found.',
  'a missing answer looks the same');

reset role;
select pg_temp.become(2);
set local role authenticated;
select throws_ok(format($$select public.flag_answer(%L)$$, (select today_b from ids)),
  'P0002', 'Answer not found.', 'you cannot flag your own answer');

reset role;
select pg_temp.become(6);
set local role authenticated;
select throws_ok(format($$select public.flag_answer(%L)$$, (select today_d from ids)),
  'P0002', 'Answer not found.', 'X has not answered, so the gate is closed');
-- Give X today's answer so the only reason to hide A's video is the block.
reset role;
select pg_temp.answer(6, 0);
select pg_temp.become(6);
set local role authenticated;
select throws_ok(format($$select public.flag_answer(%L)$$, (select today_a from ids)),
  'P0002', 'Answer not found.', 'a block looks like the answer does not exist');

reset role;
select pg_temp.become(5);
set local role authenticated;
select throws_ok(format($$select public.flag_answer(%L)$$, (select today_d from ids)),
  'P0002', 'Answer not found.', 'an unfinished profile cannot flag');

-- The poster was notified, and turning off other notification types cannot stop it.
reset role;
select is((select kind from public.notification_outbox where user_id = pg_temp.uid(1) and kind = 'answer_disabled'),
  'answer_disabled', 'A is queued a hidden-video notice');
select pg_temp.become(1);
select public.set_notification_preference('matches', 'push', false);
select public.set_notification_preference('matches', 'email', false);
select public.set_notification_preference('daily_question', 'push', false);
set local role authenticated;
-- claim_notifications is service_role only
reset role;
select is((select title from public.claim_notifications(20) where user_id = pg_temp.uid(1)),
  'Your answer was hidden', 'the notice is handed to the worker even with other types off');
select is((select status from public.notification_outbox where kind = 'answer_disabled' and user_id = pg_temp.uid(1)),
  'sending', 'the worker has claimed the hidden-video notice');

-- ---------------------------------------------------------------------------
-- Profile and message reports never hide anything
-- ---------------------------------------------------------------------------
select pg_temp.become(2);
set local role authenticated;
select is(public.report_profile(pg_temp.uid(1)), 'reported', 'B reports A''s profile');
select is(public.report_profile(pg_temp.uid(1)), 'already_reported', 'a second report from B is a no-op');
select throws_ok($$select public.report_profile(auth.uid())$$, '23514', 'Choose someone else.',
  'you cannot report yourself');

reset role;
select pg_temp.become(3);
set local role authenticated;
select is(public.report_profile(pg_temp.uid(1)), 'reported', 'C reports A');
reset role;
select pg_temp.become(4);
set local role authenticated;
select is(public.report_profile(pg_temp.uid(1)), 'reported', 'D reports A, reaching the high-priority count');
select is((select count(*) from public.get_feed(20, 0, public.utc_today() - 1) where user_id = pg_temp.uid(1)),
  1::bigint, 'A''s profile and remaining answers are still visible');

-- A and E match so they can report a message.
reset role;
select pg_temp.become(1);
set local role authenticated;
select is(public.send_match_request(pg_temp.uid(7)), 'sent', 'A requests E');
reset role;
select pg_temp.become(7);
set local role authenticated;
select ok(public.accept_match_request(pg_temp.uid(1)) is not null, 'E accepts');
create temp table chat as
  select match_id from public.get_conversations() where user_id = pg_temp.uid(1);
select ok(public.send_message((select match_id from chat), 'hello A') is not null, 'E messages A');
create temp table msgs as
  select id as message_id, sender_id from public.get_messages((select match_id from chat));
reset role;
grant select on chat to public;
grant select on msgs to public;

reset role;
select pg_temp.become(1);
set local role authenticated;
select is(public.report_message((select message_id from msgs)), 'reported', 'A reports E''s message');
select is(public.report_message((select message_id from msgs)), 'already_reported', 'reporting it again is a no-op');
select ok(public.send_message((select match_id from chat), 'hi E') is not null, 'A replies');
select throws_ok($$select public.report_message((select id from public.messages where sender_id = auth.uid() limit 1))$$,
  'P0002', 'Message not found.', 'you cannot report your own message');

reset role;
select pg_temp.become(2);
set local role authenticated;
select throws_ok(format($$select public.report_message(%L)$$, (select message_id from msgs)),
  'P0002', 'Message not found.', 'a stranger cannot report a private message');

-- ---------------------------------------------------------------------------
-- Admin queue
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.become(8);
set local role authenticated;
select is((select count(*) from public.get_moderation_queue()), 3::bigint,
  'the queue has the disabled video, the profile, and the message');
select is((select kind from public.get_moderation_queue() order by high_priority desc, opened_at desc limit 1),
  'profile', 'the profile with three reporters is first (high priority)');
select is((select high_priority from public.get_moderation_queue() where kind = 'profile'), true,
  'three distinct reporters marks the profile high priority');
select is((select report_count from public.get_moderation_queue() where kind = 'answer'), 2::bigint,
  'the video shows two flags');

create temp table qitems as select * from public.get_moderation_queue();
reset role;
grant select on qitems to public;
select pg_temp.become(8);
set local role authenticated;
select lives_ok(
  format($$select public.review_queue_item(%L, 'restore')$$, (select id from qitems where kind = 'answer')),
  'an admin can put the video back');
reset role;
select is((select status from public.answers where id = (select today_a from ids)), 'live',
  'the restored answer is live again');

reset role;
select pg_temp.become(4);
set local role authenticated;
select is((select count(*) from public.get_feed() where answer_id = (select today_a from ids)), 1::bigint,
  'the restored answer is back in the feed');
select is(public.flag_answer((select today_a from ids)), 'disabled',
  'a new flag after restore hits the threshold again (the old flags still count)');

reset role;
select pg_temp.become(8);
set local role authenticated;
select lives_ok(
  format($$select public.review_queue_item(%L, 'keep')$$,
    (select id from public.get_moderation_queue() where kind = 'answer')),
  'an admin can keep it hidden');
reset role;
select is((select status from public.answers where id = (select today_a from ids)), 'disabled',
  'keeping it leaves the answer disabled');
select pg_temp.become(8);
set local role authenticated;
select lives_ok(
  format($$select public.review_queue_item(%L, 'reviewed')$$, (select id from qitems where kind = 'profile')),
  'an admin marks the profile report reviewed');
select lives_ok(
  format($$select public.review_queue_item(%L, 'reviewed')$$, (select id from qitems where kind = 'message')),
  'and the message report');
select is((select count(*) from public.get_moderation_queue()), 0::bigint, 'the queue is empty');

select throws_ok($$select public.review_queue_item(gen_random_uuid(), 'restore')$$, 'P0002', 'Item not found.',
  'a missing queue item is rejected');

-- ---------------------------------------------------------------------------
-- Account deletion
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.become(7);
set local role authenticated;
select is((select count(*) from public.get_conversations()), 1::bigint, 'E still has the chat with A');

reset role;
select pg_temp.become(1);
set local role authenticated;
select ok(exists (select 1 from public.delete_account() where mux_asset_id = 'mux-asset-a-today'),
  'deleting returns Mux ids so the files can be removed');

reset role;
select is((select count(*) from auth.users where id = pg_temp.uid(1)), 0::bigint, 'A''s login is gone');
select is((select count(*) from public.profiles where id = pg_temp.uid(1)), 0::bigint, 'and the profile');
select is((select count(*) from public.answers where user_id = pg_temp.uid(1)), 0::bigint, 'and the answers');
select is((select count(*) from public.profile_photos where user_id = pg_temp.uid(1)), 0::bigint, 'and the photos');

select pg_temp.become(7);
set local role authenticated;
select is((select count(*) from public.get_conversations()), 0::bigint, 'E no longer has a chat with A');
select is((select count(*) from public.get_feed() where user_id = pg_temp.uid(1)), 0::bigint,
  'A is gone from the feed');
select throws_ok($$select public.send_match_request('c0000001-0000-0000-0000-000000000000')$$,
  'P0002', 'Person not found.', 'and cannot be matched with');

reset role;
select is((select count(*) from public.flags), 3::bigint,
  'the flags on A''s video are kept (B, C, and D)');
select ok(exists (
  select 1 from public.moderation_actions
  where snapshot ->> 'account_deleted' = 'true' or snapshot ? 'question_text'
), 'moderation rows remain after the account is gone');
select is((select count(*) from public.reports where kind = 'profile'), 3::bigint,
  'profile reports stay');

-- A signed-out visitor still cannot delete.
set local role anon;
select throws_ok($$select * from public.delete_account()$$, '42501', null,
  'a signed-out visitor cannot delete an account');

select * from finish();
rollback;
