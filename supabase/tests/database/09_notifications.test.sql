-- Phase 5 rules: notification preferences (push and email, per type), phone
-- push tokens, the daily-question notification, the queue that the worker
-- reads, retries, email unsubscribe, and the schedule.
begin;
select plan(78);

delete from public.answers;
delete from public.videos;
delete from public.questions;
insert into public.questions (question_date, text) values (public.utc_today(), 'Cats or dogs? Make your case.');

create function pg_temp.uid(n int) returns uuid language sql
as $$ select ('f' || lpad(n::text, 7, '0') || '-0000-0000-0000-000000000000')::uuid $$;
create function pg_temp.claims(n int) returns text language sql
as $$ select json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text $$;
create function pg_temp.person(n int, finished boolean default true) returns void language plpgsql as $$
begin
  insert into auth.users (id, email, aud, role, instance_id)
  values (pg_temp.uid(n), 'u' || n || '@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  update public.profiles set first_name = 'U' || n, gender = 'Woman', birthday = '1995-05-05',
    profile_completed_at = case when finished then now() end where id = pg_temp.uid(n);
end $$;

-- 1 has a phone and default settings   2 has a phone but turned everything off for daily questions
-- 3 has no phone but turned email on   4 has no phone and defaults   5 has an unfinished profile
-- (people left in a local database by other test runs must not take part)
delete from auth.users;
select pg_temp.person(1); select pg_temp.person(2); select pg_temp.person(3); select pg_temp.person(4); select pg_temp.person(5, false);

-- ---------------------------------------------------------------------------
-- Preferences
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$select * from public.get_notification_preferences()$$, '42501', null, 'a signed-out visitor cannot read preferences');
select throws_ok($$select public.set_notification_preference('nudges', 'push', false)$$, '42501', null, 'or change them');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select is((select array_agg(type) from public.get_notification_preferences()), array['daily_question', 'matches', 'messages', 'nudges'],
  'there are four notification types');
select is((select array_agg(push_enabled) from public.get_notification_preferences()), array[true, true, true, true], 'push is on for every type by default');
select is((select array_agg(email_enabled) from public.get_notification_preferences()), array[false, true, false, false], 'email is on only for matches by default');
select lives_ok($$select public.set_notification_preference('nudges', 'push', false)$$, 'a user can turn off push for one type');
select is((select push_enabled || '/' || email_enabled from public.get_notification_preferences() where type = 'nudges'), 'false/false',
  'the other channel keeps its default');
select lives_ok($$select public.set_notification_preference('daily_question', 'email', true)$$, 'and turn email on for another');
select is((select push_enabled || '/' || email_enabled from public.get_notification_preferences() where type = 'daily_question'), 'true/true', 'push stays on');
select lives_ok($$select public.set_notification_preference('nudges', 'email', true)$$, 'both channels can be set separately for one type');
select is((select push_enabled || '/' || email_enabled from public.get_notification_preferences() where type = 'nudges'), 'false/true', 'each keeps its own value');
select throws_ok($$select public.set_notification_preference('spam', 'push', true)$$, '23514', null, 'an unknown type is refused');
select throws_ok($$select public.set_notification_preference('nudges', 'sms', true)$$, '23514', null, 'an unknown channel is refused');
select throws_ok($$select public.set_notification_preference('nudges', 'push', null)$$, '23514', null, 'on or off is required');
select throws_ok($$insert into public.notification_preferences (user_id, type, push_enabled, email_enabled) values (auth.uid(), 'nudges', true, true)$$,
  '42501', null, 'preferences cannot be written directly');
select is((select count(*) from public.notification_preferences), 2::bigint, 'a user can read their own stored preferences');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(4), true);
set local role authenticated;
select is((select array_agg(email_enabled) from public.get_notification_preferences()), array[false, true, false, false], 'another user''s settings are not affected');
select is((select count(*) from public.notification_preferences), 0::bigint, 'and cannot be read');

-- ---------------------------------------------------------------------------
-- Phone push tokens
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select lives_ok($$select public.register_device_token('ExponentPushToken[abc-123_X]', 'ios')$$, 'a user can register a phone');
select lives_ok($$select public.register_device_token('ExponentPushToken[abc-123_X]', 'ios')$$, 'registering the same phone again is harmless');
select is((select count(*) from public.device_tokens), 1::bigint, 'there is one token');
select throws_ok($$select public.register_device_token('not-a-token', 'ios')$$, '23514', null, 'a malformed token is refused');
select throws_ok($$select public.register_device_token('ExponentPushToken[ok]', 'windows')$$, '23514', null, 'an unknown platform is refused');
select throws_ok($$insert into public.device_tokens (user_id, token, platform) values (auth.uid(), 'ExponentPushToken[x]', 'ios')$$, '42501', null,
  'tokens cannot be written directly');
select lives_ok($$select public.register_device_token('ExponentPushToken[b' || n || ']', 'android') from generate_series(1, 12) n$$,
  'many phones can be registered');
select is((select count(*) from public.device_tokens), 10::bigint, 'only the newest 10 are kept');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(2), true);
set local role authenticated;
select is((select count(*) from public.device_tokens), 0::bigint, 'another user cannot read those tokens');
select lives_ok($$select public.unregister_device_token('ExponentPushToken[b1]')$$, 'unregistering someone else''s token is a harmless no-op');
select lives_ok($$select public.register_device_token('ExponentPushToken[abc-123_X]', 'ios')$$, 'a shared phone can be registered by a new sign-in');
select is((select count(*) from public.device_tokens), 1::bigint, 'the phone now belongs to the new user');
reset role;
select is((select user_id from public.device_tokens where token = 'ExponentPushToken[abc-123_X]'), pg_temp.uid(2), 'and no longer to the old one');
delete from public.device_tokens where user_id = pg_temp.uid(1);
select set_config('request.jwt.claims', pg_temp.claims(2), true);
set local role authenticated;
select lives_ok($$select public.unregister_device_token('ExponentPushToken[abc-123_X]')$$, 'a user can remove their own token');
select is((select count(*) from public.device_tokens), 0::bigint, 'it is gone');
reset role;

-- ---------------------------------------------------------------------------
-- The daily-question notification
-- ---------------------------------------------------------------------------
-- setting the scene: 1 and 2 have phones; 2 turns off both channels for daily questions; 3 turns email on
delete from public.device_tokens;
insert into public.device_tokens (user_id, token, platform) values
  (pg_temp.uid(1), 'ExponentPushToken[u1]', 'ios'), (pg_temp.uid(2), 'ExponentPushToken[u2]', 'android');
delete from public.notification_preferences;
insert into public.notification_preferences (user_id, type, push_enabled, email_enabled) values
  (pg_temp.uid(2), 'daily_question', false, false), (pg_temp.uid(3), 'daily_question', true, true);

select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select throws_ok($$select public.enqueue_daily_question_notifications()$$, '42501', null, 'the app cannot queue the daily notification');
select throws_ok($$select * from public.notification_outbox$$, '42501', null, 'the app cannot read the notification queue');
select throws_ok($$select * from public.claim_notifications()$$, '42501', null, 'the app cannot act as the worker');
select throws_ok($$select public.complete_notification(gen_random_uuid(), true)$$, '42501', null, 'or report results');
select throws_ok($$select public.unsubscribe_email(auth.uid(), 'all')$$, '42501', null, 'or unsubscribe someone by id');
select throws_ok($$select public.remove_device_token('ExponentPushToken[u1]')$$, '42501', null, 'or remove tokens by name');
select throws_ok($$select * from private.worker_config$$, '42501', null, 'and cannot read the worker secret');

reset role;
set local role service_role;
select is(public.enqueue_daily_question_notifications(), 4, 'everyone with a finished profile is queued (not the unfinished one)');
select is(public.enqueue_daily_question_notifications(), 0, 'running it again queues nobody twice');
create temp table work as select * from public.claim_notifications(200);
grant select on work to public;
select is((select count(*) from work), 2::bigint, 'the worker gets 2 of the 4: people with no channel are skipped');
select is((select title from work where user_id = pg_temp.uid(1)), 'Today''s question is live', 'the title says the question is live');
select is((select body from work where user_id = pg_temp.uid(1)), 'Cats or dogs? Make your case.', 'the body is today''s question');
select is((select send_push || '/' || send_email from work where user_id = pg_temp.uid(1)), 'true/false', 'default: push only');
select is((select array_to_string(push_tokens, ',') from work where user_id = pg_temp.uid(1)), 'ExponentPushToken[u1]', 'with that person''s own phone');
select is((select send_push || '/' || send_email from work where user_id = pg_temp.uid(3)), 'false/true', 'a user with email on and no phone gets email only');
select is((select email from work where user_id = pg_temp.uid(3)), 'u3@example.com', 'sent to their address');
select is((select count(*) from work where user_id = pg_temp.uid(2)), 0::bigint, 'a user who turned both channels off hears nothing');
select is((select count(*) from work where user_id = pg_temp.uid(4)), 0::bigint, 'a user with no phone and email off hears nothing');
reset role;
select is((select status from public.notification_outbox where user_id = pg_temp.uid(2)), 'skipped', 'those are recorded as skipped');
select is((select count(*) from public.notification_outbox where user_id = pg_temp.uid(5)), 0::bigint, 'an unfinished profile is not queued');

-- ---------------------------------------------------------------------------
-- Sending, retries, and a worker that dies
-- ---------------------------------------------------------------------------
set local role service_role;
select lives_ok($$select public.complete_notification(id, true) from work where user_id = pg_temp.uid(1)$$, 'success is recorded');
reset role;
select is((select status from public.notification_outbox where user_id = pg_temp.uid(1)), 'sent', 'as sent');

select private.enqueue_notification(pg_temp.uid(1), 'messages', 'generic', 'New message', 'Hi!', '{}'::jsonb, now(), 'msg:1');
select is(private.enqueue_notification(pg_temp.uid(1), 'messages', 'generic', 'New message', 'Hi!', '{}'::jsonb, now(), 'msg:1'), false,
  'the same dedupe key never queues twice');
set local role service_role;
select is((select count(*) from public.claim_notifications() where user_id = pg_temp.uid(1)), 1::bigint, 'a generic message is handed to the worker');
select lives_ok($$select public.complete_notification(id, false, 'Resend said no') from public.notification_outbox where dedupe_key = 'msg:1'$$,
  'a failure is reported');
reset role;
select is((select status || '/' || attempts from public.notification_outbox where dedupe_key = 'msg:1'), 'pending/1', 'it goes back to pending, one try used');
select is((select last_error from public.notification_outbox where dedupe_key = 'msg:1'), 'Resend said no', 'with the reason');
set local role service_role;
select is((select count(*) from public.claim_notifications() where user_id = pg_temp.uid(1)), 0::bigint, 'it waits a few minutes before the next try');
reset role;
update public.notification_outbox set send_after = now() where dedupe_key = 'msg:1';
set local role service_role;
select is((select count(*) from public.claim_notifications() where user_id = pg_temp.uid(1)), 1::bigint, 'then it is tried again');
select public.complete_notification(id, false, 'again') from public.notification_outbox where dedupe_key = 'msg:1';
reset role;
update public.notification_outbox set send_after = now() where dedupe_key = 'msg:1';
set local role service_role;
select is((select count(*) from public.claim_notifications() where user_id = pg_temp.uid(1)), 1::bigint, 'and a third time');
select public.complete_notification(id, false, 'third') from public.notification_outbox where dedupe_key = 'msg:1';
reset role;
select is((select status from public.notification_outbox where dedupe_key = 'msg:1'), 'failed', 'after three tries it is marked failed');

select private.enqueue_notification(pg_temp.uid(1), 'messages', 'generic', 'New message', 'Stuck', '{}'::jsonb, now(), 'msg:2');
set local role service_role;
select is((select count(*) from public.claim_notifications() where user_id = pg_temp.uid(1)), 1::bigint, 'claimed once');
select is((select count(*) from public.claim_notifications() where user_id = pg_temp.uid(1)), 0::bigint, 'a claimed notification is not handed out again straight away');
reset role;
update public.notification_outbox set claimed_at = now() - interval '11 minutes' where dedupe_key = 'msg:2';
set local role service_role;
select is((select count(*) from public.claim_notifications() where user_id = pg_temp.uid(1)), 1::bigint, 'but if the worker died, it is picked up again');

-- ---------------------------------------------------------------------------
-- Email unsubscribe
-- ---------------------------------------------------------------------------
select lives_ok($$select public.unsubscribe_email(pg_temp.uid(3), 'daily_question')$$, 'the server can unsubscribe one type');
reset role;
select is((select email_enabled || '/' || push_enabled from public.notification_preferences where user_id = pg_temp.uid(3) and type = 'daily_question'),
  'false/true', 'email is off and push is untouched');
set local role service_role;
select lives_ok($$select public.unsubscribe_email(pg_temp.uid(4), 'all')$$, 'or all types at once');
select throws_ok($$select public.unsubscribe_email(pg_temp.uid(4), 'spam')$$, '23514', null, 'an unknown type is refused');
select lives_ok($$select public.unsubscribe_email(gen_random_uuid(), 'all')$$, 'an unknown person is ignored, revealing nothing');
reset role;
select is((select array_agg(email_enabled) from public.notification_preferences where user_id = pg_temp.uid(4)), array[false, false, false, false],
  'everything is off after unsubscribing from all');
select set_config('request.jwt.claims', pg_temp.claims(4), true);
set local role authenticated;
select is((select array_agg(push_enabled) from public.get_notification_preferences()), array[true, true, true, true], 'push stays on');
select is((select array_agg(email_enabled) from public.get_notification_preferences()), array[false, false, false, false], 'the app shows email off for all types');

-- ---------------------------------------------------------------------------
-- Schedule
-- ---------------------------------------------------------------------------
reset role;
select is((select schedule from cron.job where jobname = 'daily-question-notifications'), '0 0 * * *', 'the daily question is queued at the start of each UTC day');
select is((select schedule from cron.job where jobname = 'notification-worker'), '* * * * *', 'the worker is woken every minute');
select lives_ok($$select private.kick_notification_worker()$$, 'waking the worker does nothing until it is configured');

select * from finish();
rollback;
