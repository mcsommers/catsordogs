-- Phase 3 rules: recording attempts, the length limit, and caption editing.
begin;
select plan(75);

delete from public.videos;
delete from public.questions;
insert into public.questions (question_date, text) values (public.utc_today(), 'Today''s question');

insert into auth.users (id, email, aud, role, instance_id) values
  ('c1000000-0000-0000-0000-0000000000c1', 'one@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('c2000000-0000-0000-0000-0000000000c2', 'two@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('c3000000-0000-0000-0000-0000000000c3', 'three@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
-- users one and two have finished their profiles; user three has not
update public.profiles set profile_completed_at = now()
  where id in ('c1000000-0000-0000-0000-0000000000c1', 'c2000000-0000-0000-0000-0000000000c2');

-- ---------------------------------------------------------------------------
-- Not allowed to start a recording
-- ---------------------------------------------------------------------------
set local role anon;
select throws_ok($$select * from public.request_video_upload()$$, '42501', null, 'a signed-out visitor cannot start a recording');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c3000000-0000-0000-0000-0000000000c3","role":"authenticated"}', true);
select throws_ok($$select * from public.request_video_upload()$$, '23514', 'Finish your profile before recording.',
  'a user with an unfinished profile cannot record');

-- ---------------------------------------------------------------------------
-- Starting a recording
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
create temp table started as select * from public.request_video_upload();
grant select on started to public;
select is((select count(*) from started), 1::bigint, 'starting a recording returns one new video');
select is((select recording_length_seconds from started), 14, 'the app is told the recording length');
select is((select count(*) from public.videos), 1::bigint, 'the user can see their video');
select is((select status from public.videos), 'awaiting_upload', 'a new video is waiting for its upload');
select is((select question_id from public.videos), (select id from public.questions where question_date = public.utc_today()),
  'the video belongs to today''s question');

select throws_ok($$insert into public.videos (user_id, question_id) select auth.uid(), id from public.questions$$,
  '42501', null, 'a user cannot create a video row directly');
select throws_ok($$update public.videos set status = 'ready'$$, '42501', null, 'a user cannot change a video row directly');
select throws_ok($$delete from public.videos$$, '42501', null, 'a user cannot delete a video row directly');
select throws_ok($$select public.video_asset_ready((select video_id from started), 'a', 'p', 5)$$, '42501', null,
  'a user cannot report a video as ready');
select throws_ok($$select public.video_set_captions((select video_id from started), '[]'::jsonb)$$, '42501', null,
  'a user cannot write captions through the server function');
select throws_ok($$select public.video_attach_upload((select video_id from started), 'u')$$, '42501', null,
  'a user cannot attach an upload');
select throws_ok($$select public.video_mark_failed((select video_id from started))$$, '42501', null,
  'a user cannot mark a video failed');

select set_config('request.jwt.claims', '{"sub":"c2000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select is((select count(*) from public.videos), 0::bigint, 'another user cannot see that video');
select is_empty($$select * from public.get_my_video_for_playback((select video_id from started))$$,
  'another user cannot get playback for that video');
select throws_ok($$select public.update_caption_segments((select video_id from started), array['x'])$$, 'P0002', 'Video not found.',
  'another user cannot edit its captions');
select throws_ok($$select public.reset_captions((select video_id from started))$$, 'P0002', 'Video not found.',
  'another user cannot reset its captions');

-- ---------------------------------------------------------------------------
-- Mux reports progress (server only)
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
set local role service_role;

select lives_ok($$select public.video_attach_upload((select video_id from started), 'upload-1')$$, 'the server can attach the Mux upload id');
select is((select mux_upload_id from public.videos), 'upload-1', 'the upload id is stored');
select lives_ok($$select public.video_attach_upload((select video_id from started), 'upload-OTHER')$$, 'attaching again is harmless');
select is((select mux_upload_id from public.videos), 'upload-1', 'the first upload id is kept');

select lives_ok($$select public.video_upload_asset_created((select video_id from started), 'asset-1')$$, 'the server can record the asset');
select is((select status from public.videos), 'processing', 'the video is now processing');

select is(public.video_asset_ready((select video_id from started), 'asset-1', 'playback-1', 12.5), 'ready',
  'a recording within the limit becomes ready');
select is((select mux_playback_id from public.videos), 'playback-1', 'the playback id is stored');
select is((select duration_seconds from public.videos), 12.5, 'the length is stored');
select is(public.video_asset_ready((select video_id from started), 'asset-1', 'playback-1', 12.5), 'ready',
  'a repeated ready event changes nothing');
select is(public.video_asset_ready('00000000-0000-0000-0000-000000000000', 'x', 'y', 5), 'unknown',
  'a ready event for an unknown video is ignored');

-- captions
select throws_ok($$select public.video_set_captions((select video_id from started), '{"a":1}'::jsonb)$$, '23514', null,
  'captions must be a list');
select throws_ok($$select public.video_set_captions((select video_id from started), '[{"start":1,"end":0.5,"text":"x"}]'::jsonb)$$,
  '23514', null, 'a caption cannot end before it starts');
select throws_ok($$select public.video_set_captions((select video_id from started), '[{"start":1,"end":2}]'::jsonb)$$,
  '23514', null, 'a caption needs text');
select is((select captions_status from public.videos), 'pending', 'captions stay pending until they arrive');
select lives_ok($$select public.video_set_captions((select video_id from started),
  '[{"start":0,"end":2.5,"text":"Hi there"},{"start":2.5,"end":6,"text":"I love dogs"}]'::jsonb)$$, 'the server can store captions');
select is((select captions_status from public.videos), 'ready', 'captions are now ready');
select is((select caption_segments from public.videos), (select auto_caption_segments from public.videos),
  'the viewer''s captions start equal to the automatic ones');

-- ---------------------------------------------------------------------------
-- The length limit (default 14 seconds, plus 1 second of tolerance)
-- ---------------------------------------------------------------------------
reset role;
insert into public.videos (id, user_id, question_id, status)
select ('d000000' || n || '-0000-0000-0000-000000000000')::uuid, 'c2000000-0000-0000-0000-0000000000c2',
       (select id from public.questions), 'processing'
from generate_series(1, 4) n;
set local role service_role;
select is(public.video_asset_ready('d0000001-0000-0000-0000-000000000000', 'a1', 'p1', 15.0), 'ready', 'exactly the limit plus tolerance is accepted');
select is(public.video_asset_ready('d0000002-0000-0000-0000-000000000000', 'a2', 'p2', 15.01), 'rejected', 'a hair over the limit plus tolerance is rejected');
select is((select status || '/' || reject_reason from public.videos where id = 'd0000002-0000-0000-0000-000000000000'), 'rejected/too_long',
  'a rejected video records why');
select is((select mux_playback_id from public.videos where id = 'd0000002-0000-0000-0000-000000000000'), null, 'a rejected video has no playback id');
select is(public.video_asset_ready('d0000003-0000-0000-0000-000000000000', 'a3', 'p3', 60), 'rejected', 'a very long recording is rejected');
select is(public.video_asset_ready('d0000004-0000-0000-0000-000000000000', 'a4', 'p4', null), 'rejected', 'a recording with no readable length is rejected');
select is(public.video_asset_ready('d0000002-0000-0000-0000-000000000000', 'a2', 'p2', 5), 'rejected', 'a rejected video cannot later become ready');

reset role;
update public.app_settings set recording_length_seconds = 30;
set local role service_role;
insert into public.videos (id, user_id, question_id, status) values
  ('d0000005-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-0000000000c2', (select id from public.questions), 'processing');
select is(public.video_asset_ready('d0000005-0000-0000-0000-000000000000', 'a5', 'p5', 29), 'ready', 'a changed length setting applies immediately');
reset role;
update public.app_settings set recording_length_seconds = 14;

-- failed uploads
insert into public.videos (id, user_id, question_id, status) values
  ('d0000006-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-0000000000c2', (select id from public.questions), 'processing');
set local role service_role;
select lives_ok($$select public.video_mark_failed('d0000006-0000-0000-0000-000000000000', 'cancelled')$$, 'the server can mark an upload cancelled');
select is((select status from public.videos where id = 'd0000006-0000-0000-0000-000000000000'), 'cancelled', 'the video is cancelled');
select lives_ok($$select public.video_mark_failed((select video_id from started))$$, 'marking a finished video failed does not raise');
select is((select status from public.videos where id = (select video_id from started)), 'ready', 'a ready video cannot be marked failed');
select throws_ok($$select public.video_mark_failed((select video_id from started), 'ready')$$, '23514', null, 'only failed or cancelled are valid');

-- no speech found
reset role;
insert into public.videos (id, user_id, question_id, status) values
  ('d0000007-0000-0000-0000-000000000000', 'c2000000-0000-0000-0000-0000000000c2', (select id from public.questions), 'processing');
set local role service_role;
select lives_ok($$select public.video_set_captions('d0000007-0000-0000-0000-000000000000', '[]'::jsonb)$$, 'an empty caption list is accepted');
select is((select captions_status from public.videos where id = 'd0000007-0000-0000-0000-000000000000'), 'unavailable',
  'no speech means captions are unavailable');

-- ---------------------------------------------------------------------------
-- Reviewing and editing captions (owner)
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);

select is((select mux_playback_id from public.get_my_video_for_playback((select video_id from started))), 'playback-1',
  'the owner can get playback for their ready video');
select throws_ok($$select public.update_caption_segments((select video_id from started), array['only one'])$$, '23514',
  'Send one text for each caption segment.', 'the number of edited texts must match');
select throws_ok($$select public.update_caption_segments((select video_id from started), array['a', null])$$, '23514', null,
  'an empty (null) caption text is not allowed');
select throws_ok($$select public.update_caption_segments((select video_id from started), array['a', repeat('x', 501)])$$, '23514', null,
  'a caption cannot exceed 500 characters');

select lives_ok($$select public.update_caption_segments((select video_id from started), array['  Hi there!  ', 'I love dogs and cats'])$$,
  'the owner can edit caption text');
select is((select caption_segments -> 0 ->> 'text' from public.videos where id = (select video_id from started)), 'Hi there!', 'edited text is saved and trimmed');
select is((select (caption_segments -> 1 ->> 'start')::numeric from public.videos where id = (select video_id from started)), 2.5, 'timing is not changed by editing');
select is((select auto_caption_segments -> 0 ->> 'text' from public.videos where id = (select video_id from started)), 'Hi there', 'the automatic captions are kept');
select isnt((select captions_edited_at from public.videos where id = (select video_id from started)), null, 'the edit is recorded');

select lives_ok($$select public.reset_captions((select video_id from started))$$, 'the owner can reset to the automatic captions');
select is((select caption_segments -> 1 ->> 'text' from public.videos where id = (select video_id from started)), 'I love dogs', 'reset restores the automatic text');
select is((select captions_edited_at from public.videos where id = (select video_id from started)), null, 'reset clears the edit marker');

-- ---------------------------------------------------------------------------
-- After submitting (Phase 4 sets submitted_at), captions are locked
-- ---------------------------------------------------------------------------
reset role;
select set_config('request.jwt.claims', '', true);
update public.videos set submitted_at = now() where id = (select video_id from started);
set local role service_role;
select lives_ok($$select public.video_set_captions((select video_id from started), '[{"start":0,"end":1,"text":"late"}]'::jsonb)$$,
  'a late caption delivery does not raise');
select is((select count(*) from public.videos where id = (select video_id from started) and auto_caption_segments @> '[{"text":"late"}]'), 0::bigint,
  'a late caption delivery does not change a submitted answer');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select public.update_caption_segments((select video_id from started), array['a', 'b'])$$, '23514',
  'Captions cannot be edited after the answer is submitted.', 'captions cannot be edited after submitting');
select throws_ok($$select public.reset_captions((select video_id from started))$$, '23514', null, 'captions cannot be reset after submitting');
select throws_ok($$select * from public.request_video_upload()$$, '23514', 'You have already answered today''s question.',
  'a user who has answered cannot record again today');

-- ---------------------------------------------------------------------------
-- Daily limit and "no question today"
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
-- user two already has 7 attempts today, so lower the limit to 8
reset role;
select set_config('request.jwt.claims', '', true);
update public.app_settings set max_recordings_per_day = 8;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c2000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select lives_ok($$select * from public.request_video_upload()$$, 'a user under the daily limit can record');
select throws_ok($$select * from public.request_video_upload()$$, '23514', 'You have reached today''s limit of 8 recordings.',
  'a user at the daily limit cannot start another recording');

reset role;
select set_config('request.jwt.claims', '', true);
delete from public.videos;
delete from public.questions;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok($$select * from public.request_video_upload()$$, 'P0002', 'There is no question scheduled for today.',
  'nobody can record when no question is scheduled');

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
select is_empty($$update public.app_settings set max_recordings_per_day = 99 returning 1$$, 'a user cannot change the daily limit');
reset role;
select throws_ok($$update public.app_settings set max_recordings_per_day = 0$$, '23514', null, 'the daily limit must be at least 1');
select is((select max_recordings_per_day from public.app_settings), 8, 'the daily limit setting is stored');
select is((select count(*) from public.get_app_config()), 1::bigint, 'the public config is unchanged');

select * from finish();
rollback;
