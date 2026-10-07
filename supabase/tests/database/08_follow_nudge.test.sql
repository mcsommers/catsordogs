-- Phase 5 rules: follow, unfollow, follower count, nudges and the one-
-- notification-a-day limit, and that nobody using the app can ever learn who
-- follows or nudged them.
begin;
select plan(75);

delete from public.answers;
delete from public.videos;
delete from public.questions;
insert into public.questions (question_date, text) values (public.utc_today(), 'Today''s question');

create function pg_temp.uid(n int) returns uuid language sql
as $$ select ('e' || lpad(n::text, 7, '0') || '-0000-0000-0000-000000000000')::uuid $$;
create function pg_temp.claims(n int) returns text language sql
as $$ select json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text $$;
create function pg_temp.person(n int, label text, finished boolean default true) returns void language plpgsql as $$
begin
  insert into auth.users (id, email, aud, role, instance_id)
  values (pg_temp.uid(n), label || '@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  update public.profiles set first_name = label, gender = 'Woman', birthday = '1995-05-05',
    profile_completed_at = case when finished then now() end where id = pg_temp.uid(n);
end $$;
create function pg_temp.answer_today(n int) returns void language plpgsql as $$
declare vid uuid := gen_random_uuid(); q uuid := (select id from public.questions where question_date = public.utc_today());
begin
  insert into public.videos (id, user_id, question_id, status, mux_playback_id, duration_seconds, captions_status, caption_segments, submitted_at)
  values (vid, pg_temp.uid(n), q, 'ready', 'pb', 5, 'unavailable', '[]', now());
  insert into public.answers (user_id, question_id, video_id, duration_seconds) values (pg_temp.uid(n), q, vid, 5);
end $$;

--  1 A (the person being followed)   2-4 F1 F2 F3 (followers)   5 S stranger   6 B (blocks F1)
--  7 O (followers off)   8 Y (unfinished profile)   9 T   10 P   11 Q   12 R
select pg_temp.person(1, 'A'); select pg_temp.person(2, 'F1'); select pg_temp.person(3, 'F2'); select pg_temp.person(4, 'F3');
select pg_temp.person(5, 'S'); select pg_temp.person(6, 'B'); select pg_temp.person(7, 'O'); select pg_temp.person(8, 'Y', false);
select pg_temp.person(9, 'T'); select pg_temp.person(10, 'P'); select pg_temp.person(11, 'Q'); select pg_temp.person(12, 'R');
update public.profiles set allow_followers = false where id = pg_temp.uid(7);
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.uid(6), pg_temp.uid(2));
insert into public.device_tokens (user_id, token, platform) values (pg_temp.uid(1), 'ExponentPushToken[aaaa]', 'ios');

-- ---------------------------------------------------------------------------
-- Following
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$select public.follow_user('e0000001-0000-0000-0000-000000000000')$$, '42501', null, 'a signed-out visitor cannot follow');
select throws_ok($$select public.get_follower_count()$$, '42501', null, 'a signed-out visitor cannot ask for a follower count');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(2), true);
set local role authenticated;
select lives_ok($$select public.follow_user('e0000001-0000-0000-0000-000000000000')$$, 'F1 can follow A');
select lives_ok($$select public.follow_user('e0000001-0000-0000-0000-000000000000')$$, 'following twice is harmless');
select throws_ok($$select public.follow_user(auth.uid())$$, '23514', 'Choose someone else.', 'you cannot follow yourself');
select throws_ok($$select public.follow_user(gen_random_uuid())$$, 'P0002', 'Person not found.', 'you cannot follow someone who does not exist');
select throws_ok($$select public.follow_user('e0000008-0000-0000-0000-000000000000')$$, 'P0002', 'Person not found.', 'you cannot follow someone with an unfinished profile');
select throws_ok($$select public.follow_user('e0000007-0000-0000-0000-000000000000')$$, '23514', 'This person is not accepting followers.',
  'new follows are rejected when the person turned followers off');
select throws_ok($$select public.follow_user('e0000006-0000-0000-0000-000000000000')$$, 'P0002', 'Person not found.',
  'someone who blocked you looks exactly like someone who does not exist');
select is((select following from public.get_follow_state('e0000001-0000-0000-0000-000000000000')), true, 'the app can tell F1 follows A');
select is((select following from public.get_follow_state('e0000006-0000-0000-0000-000000000000')), false, 'it says nothing about people F1 does not follow');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(3), true);
set local role authenticated;
select lives_ok($$select public.follow_user('e0000001-0000-0000-0000-000000000000')$$, 'F2 can follow A');
reset role;
select set_config('request.jwt.claims', pg_temp.claims(4), true);
set local role authenticated;
select lives_ok($$select public.follow_user('e0000001-0000-0000-0000-000000000000')$$, 'F3 can follow A');

-- F1 blocks S; then F1 cannot follow S
reset role;
select set_config('request.jwt.claims', pg_temp.claims(2), true);
set local role authenticated;
select lives_ok($$select public.block_user('e0000005-0000-0000-0000-000000000000')$$, 'F1 blocks S');
select throws_ok($$select public.follow_user('e0000005-0000-0000-0000-000000000000')$$, 'P0002', 'Person not found.', 'you cannot follow someone you blocked');

-- Unfollow
reset role;
insert into public.follows (follower_id, followed_id) values (pg_temp.uid(4), pg_temp.uid(10));
select set_config('request.jwt.claims', pg_temp.claims(4), true);
set local role authenticated;
select lives_ok($$select public.unfollow_user('e0000010-0000-0000-0000-000000000000')$$, 'F3 can unfollow P');
select lives_ok($$select public.unfollow_user('e0000010-0000-0000-0000-000000000000')$$, 'unfollowing again is harmless');
reset role;
select is((select count(*) from public.follows where followed_id = pg_temp.uid(10)), 0::bigint, 'the follow is gone');

-- ---------------------------------------------------------------------------
-- Follower count and anonymity
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select is(public.get_follower_count(), 3::bigint, 'A sees how many followers they have');
select throws_ok($$select * from public.follows$$, '42501', null, 'A cannot read the follows table');
select throws_ok($$select * from public.follows where followed_id = auth.uid()$$, '42501', null, 'A cannot ask who follows them');
select throws_ok($$select * from public.nudges$$, '42501', null, 'A cannot read the nudges table');
select throws_ok($$insert into public.nudges (sender_id, target_id, question_id) select auth.uid(), auth.uid(), id from public.questions$$,
  '42501', null, 'nobody can write nudges directly');
select throws_ok($$insert into public.follows (follower_id, followed_id) values (auth.uid(), 'e0000005-0000-0000-0000-000000000000')$$,
  '42501', null, 'nobody can write follows directly');
select ok((select bool_and(pg_get_function_result(p.oid) !~* 'follower_id|sender_id')
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('get_follower_count', 'get_follow_state', 'get_feed')),
  'no function the app can call returns a follower or sender id');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(5), true);
set local role authenticated;
select is(public.get_follower_count(), 0::bigint, 'a person with no followers sees 0');
set local role anon;
select throws_ok($$select * from public.follows$$, '42501', null, 'a signed-out visitor cannot read follows');
select throws_ok($$select * from public.nudges$$, '42501', null, 'a signed-out visitor cannot read nudges');

-- ---------------------------------------------------------------------------
-- Nudging
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', pg_temp.claims(5), true);
set local role authenticated;
select throws_ok($$select public.nudge_user('e0000001-0000-0000-0000-000000000000')$$, '23514', 'You can only nudge people you follow.',
  'a stranger cannot nudge');
select is((select can_nudge from public.get_follow_state('e0000001-0000-0000-0000-000000000000')), false, 'a stranger is not offered a nudge');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(2), true);
set local role authenticated;
select is((select can_nudge from public.get_follow_state('e0000001-0000-0000-0000-000000000000')), true, 'a follower is offered a nudge');
select lives_ok($$select public.nudge_user('e0000001-0000-0000-0000-000000000000')$$, 'F1 can nudge A');
select throws_ok($$select public.nudge_user('e0000001-0000-0000-0000-000000000000')$$, '23514', 'You have already nudged this person today.',
  'one nudge per follower, per person, per day');
select is((select already_nudged from public.get_follow_state('e0000001-0000-0000-0000-000000000000')), true, 'the app knows F1 already nudged');
select is((select can_nudge from public.get_follow_state('e0000001-0000-0000-0000-000000000000')), false, 'and no longer offers the nudge');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(3), true);
set local role authenticated;
select lives_ok($$select public.nudge_user('e0000001-0000-0000-0000-000000000000')$$, 'F2 can nudge A');
reset role;
select set_config('request.jwt.claims', pg_temp.claims(4), true);
set local role authenticated;
select lives_ok($$select public.nudge_user('e0000001-0000-0000-0000-000000000000')$$, 'F3 can nudge A');

reset role;
select is((select count(*) from public.nudges where target_id = pg_temp.uid(1)), 3::bigint, 'all three nudges are recorded');
select is((select count(*) from public.notification_outbox where user_id = pg_temp.uid(1) and kind = 'nudge'), 1::bigint,
  'but A has just one nudge notification for the day, however many followers nudge');

-- the notification waits a few minutes so it can say how many
set local role service_role;
select is((select count(*) from public.claim_notifications() where user_id = pg_temp.uid(1)), 0::bigint, 'the nudge notification is not sent immediately');
reset role;
update public.notification_outbox set send_after = now() - interval '1 minute' where user_id = pg_temp.uid(1);
set local role service_role;
create temp table claimed as select * from public.claim_notifications() where user_id = pg_temp.uid(1);
grant select on claimed to public;
select is((select count(*) from claimed), 1::bigint, 'once due, it is handed to the worker');
select is((select body from claimed), '3 followers want to hear your answer to today''s question.', 'it says how many followers want to hear the answer');
select is((select send_push from claimed), true, 'it goes by push (the default, and A has a phone registered)');
select is((select send_email from claimed), false, 'and not by email (nudge email is off by default)');
select ok((select to_jsonb(c)::text !~* 'e000000[234]' from claimed c), 'nothing handed to the worker names a follower');
select lives_ok($$select public.complete_notification((select id from claimed), true)$$, 'the worker reports it sent');
select is((select count(*) from public.claim_notifications() where user_id = pg_temp.uid(1)), 0::bigint, 'it is not sent twice');
reset role;
select is((select status from public.notification_outbox where user_id = pg_temp.uid(1)), 'sent', 'the notification is recorded as sent');

-- a later nudge the same day does not create another notification
select set_config('request.jwt.claims', pg_temp.claims(5), true);
insert into public.follows (follower_id, followed_id) values (pg_temp.uid(5), pg_temp.uid(1));
set local role authenticated;
select lives_ok($$select public.nudge_user('e0000001-0000-0000-0000-000000000000')$$, 'another follower can still nudge later');
reset role;
select is((select count(*) from public.notification_outbox where user_id = pg_temp.uid(1) and kind = 'nudge'), 1::bigint,
  'but no second notification is created that day');

-- nudges only reach people who have not answered
select pg_temp.person(13, 'T2');
insert into public.follows (follower_id, followed_id) values (pg_temp.uid(2), pg_temp.uid(9)), (pg_temp.uid(3), pg_temp.uid(9));
select set_config('request.jwt.claims', pg_temp.claims(2), true);
set local role authenticated;
select lives_ok($$select public.nudge_user('e0000009-0000-0000-0000-000000000000')$$, 'F1 nudges T, who has not answered');
reset role;
select pg_temp.answer_today(9);
update public.notification_outbox set send_after = now() - interval '1 minute' where user_id = pg_temp.uid(9);
set local role service_role;
select is((select count(*) from public.claim_notifications() where user_id = pg_temp.uid(9)), 0::bigint,
  'a nudge is dropped if the person answers before it is sent');
reset role;
select is((select status from public.notification_outbox where user_id = pg_temp.uid(9)), 'skipped', 'it is recorded as skipped');
select set_config('request.jwt.claims', pg_temp.claims(3), true);
set local role authenticated;
select throws_ok($$select public.nudge_user('e0000009-0000-0000-0000-000000000000')$$, '23514', 'They have already answered today.',
  'a nudge is rejected when the person has already posted today');
select is((select can_nudge from public.get_follow_state('e0000009-0000-0000-0000-000000000000')), false, 'the Nudge card is not offered after they answer');

-- followers turned off: existing followers can no longer nudge
reset role;
insert into public.follows (follower_id, followed_id) values (pg_temp.uid(2), pg_temp.uid(10));
update public.profiles set allow_followers = false where id = pg_temp.uid(10);
select set_config('request.jwt.claims', pg_temp.claims(2), true);
set local role authenticated;
select throws_ok($$select public.nudge_user('e0000010-0000-0000-0000-000000000000')$$, '23514', 'This person is not accepting followers.',
  'existing followers cannot nudge once followers are turned off');
select is((select can_nudge from public.get_follow_state('e0000010-0000-0000-0000-000000000000')), false, 'the Nudge card is hidden');
select throws_ok($$select public.follow_user('e0000010-0000-0000-0000-000000000000')$$, '23514', null, 'and no one new can follow');
reset role;
select is((select count(*) from public.follows where followed_id = pg_temp.uid(10)), 1::bigint, 'the existing follower is kept');
select set_config('request.jwt.claims', pg_temp.claims(10), true);
set local role authenticated;
select is(public.get_follower_count(), 1::bigint, 'and still counted');

-- blocks
reset role;
insert into public.follows (follower_id, followed_id) values (pg_temp.uid(2), pg_temp.uid(11));
select set_config('request.jwt.claims', pg_temp.claims(11), true);
set local role authenticated;
select lives_ok($$select public.block_user('e0000002-0000-0000-0000-000000000000')$$, 'Q blocks F1');
reset role;
select is((select count(*) from public.follows where follower_id = pg_temp.uid(2) and followed_id = pg_temp.uid(11)), 0::bigint,
  'blocking someone who follows you ends the follow');
select set_config('request.jwt.claims', pg_temp.claims(2), true);
set local role authenticated;
select throws_ok($$select public.nudge_user('e0000011-0000-0000-0000-000000000000')$$, 'P0002', 'Person not found.', 'a blocked person cannot nudge');

reset role;
insert into public.follows (follower_id, followed_id) values (pg_temp.uid(3), pg_temp.uid(12)), (pg_temp.uid(12), pg_temp.uid(3));
select set_config('request.jwt.claims', pg_temp.claims(3), true);
set local role authenticated;
select public.block_user('e0000012-0000-0000-0000-000000000000');
reset role;
select is((select count(*) from public.follows where (follower_id = pg_temp.uid(3) and followed_id = pg_temp.uid(12))
                                                   or (follower_id = pg_temp.uid(12) and followed_id = pg_temp.uid(3))), 0::bigint,
  'blocking ends follows in both directions');
select set_config('request.jwt.claims', pg_temp.claims(3), true);
set local role authenticated;
select public.unblock_user('e0000012-0000-0000-0000-000000000000');
reset role;
select is((select count(*) from public.follows where follower_id = pg_temp.uid(3) and followed_id = pg_temp.uid(12)), 0::bigint,
  'unblocking does not bring a follow back');

-- Not Interested also unfollows, silently
select set_config('request.jwt.claims', pg_temp.claims(3), true);
set local role authenticated;
select is((select following from public.get_follow_state('e0000001-0000-0000-0000-000000000000')), true, 'F2 follows A before hiding them');
select lives_ok($$select public.mark_not_interested('e0000001-0000-0000-0000-000000000000')$$, 'F2 marks A Not Interested');
select is((select following from public.get_follow_state('e0000001-0000-0000-0000-000000000000')), false, 'which also unfollows');
select lives_ok($$select public.undo_not_interested('e0000001-0000-0000-0000-000000000000')$$, 'undoing Not Interested works');
select is((select following from public.get_follow_state('e0000001-0000-0000-0000-000000000000')), false, 'and does not restore the follow');
reset role;
select is((select count(*) from public.follows where follower_id = pg_temp.uid(3) and followed_id = pg_temp.uid(1)), 0::bigint, 'the follow row is gone');

-- A deleted account takes its follows and nudges with it
delete from auth.users where id = pg_temp.uid(4);
select is((select count(*) from public.follows where follower_id = pg_temp.uid(4)), 0::bigint, 'deleting an account removes its follows');
select is((select count(*) from public.nudges where sender_id = pg_temp.uid(4)), 0::bigint, 'and its nudges');

-- No question today
delete from public.answers; delete from public.videos; delete from public.notification_outbox;
select set_config('request.jwt.claims', '', true);
delete from public.questions where question_date = public.utc_today();
select set_config('request.jwt.claims', pg_temp.claims(2), true);
set local role authenticated;
select throws_ok($$select public.nudge_user('e0000001-0000-0000-0000-000000000000')$$, 'P0002', 'There is no question today.', 'nobody can nudge when no question is scheduled');
select is((select can_nudge from public.get_follow_state('e0000001-0000-0000-0000-000000000000')), false, 'and no nudge is offered');

select * from finish();
rollback;
