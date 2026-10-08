-- Phase 6 rules: match requests, silent decline, mutual match, chat, mute,
-- block ending a match, avatars, and that the app cannot read who requested
-- whom except through the Incoming / Outgoing lists.
begin;
select plan(104);

delete from public.answers;
delete from public.videos;
delete from public.questions;
insert into public.questions (question_date, text) values
  (public.utc_today(), 'Coffee or tea — defend your answer.'),
  (public.utc_today() - 1, 'Describe your ideal Sunday.');

create function pg_temp.uid(n int) returns uuid language sql
as $$ select ('a' || lpad(n::text, 7, '0') || '-0000-0000-0000-000000000000')::uuid $$;
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
create function pg_temp.video(n int, p_days_ago int default 0) returns uuid language plpgsql as $$
declare vid uuid := gen_random_uuid();
begin
  insert into public.videos (id, user_id, question_id, status, mux_playback_id, duration_seconds, captions_status, caption_segments, submitted_at)
  values (vid, pg_temp.uid(n), (select id from public.questions where question_date = public.utc_today() - p_days_ago),
          'ready', 'pb', 8, 'unavailable', '[]', now());
  return vid;
end $$;
create function pg_temp.answer(n int, p_days_ago int default 0, p_status text default 'live') returns uuid language plpgsql as $$
declare vid uuid := pg_temp.video(n, p_days_ago); aid uuid := gen_random_uuid();
begin
  insert into public.answers (id, user_id, question_id, video_id, duration_seconds, status, submitted_at)
  values (aid, pg_temp.uid(n), (select id from public.questions where question_date = public.utc_today() - p_days_ago),
          vid, 8, p_status, now());
  return aid;
end $$;

-- 1 A  2 B  3 C  4 D  5 U unfinished  6 X blocks A  7 E  8 F
select pg_temp.person(1, 'A'); select pg_temp.person(2, 'B'); select pg_temp.person(3, 'C');
select pg_temp.person(4, 'D'); select pg_temp.person(5, 'U', false);
select pg_temp.person(6, 'X'); select pg_temp.person(7, 'E'); select pg_temp.person(8, 'F');
insert into public.blocks (blocker_id, blocked_id) values (pg_temp.uid(6), pg_temp.uid(1));
insert into public.device_tokens (user_id, token, platform) values
  (pg_temp.uid(2), 'ExponentPushToken[b]', 'ios'),
  (pg_temp.uid(1), 'ExponentPushToken[a]', 'ios'),
  (pg_temp.uid(4), 'ExponentPushToken[d]', 'ios'),
  (pg_temp.uid(7), 'ExponentPushToken[e]', 'ios');

-- ---------------------------------------------------------------------------
-- Access: the app cannot read requests, and strangers cannot read matches
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$select public.send_match_request('a0000002-0000-0000-0000-000000000000')$$, '42501', null,
  'a signed-out visitor cannot send a match request');
select throws_ok($$select * from public.get_incoming_match_requests()$$, '42501', null,
  'or read Incoming');

reset role;
select pg_temp.become(1);
set local role authenticated;
select throws_ok($$select * from public.match_interests$$, '42501', null, 'the app cannot read match_interests');
select throws_ok($$insert into public.matches (user_a, user_b) values (pg_temp.uid(1), pg_temp.uid(2))$$, '42501', null,
  'or write a match directly');
select throws_ok($$insert into public.messages (match_id, sender_id, body)
  values (gen_random_uuid(), auth.uid(), 'hi')$$, '42501', null, 'or write a message directly');
select is((select count(*) from public.matches), 0::bigint, 'no matches yet');
select is((select count(*) from public.conversation_mutes), 0::bigint, 'and no mutes');

-- ---------------------------------------------------------------------------
-- Sending a request from a profile (no answer, feed can stay locked)
-- ---------------------------------------------------------------------------
select is(public.send_match_request(pg_temp.uid(2)), 'sent', 'A can request B from a profile');
select is((select first_name from public.get_outgoing_match_requests()), 'B', 'Outgoing shows B');
select is((select photo_path from public.get_outgoing_match_requests()), pg_temp.uid(2)::text || '/1.jpg',
  'Outgoing includes B''s avatar path');
select is((select state from public.get_match_state(pg_temp.uid(2))), 'sent', 'the heart on B''s profile says sent');

reset role;
select pg_temp.become(2);
set local role authenticated;
select is((select first_name || ':' || coalesce(question_text, 'none') from public.get_incoming_match_requests()),
  'A:none', 'Incoming with no liked answer has no question text (app shows "Wants to match with you")');
select is((select photo_path from public.get_incoming_match_requests()), pg_temp.uid(1)::text || '/1.jpg',
  'Incoming includes A''s avatar path');
select is((select state from public.get_match_state(pg_temp.uid(1))), 'incoming', 'B sees incoming on A''s profile');

-- ---------------------------------------------------------------------------
-- Who cannot send
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.become(1);
set local role authenticated;
select throws_ok($$select public.send_match_request(auth.uid())$$, '23514', 'Choose someone else.', 'you cannot match with yourself');
select throws_ok($$select public.send_match_request(pg_temp.uid(5))$$, 'P0002', 'Person not found.',
  'an unfinished profile looks like someone who does not exist');
select throws_ok($$select public.send_match_request(pg_temp.uid(6))$$, 'P0002', 'Person not found.',
  'someone who blocked you looks the same');
reset role;
select pg_temp.become(5);
set local role authenticated;
select throws_ok($$select public.send_match_request(pg_temp.uid(1))$$, '23514', 'Finish your profile first.',
  'an unfinished profile cannot send a request');

-- ---------------------------------------------------------------------------
-- Liking an answer needs the daily gate; re-liking updates Incoming
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.answer(3, 0);
select pg_temp.answer(3, 1);
create temp table c_answers (when_ago int primary key, id uuid not null);
insert into c_answers (when_ago, id)
  select (public.utc_today() - q.question_date), a.id
  from public.answers a join public.questions q on q.id = a.question_id
  where a.user_id = pg_temp.uid(3);
grant select on c_answers to public;
-- A has not answered today, so the gate is closed
select pg_temp.become(1);
set local role authenticated;
select throws_ok(format($$select public.send_match_request(%L, %L)$$, pg_temp.uid(3),
  (select id from c_answers where when_ago = 0)),
  'P0002', 'Answer not found.', 'liking an answer behind the gate looks like a missing answer');

reset role;
select pg_temp.answer(1, 0);
select pg_temp.become(1);
set local role authenticated;
select is(public.send_match_request(pg_temp.uid(3), (select id from c_answers where when_ago = 0)),
  'sent', 'after answering, A can like C''s today answer');
select is((select match_state from public.get_feed(50, 0, public.utc_today()) where first_name = 'C'),
  'sent', 'the heart on C''s feed video is selected because A already requested');

reset role;
select pg_temp.become(3);
set local role authenticated;
select is((select question_text from public.get_incoming_match_requests()),
  'Coffee or tea — defend your answer.', 'Incoming names the liked answer');

reset role;
select pg_temp.become(1);
set local role authenticated;
select is(public.send_match_request(pg_temp.uid(3), (select id from c_answers where when_ago = 1)),
  'sent', 'liking a different answer while waiting is allowed');
reset role;
select pg_temp.become(3);
set local role authenticated;
select is((select question_text from public.get_incoming_match_requests()),
  'Describe your ideal Sunday.', 'Incoming updates to the new answer');

-- ---------------------------------------------------------------------------
-- Decline is silent; cancel lets you send again
-- ---------------------------------------------------------------------------
select lives_ok($$select public.decline_match_request('a0000001-0000-0000-0000-000000000000')$$, 'C declines A');
select is((select count(*) from public.get_incoming_match_requests()), 0::bigint, 'the request leaves C''s Incoming');
reset role;
select pg_temp.become(1);
set local role authenticated;
select is((select first_name from public.get_outgoing_match_requests() where user_id = pg_temp.uid(3)), 'C',
  'A still sees C as waiting — a decline is never revealed');
select lives_ok($$select public.cancel_match_request('a0000003-0000-0000-0000-000000000000')$$, 'A cancels');
select is((select count(*) from public.get_outgoing_match_requests() where user_id = pg_temp.uid(3)), 0::bigint,
  'the cancelled request leaves Outgoing');
select is(public.send_match_request(pg_temp.uid(3)), 'sent', 'A can send a new request after cancelling');

-- ---------------------------------------------------------------------------
-- Mutual match: they send back, or they accept
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.become(3);
set local role authenticated;
select is(public.send_match_request(pg_temp.uid(1)), 'matched', 'C sending back creates the match');
select is((select state from public.get_match_state(pg_temp.uid(1))), 'matched', 'C sees matched');
reset role;
select pg_temp.become(1);
set local role authenticated;
select is((select state from public.get_match_state(pg_temp.uid(3))), 'matched', 'A sees matched');
select is(public.get_my_match_count(), 1::bigint, 'A has one match');
select is((select first_name from public.get_conversations()), 'C', 'the new match appears on the Chats tab');
select is((select last_message_body from public.get_conversations()), null, 'with no messages yet');
select is((select photo_path from public.get_conversations()), pg_temp.uid(3)::text || '/1.jpg',
  'Chats includes C''s avatar path');

-- Accept path: D requests E, E accepts
reset role;
select pg_temp.become(4);
set local role authenticated;
select is(public.send_match_request(pg_temp.uid(7)), 'sent', 'D requests E');
reset role;
select pg_temp.become(7);
set local role authenticated;
select throws_ok($$select public.accept_match_request('a0000008-0000-0000-0000-000000000000')$$, 'P0002', 'Request not found.',
  'accepting a request that is not there fails the same way as a missing person');
select ok(public.accept_match_request(pg_temp.uid(4)) is not null, 'E accepts D');
select is(public.get_my_match_count(), 1::bigint, 'E has a match');

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.become(1);
set local role authenticated;
select lives_ok(format($$select public.send_message(%L, 'hey C')$$,
  (select match_id from public.get_conversations())), 'A can message C');
select is((select last_message_body from public.get_conversations()), 'hey C', 'the preview is the last message');
select is((select last_message_is_mine from public.get_conversations()), true, 'and marked as mine');
select is((select body from public.get_messages((select match_id from public.get_conversations()))), 'hey C',
  'the thread returns the message');
select throws_ok(format($$select public.send_message(%L, '')$$, (select match_id from public.get_conversations())),
  '23514', 'Write a message first.', 'an empty message is refused');
select throws_ok(format($$select public.send_message(%L, %L)$$,
  (select match_id from public.get_conversations()), repeat('x', 1001)),
  '23514', 'Messages can be up to 1000 characters.', 'a too-long message is refused');
select throws_ok($$select public.send_message(gen_random_uuid(), 'hi')$$, 'P0002', 'Conversation not found.',
  'a stranger''s conversation looks like one that does not exist');
select throws_ok($$select * from public.get_messages(gen_random_uuid())$$, 'P0002', 'Conversation not found.',
  'and so does loading its messages');

select lives_ok(format($$select public.set_conversation_muted(%L, true)$$,
  (select match_id from public.get_conversations())), 'A can mute the conversation');
select is((select muted from public.get_conversations()), true, 'and sees it muted');
reset role;
select pg_temp.become(3);
set local role authenticated;
select is((select muted from public.get_conversations()), false, 'C is not told and is not muted');
select is((select last_message_is_mine from public.get_conversations()), false, 'C sees the last message as A''s');

-- ---------------------------------------------------------------------------
-- Not Interested does not end a match
-- ---------------------------------------------------------------------------
select lives_ok($$select public.mark_not_interested('a0000001-0000-0000-0000-000000000000')$$, 'C hides A from the feed');
select is((select state from public.get_match_state(pg_temp.uid(1))), 'matched', 'the match is still there');
select lives_ok(format($$select public.send_message(%L, 'still here')$$,
  (select match_id from public.get_conversations())), 'and they can still chat');

-- ---------------------------------------------------------------------------
-- Block ends the match and the chat; unblock restores nothing
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.become(1);
set local role authenticated;
select lives_ok($$select public.block_user('a0000003-0000-0000-0000-000000000000')$$, 'A blocks C');
select is((select state from public.get_match_state(pg_temp.uid(3))), 'none', 'A no longer sees a match');
select is(public.get_my_match_count(), 0::bigint, 'A''s match count is 0');
select is((select count(*) from public.get_conversations()), 0::bigint, 'the chat is gone for A');
select is((select count(*) from public.get_incoming_match_requests()), 0::bigint, 'and Incoming is empty');
select is((select count(*) from public.get_outgoing_match_requests()), 1::bigint, 'A still has the request to B');
select throws_ok($$select public.send_match_request('a0000003-0000-0000-0000-000000000000')$$, 'P0002', 'Person not found.',
  'A cannot request C after blocking');

reset role;
select pg_temp.become(3);
set local role authenticated;
select is((select state from public.get_match_state(pg_temp.uid(1))), 'none', 'C sees none — never that they were blocked');
select is((select count(*) from public.get_conversations()), 0::bigint, 'the chat is gone for C too');
select throws_ok($$select public.send_match_request('a0000001-0000-0000-0000-000000000000')$$, 'P0002', 'Person not found.',
  'C cannot request A either');
select is((select count(*) from public.matches), 0::bigint,
  'C cannot read the ended match row');

reset role;
select is((select ended_reason from public.matches
           where user_a = least(pg_temp.uid(1), pg_temp.uid(3))
             and user_b = greatest(pg_temp.uid(1), pg_temp.uid(3)) and ended_at is not null),
  'blocked', 'the ended match is kept for moderators');
select is((select count(*) from public.messages m join public.matches mt on mt.id = m.match_id
           where mt.ended_reason = 'blocked'), 2::bigint, 'the messages are kept too');

select pg_temp.become(1);
set local role authenticated;
select lives_ok($$select public.unblock_user('a0000003-0000-0000-0000-000000000000')$$, 'A unblocks C');
select is((select state from public.get_match_state(pg_temp.uid(3))), 'none', 'unblocking does not restore the match');
select is((select count(*) from public.get_conversations()), 0::bigint, 'or the chat');
select is(public.send_match_request(pg_temp.uid(3)), 'sent', 'they can match again from scratch');
reset role;
select pg_temp.become(3);
set local role authenticated;
select is(public.send_match_request(pg_temp.uid(1)), 'matched', 'and a new match is a new conversation');
select is((select last_message_body from public.get_conversations()), null, 'the old messages are not in it');

-- ---------------------------------------------------------------------------
-- Unmatch ends the chat without hiding anyone from the feed
-- ---------------------------------------------------------------------------
reset role;
insert into public.follows (follower_id, followed_id) values (pg_temp.uid(1), pg_temp.uid(3));
select pg_temp.become(1);
set local role authenticated;
select is((select match_state from public.get_feed(50, 0, public.utc_today()) where first_name = 'C'),
  'matched', 'the heart stays selected while they are matched');
select lives_ok($$select public.unmatch_user('a0000003-0000-0000-0000-000000000000')$$, 'A unmatches C');
select is((select count(*) from public.get_conversations()), 0::bigint, 'the chat is gone for A');
select is((select state from public.get_match_state(pg_temp.uid(3))), 'none', 'and they are no longer matched');
select is((select match_state from public.get_feed(50, 0, public.utc_today()) where first_name = 'C'),
  'none', 'C is still in A''s feed, with an unselected heart');
select is((select following from public.get_follow_state(pg_temp.uid(3))), true, 'unmatching does not unfollow');
select throws_ok($$select public.unmatch_user('a0000003-0000-0000-0000-000000000000')$$, 'P0002', 'Conversation not found.',
  'unmatching twice looks like there is no conversation');
reset role;
select pg_temp.become(3);
set local role authenticated;
select is((select count(*) from public.get_conversations()), 0::bigint, 'the chat is gone for C too');
select lives_ok($$select public.undo_not_interested('a0000001-0000-0000-0000-000000000000')$$,
  'C had hidden A from the feed earlier; undo so we can check the feed');
select is((select match_state from public.get_feed(50, 0, public.utc_today()) where first_name = 'A'),
  'none', 'A is still in C''s feed — C is not told they were unmatched');
select is(public.send_match_request(pg_temp.uid(1)), 'sent', 'they can send a new request after unmatching');
reset role;
select is((select ended_reason from public.matches
           where user_a = least(pg_temp.uid(1), pg_temp.uid(3))
             and user_b = greatest(pg_temp.uid(1), pg_temp.uid(3))
             and ended_reason = 'unmatched' limit 1),
  'unmatched', 'the unmatched row is kept for moderators');

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
reset role;
select ok(exists (
  select 1 from pg_catalog.pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
), 'messages are in the supabase_realtime publication');

-- ---------------------------------------------------------------------------
-- Notifications: request, match, mute, cancel, one-a-day, email hourly
-- ---------------------------------------------------------------------------
reset role;
delete from public.notification_outbox;

select pg_temp.become(4);
set local role authenticated;
select is(public.send_match_request(pg_temp.uid(8)), 'sent', 'D requests F');
reset role;
select is((select kind from public.notification_outbox where user_id = pg_temp.uid(8)), 'match_request',
  'F is queued a match-request notification');
select pg_temp.become(4);
set local role authenticated;
select lives_ok($$select public.cancel_match_request('a0000008-0000-0000-0000-000000000000')$$, 'D cancels');
select is(public.send_match_request(pg_temp.uid(8)), 'sent', 'and sends again the same day');
reset role;
select is((select count(*) from public.notification_outbox where user_id = pg_temp.uid(8) and kind = 'match_request'),
  1::bigint, 'cancelling and re-sending does not queue a second notification that day');

set local role service_role;
select is((select last_error from public.notification_outbox where user_id = pg_temp.uid(8)), null,
  'the first row is still pending (request is open again)');
-- cancel the open request so the worker skips it
reset role;
select pg_temp.become(4);
set local role authenticated;
select public.cancel_match_request(pg_temp.uid(8));
reset role;
set local role service_role;
select is((select count(*) from public.claim_notifications(20) where user_id = pg_temp.uid(8)), 0::bigint,
  'claim returns nothing for a cancelled request');
reset role;
select is((select status || '/' || last_error from public.notification_outbox where user_id = pg_temp.uid(8)),
  'skipped/request no longer open', 'the worker drops a request that is no longer open');

-- match notification for the other person; block before send drops it
reset role;
select pg_temp.become(4);
set local role authenticated;
select public.send_match_request(pg_temp.uid(8));
reset role;
select pg_temp.become(8);
set local role authenticated;
select public.accept_match_request(pg_temp.uid(4));
reset role;
select is((select kind from public.notification_outbox where user_id = pg_temp.uid(4) and kind = 'match'), 'match',
  'D is told about the match, not F who just accepted');
select pg_temp.become(8);
set local role authenticated;
select public.block_user(pg_temp.uid(4));
reset role;
set local role service_role;
select is((select count(*) from public.claim_notifications(20) where user_id = pg_temp.uid(4) and type = 'matches'
           and title = 'It''s a match!'), 0::bigint, 'a match that has already ended is not sent');
reset role;
select is((select last_error from public.notification_outbox where user_id = pg_temp.uid(4) and kind = 'match'),
  'match ended', 'recorded as skipped');

-- messages: mute skips; email at most once an hour
reset role;
select pg_temp.become(2);
set local role authenticated;
select public.send_match_request(pg_temp.uid(7));
reset role;
select pg_temp.become(7);
set local role authenticated;
select public.accept_match_request(pg_temp.uid(2));
select public.set_conversation_muted((select match_id from public.get_conversations() where user_id = pg_temp.uid(2)), true);
reset role;
select pg_temp.become(2);
set local role authenticated;
select public.send_message((select match_id from public.get_conversations()), 'hello E');
reset role;
set local role service_role;
select is((select count(*) from public.claim_notifications(20) where user_id = pg_temp.uid(7)), 0::bigint,
  'a muted conversation does not notify');
reset role;
select is((select last_error from public.notification_outbox where kind = 'message' and user_id = pg_temp.uid(7)),
  'conversation muted', 'recorded as muted');

reset role;
select pg_temp.become(7);
set local role authenticated;
select public.set_conversation_muted((select match_id from public.get_conversations() where user_id = pg_temp.uid(2)), false);
select public.set_notification_preference('messages', 'email', true);
reset role;
select pg_temp.become(2);
set local role authenticated;
select public.send_message((select match_id from public.get_conversations()), 'first');
select public.send_message((select match_id from public.get_conversations()), 'second');
reset role;
set local role service_role;
create temp table claimed as select * from public.claim_notifications(20);
grant select on claimed to public;
select is((select count(*) from claimed where user_id = pg_temp.uid(7) and type = 'messages'), 2::bigint,
  'both messages are handed to the worker for push');
select is((select send_email from claimed where user_id = pg_temp.uid(7) and body = 'first'), true,
  'the first message may go by email');
select is((select send_email from claimed where user_id = pg_temp.uid(7) and body = 'second'), false,
  'the second email in the same hour is held back');
reset role;

select * from finish();
rollback;
