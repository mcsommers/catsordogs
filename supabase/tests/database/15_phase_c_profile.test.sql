-- Phase C: profile view, photo storage, answer archives.
begin;
select plan(13);

-- Reuse gate/feed fixture users from 04 where possible; minimal set here.
insert into auth.users (id, email, aud, role, instance_id) values
  ('c1000001-0000-0000-0000-000000000001', 'pc1@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('c1000002-0000-0000-0000-000000000002', 'pc2@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('c1000003-0000-0000-0000-000000000003', 'pc3@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

update public.profiles set
  first_name = 'Pat', birthday = (current_date - interval '25 years')::date, gender = 'Woman',
  profile_completed_at = now()
where id = 'c1000001-0000-0000-0000-000000000001';

update public.profiles set
  first_name = 'Quinn', birthday = (current_date - interval '26 years')::date, gender = 'Man',
  profile_completed_at = now()
where id = 'c1000002-0000-0000-0000-000000000002';

-- PC3 unfinished
update public.profiles set first_name = 'Unfinished' where id = 'c1000003-0000-0000-0000-000000000003';

insert into public.profile_photos (user_id, position, storage_path) values
  ('c1000002-0000-0000-0000-000000000002', 1, 'c1000002-0000-0000-0000-000000000002/1.jpg'),
  ('c1000002-0000-0000-0000-000000000002', 2, 'c1000002-0000-0000-0000-000000000002/2.jpg');

insert into storage.objects (id, bucket_id, name, owner, created_at, updated_at)
values
  (gen_random_uuid(), 'profile-photos', 'c1000002-0000-0000-0000-000000000002/1.jpg', 'c1000002-0000-0000-0000-000000000002', now(), now()),
  (gen_random_uuid(), 'profile-photos', 'c1000002-0000-0000-0000-000000000002/2.jpg', 'c1000002-0000-0000-0000-000000000002', now(), now());

insert into public.questions (id, question_date, text) values
  ('c2000001-0000-0000-0000-000000000001', '2098-06-01', 'Older Q'),
  ('c2000002-0000-0000-0000-000000000002', '2098-06-02', 'Yesterday Q'),
  ('c2000003-0000-0000-0000-000000000003', '2098-06-03', 'Today Q');

insert into public.videos (id, user_id, question_id, status, mux_playback_id, duration_seconds)
values
  ('c3000001-0000-0000-0000-000000000001', 'c1000002-0000-0000-0000-000000000002', 'c2000001-0000-0000-0000-000000000001', 'ready', 'pb-1', 10),
  ('c3000002-0000-0000-0000-000000000002', 'c1000002-0000-0000-0000-000000000002', 'c2000002-0000-0000-0000-000000000002', 'ready', 'pb-2', 10),
  ('c3000003-0000-0000-0000-000000000003', 'c1000002-0000-0000-0000-000000000002', 'c2000003-0000-0000-0000-000000000003', 'ready', 'pb-3', 10);

insert into public.answers (id, user_id, question_id, video_id, caption_text, duration_seconds, status, submitted_at)
values
  ('c4000001-0000-0000-0000-000000000001', 'c1000002-0000-0000-0000-000000000002', 'c2000001-0000-0000-0000-000000000001', 'c3000001-0000-0000-0000-000000000001', 'old', 10, 'live', now() - interval '2 days'),
  ('c4000002-0000-0000-0000-000000000002', 'c1000002-0000-0000-0000-000000000002', 'c2000002-0000-0000-0000-000000000002', 'c3000002-0000-0000-0000-000000000002', 'yesterday', 10, 'disabled', now() - interval '1 day'),
  ('c4000003-0000-0000-0000-000000000003', 'c1000002-0000-0000-0000-000000000002', 'c2000003-0000-0000-0000-000000000003', 'c3000003-0000-0000-0000-000000000003', 'today', 10, 'live', now());

set local role authenticated;
set local request.jwt.claim.sub = 'c1000001-0000-0000-0000-000000000001';

select is((select count(*) from public.get_user_profile('c1000002-0000-0000-0000-000000000002')), 1::bigint,
  'viewer can load a finished profile');
select is((select first_name from public.get_user_profile('c1000002-0000-0000-0000-000000000002')), 'Quinn',
  'profile returns the name');
select is((select jsonb_array_length(photos) from public.get_user_profile('c1000002-0000-0000-0000-000000000002')), 2,
  'profile returns every photo path');
select is((select count(*) from public.get_user_profile('c1000003-0000-0000-0000-000000000003')), 0::bigint,
  'unfinished profile returns no row');

select is((select count(*) from public.list_user_answers('c1000002-0000-0000-0000-000000000002', 10, 0)), 2::bigint,
  'others see only live answers');
select is((select total_count from public.list_user_answers('c1000002-0000-0000-0000-000000000002', 10, 0) limit 1), 2::bigint,
  'total_count reflects visible answers for others');

set local request.jwt.claim.sub = 'c1000002-0000-0000-0000-000000000002';
select is((select count(*) from public.list_user_answers(null, 10, 0)), 3::bigint,
  'owner sees disabled answers too');

set local request.jwt.claim.sub = 'c1000002-0000-0000-0000-000000000002';
select lives_ok($$select public.block_user('c1000001-0000-0000-0000-000000000001')$$, 'block hides profile');

set local request.jwt.claim.sub = 'c1000001-0000-0000-0000-000000000001';
select is((select count(*) from public.get_user_profile('c1000002-0000-0000-0000-000000000002')), 0::bigint,
  'blocked profile returns no row');

select is(
  (select count(*) from storage.objects
   where bucket_id = 'profile-photos' and name = 'c1000002-0000-0000-0000-000000000002/2.jpg'),
  0::bigint,
  'non-avatar photo is hidden in storage while blocked'
);

set local request.jwt.claim.sub = 'c1000002-0000-0000-0000-000000000002';
select lives_ok($$select public.unblock_user('c1000001-0000-0000-0000-000000000001')$$, 'unblock restores profile view');

set local request.jwt.claim.sub = 'c1000001-0000-0000-0000-000000000001';
select is(
  (select count(*) from storage.objects
   where bucket_id = 'profile-photos' and name = 'c1000002-0000-0000-0000-000000000002/2.jpg'),
  1::bigint,
  'non-avatar photo is visible through storage when the profile is viewable'
);

select lives_ok($$select public.record_profile_view('c1000002-0000-0000-0000-000000000002')$$,
  'record_profile_view still works in Phase C');

select * from finish();
rollback;
