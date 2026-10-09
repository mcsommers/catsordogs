-- Phase 8: admins can see every profile and every video, a watch does not
-- count as a view, unhiding restores one video only, profile-question lists
-- are admin-only, and a missing next-day question emails each admin once.
begin;
select plan(52);

delete from public.moderation_actions;
delete from public.flags;
delete from public.reports;
delete from public.answers;
delete from public.videos;
delete from public.notification_outbox;
delete from public.admin_users;
delete from public.questions;
insert into public.questions (question_date, text) values
  (public.utc_today(), 'Today'),
  (public.utc_today() + 1, 'Tomorrow already set');

create function pg_temp.uid(n int) returns uuid language sql
as $$ select ('d' || lpad(n::text, 7, '0') || '-0000-0000-0000-000000000000')::uuid $$;
create function pg_temp.become(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text, true)
$$;

insert into auth.users (id, email, aud, role, instance_id) values
  (pg_temp.uid(1), 'ada@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  (pg_temp.uid(2), 'bo@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
update public.profiles set first_name = 'Ada', gender = 'Woman', birthday = '1994-04-04',
  city = 'Austin', about_me = 'Hello', profile_completed_at = now() where id = pg_temp.uid(1);
update public.profiles set first_name = 'Bo', gender = 'Man', birthday = '1992-02-02',
  profile_completed_at = now() where id = pg_temp.uid(2);
insert into public.profile_photos (user_id, position, storage_path) values
  (pg_temp.uid(1), 1, pg_temp.uid(1)::text || '/1.jpg'),
  (pg_temp.uid(1), 2, pg_temp.uid(1)::text || '/2.jpg');
insert into public.admin_users (user_id) values (pg_temp.uid(2));
insert into public.matches (id, user_a, user_b)
values ('d3000000-0000-0000-0000-000000000001', pg_temp.uid(1), pg_temp.uid(2));
insert into public.messages (id, match_id, sender_id, body) values
  ('d4000000-0000-0000-0000-000000000001', 'd3000000-0000-0000-0000-000000000001', pg_temp.uid(2), 'Hi Ada'),
  ('d4000000-0000-0000-0000-000000000002', 'd3000000-0000-0000-0000-000000000001', pg_temp.uid(1), 'A reported line');
insert into public.moderation_actions (kind, target_user_id, snapshot)
values ('profile', pg_temp.uid(1), '{"first_name":"Ada"}');
insert into public.moderation_actions (kind, target_user_id, message_id, snapshot)
values ('message', pg_temp.uid(1), 'd4000000-0000-0000-0000-000000000002', '{"first_name":"Ada","body":"A reported line"}');
insert into public.follows (follower_id, followed_id) values (pg_temp.uid(2), pg_temp.uid(1));
update auth.users set last_sign_in_at = '2026-10-08 15:00:00+00' where id = pg_temp.uid(1);

insert into public.videos (id, user_id, question_id, status, mux_playback_id, duration_seconds, captions_status, caption_segments)
values
  ('d1000000-0000-0000-0000-000000000001', pg_temp.uid(1), (select id from public.questions where question_date = public.utc_today()),
   'ready', 'play-hidden', 8, 'unavailable', '[]'),
  ('d1000000-0000-0000-0000-000000000002', pg_temp.uid(1), (select id from public.questions where question_date = public.utc_today() + 1),
   'ready', 'play-live', 8, 'unavailable', '[]');
-- Two answers cannot share a question for one person, so the live one is tomorrow's question
-- filed as a recording that is not today's answer. The hidden answer is today's.
insert into public.answers (id, user_id, question_id, video_id, duration_seconds, caption_text, status)
values
  ('d2000000-0000-0000-0000-000000000001', pg_temp.uid(1),
   (select id from public.questions where question_date = public.utc_today()),
   'd1000000-0000-0000-0000-000000000001', 8, 'hidden caption', 'disabled'),
  ('d2000000-0000-0000-0000-000000000002', pg_temp.uid(1),
   (select id from public.questions where question_date = public.utc_today() + 1),
   'd1000000-0000-0000-0000-000000000002', 8, 'live caption', 'disabled');
insert into public.moderation_actions (kind, answer_id, target_user_id, snapshot)
values
  ('answer', 'd2000000-0000-0000-0000-000000000001', pg_temp.uid(1), '{"first_name":"Ada"}'),
  ('answer', 'd2000000-0000-0000-0000-000000000002', pg_temp.uid(1), '{"first_name":"Ada"}');
create temp table queue_ids (label text primary key, id uuid not null);
insert into queue_ids select 'hidden_today', id from public.moderation_actions where answer_id = 'd2000000-0000-0000-0000-000000000001';
insert into queue_ids select 'hidden_tomorrow', id from public.moderation_actions where answer_id = 'd2000000-0000-0000-0000-000000000002';
insert into queue_ids select 'profile', id from public.moderation_actions where kind = 'profile';
insert into queue_ids select 'message', id from public.moderation_actions where kind = 'message';
grant select on queue_ids to public;

-- ---------------------------------------------------------------------------
-- An ordinary person
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.become(1);

select throws_ok($$select * from public.admin_list_people()$$, '42501', null, 'a user cannot list people');
select throws_ok($$select * from public.admin_list_videos()$$, '42501', null, 'a user cannot list videos');
select throws_ok($$select * from public.admin_get_video_for_playback('d1000000-0000-0000-0000-000000000001', null)$$,
  '42501', null, 'a user cannot take an admin playback link');
select throws_ok($$select public.admin_unhide_answer('d2000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'a user cannot unhide a video');
select throws_ok($$select * from public.follows$$, '42501', null, 'a user still cannot read who follows whom');
select throws_ok($$insert into public.profile_options (category, value) values ('interest', 'Sneaky')$$,
  '42501', null, 'a user cannot add a profile choice');
select is_empty($$update public.profile_field_defs set max_selected = 1 where field = 'interests' returning 1$$,
  'a user cannot change a profile question');
select throws_ok($$select public.enqueue_missing_question_alerts()$$, '42501', null, 'a user cannot queue the missing-question email');
select throws_ok($$select * from public.admin_question_answer_counts()$$, '42501', null,
  'a user cannot see how many people answered');
select throws_ok($$select public.admin_queue_item_content((select id from queue_ids where label = 'profile'))$$,
  '42501', null, 'a user cannot open a review item');

-- ---------------------------------------------------------------------------
-- An admin
-- ---------------------------------------------------------------------------
select pg_temp.become(2);

select throws_ok($$select * from public.follows$$, '42501', null, 'an admin still cannot read follower identities');
select throws_ok($$select * from public.nudges$$, '42501', null, 'an admin still cannot read who nudged whom');
select throws_ok($$select follower_id from public.admin_list_people()$$, '42703', null,
  'the people list has no follower identity column');
select throws_ok($$select followed_id from public.admin_list_people()$$, '42703', null,
  'the people list has no following identity column');

select is((select first_name from public.admin_list_people() where id = pg_temp.uid(1)), 'Ada',
  'an admin can see another person');
select is((select email from public.admin_list_people() where id = pg_temp.uid(1)), 'ada@example.com',
  'an admin can see the account email');
select is((select photos from public.admin_list_people() where id = pg_temp.uid(1)) -> 1 ->> 'storage_path',
  pg_temp.uid(1)::text || '/2.jpg', 'an admin can see every photo, not only the first');
select is((select follower_count from public.admin_list_people() where id = pg_temp.uid(1)), 1::bigint,
  'an admin sees a follower count and nothing else about followers');
select is((select following_count from public.admin_list_people() where id = pg_temp.uid(1)), 0::bigint,
  'Ada is not following anyone');
select is((select following_count from public.admin_list_people() where id = pg_temp.uid(2)), 1::bigint,
  'an admin sees a following count and nothing else about who they follow');
select is((select match_count from public.admin_list_people() where id = pg_temp.uid(1)), 1::bigint,
  'an admin sees how many matches a person has');
select is((select answer_count from public.admin_list_people() where id = pg_temp.uid(1)), 2::bigint,
  'an admin sees how many answers a person has');
select is((select last_sign_in_at from public.admin_list_people() where id = pg_temp.uid(1)),
  '2026-10-08 15:00:00+00'::timestamptz, 'an admin sees last login');

select is((select count(*) from public.admin_list_videos() where answer_status = 'disabled'), 2::bigint,
  'an admin can see hidden videos');
select is((select mux_playback_id from public.admin_get_video_for_playback(null, 'd2000000-0000-0000-0000-000000000001')),
  'play-hidden', 'an admin can watch a hidden video');
reset role;
select is((select count(*) from public.answer_views), 0::bigint, 'an admin watch does not count as a view');
set local role authenticated;
select pg_temp.become(2);

select lives_ok($$select public.admin_unhide_answer('d2000000-0000-0000-0000-000000000001')$$, 'an admin can unhide a video');
reset role;
select is((select status from public.answers where id = 'd2000000-0000-0000-0000-000000000001'), 'live',
  'unhide puts that video back');
select is((select status from public.answers where id = 'd2000000-0000-0000-0000-000000000002'), 'disabled',
  'unhide does not touch a different video');
select is((select status from public.moderation_actions where answer_id = 'd2000000-0000-0000-0000-000000000001'),
  'restored', 'unhide closes the waiting review as put back');
select ok((select profile_completed_at is not null from public.profiles where id = pg_temp.uid(1)),
  'unhide does not change the account');
set local role authenticated;
select pg_temp.become(2);
select throws_ok($$select public.admin_unhide_answer('d2000000-0000-0000-0000-000000000001')$$,
  '23514', 'That video is not hidden.', 'a video that is already visible cannot be unhidden');

reset role;
select set_config('request.jwt.claims', '', true);
insert into public.questions (question_date, text) values (public.utc_today() - 1, 'Yesterday');
set local role authenticated;
select pg_temp.become(2);
select is((select answer_count from public.admin_question_answer_counts()
            where question_id = (select id from public.questions where question_date = public.utc_today())),
  1::bigint, 'a hidden answer still counts as a person who answered');
select is((select answer_count from public.admin_question_answer_counts()
            where question_id = (select id from public.questions where question_date = public.utc_today() - 1)),
  0::bigint, 'a question nobody answered shows zero');
select is_empty($$select * from public.admin_question_answer_counts()
                  where question_id = (select id from public.questions where question_date = public.utc_today() + 1)$$,
  'an upcoming question has no answer count');

select lives_ok($$insert into public.profile_options (category, value, description, sort_order) values ('interest', 'Birding', 'Watching birds', 20)$$,
  'an admin can add a profile choice');
select lives_ok($$update public.profile_options set active = false where category = 'interest' and value = 'Birding'$$,
  'an admin can retire a choice');
select throws_ok($$insert into public.profile_options (category, value) values ('not_a_question', 'Nope')$$,
  '23514', 'That list is not used by a profile question.', 'a choice has to belong to a real question');
select lives_ok($$update public.profile_field_defs set max_selected = 4 where field = 'interests'$$,
  'an admin can change how many choices a question allows');
select is((select max_selected from public.profile_field_defs where field = 'interests'), 4, 'the new limit is stored');

select is((select public.admin_queue_item_content((select id from queue_ids where label = 'hidden_tomorrow')) ->> 'caption_text'),
  'live caption', 'an admin can open a hidden video from the queue');
select is((select public.admin_queue_item_content((select id from queue_ids where label = 'profile')) ->> 'about_me'),
  'Hello', 'an admin can open the reported profile from the queue');
select is((select jsonb_array_length(public.admin_queue_item_content((select id from queue_ids where label = 'message')) -> 'messages')),
  2, 'an admin can open the full chat around a reported message');
select is((select count(*) from jsonb_array_elements(
            public.admin_queue_item_content((select id from queue_ids where label = 'message')) -> 'messages')
            e where e ->> 'reported' = 'true' and e ->> 'body' = 'A reported line'),
  1::bigint, 'the reported message is marked in that chat');

-- The email job is not something the website calls. It runs as the database.
reset role;

-- Tomorrow already has a question, so nobody is emailed. A far-off day does not.
select is(public.enqueue_missing_question_alerts(), 0, 'no email when tomorrow has a question');
select is(public.enqueue_missing_question_alerts('2030-06-01 12:00+00'::timestamptz), 1,
  'each admin is emailed once when the next day is empty');
select is(public.enqueue_missing_question_alerts('2030-06-01 18:00+00'::timestamptz), 0,
  'running it again the same day does not email them twice');
select is((select type from public.notification_outbox where dedupe_key = 'missing_question:2030-06-02'),
  'admin_alert', 'the warning is an admin email, not a user notification');
select ok((select body like '%June 2, 2030%' from public.notification_outbox where dedupe_key = 'missing_question:2030-06-02'),
  'the email names the missing day');

insert into public.questions (question_date, text) values ('2030-06-02', 'Added in time');
select is_empty(
  $$select * from public.claim_notifications(10) where data ->> 'question_date' = '2030-06-02'$$,
  'if the question is added before the email goes out, it is not sent');
select is((select status from public.notification_outbox where dedupe_key = 'missing_question:2030-06-02'),
  'skipped', 'the dropped warning is marked skipped');

select is((select schedule from cron.job where jobname = 'missing-question-alerts'), '5 * * * *',
  'the missing-question check runs every hour');

select * from finish();
rollback;
