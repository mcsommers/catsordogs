-- Phase 4 rules: followed people come first in the feed, up to the admin-set
-- share, even outside the viewer's filters. (Everything else about the feed is
-- in 04_gate_and_feed.test.sql.)
begin;
select plan(15);

delete from public.answers;
delete from public.videos;
delete from public.questions;
insert into public.questions (question_date, text) values
  (public.utc_today(), 'Today''s question'),
  (public.utc_today() - 1, 'Yesterday''s question');

create function pg_temp.uid(n int) returns uuid language sql
as $$ select ('c' || lpad(n::text, 7, '0') || '-0000-0000-0000-000000000000')::uuid $$;

create function pg_temp.claims(n int) returns text language sql
as $$ select json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text $$;

create function pg_temp.person(n int, label text, p_gender text) returns void language plpgsql as $$
declare
  vid uuid := gen_random_uuid();
begin
  insert into auth.users (id, email, aud, role, instance_id)
  values (pg_temp.uid(n), label || '@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  update public.profiles set first_name = label, gender = p_gender, birthday = '1995-05-05', profile_completed_at = now()
  where id = pg_temp.uid(n);
  insert into public.videos (id, user_id, question_id, status, mux_playback_id, duration_seconds, captions_status,
                             auto_caption_segments, caption_segments, submitted_at)
  values (vid, pg_temp.uid(n), (select id from public.questions where question_date = public.utc_today()), 'ready',
          'pb-' || vid, 10, 'ready', '[]', '[]', now());
  insert into public.answers (user_id, question_id, video_id, duration_seconds)
  values (pg_temp.uid(n), (select id from public.questions where question_date = public.utc_today()), vid, 10);
end $$;

-- V is the viewer. F1..F5 are men V follows. G1..G5 are women V does not follow.
select pg_temp.person(1, 'V', 'Woman');
select pg_temp.person(10 + n, 'F' || n, 'Man') from generate_series(1, 5) n;
select pg_temp.person(20 + n, 'G' || n, 'Woman') from generate_series(1, 5) n;
insert into public.follows (follower_id, followed_id) select pg_temp.uid(1), pg_temp.uid(10 + n) from generate_series(1, 5) n;
-- someone V does not follow, but who follows V (must have no effect)
insert into public.follows (follower_id, followed_id) values (pg_temp.uid(21), pg_temp.uid(1));
update public.filter_preferences set filters = '{"show_me":"Women"}' where user_id = pg_temp.uid(1);

select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;

-- 10 people are visible (5 followed + 5 matching), so the default 30% cap allows 3 followed
select is((select array_agg(is_followed) from public.get_feed(50, 0, public.utc_today())),
  array[true, true, true, false, false, false, false, false],
  'followed people come first, capped at 30% of the day''s visible feed; the rest of the followed people fail the filter and are dropped');
select is((select array_agg(first_name order by first_name) from public.get_feed(3, 0, public.utc_today()) where is_followed),
  (select array_agg(first_name order by first_name) from public.get_feed(3, 0, public.utc_today())),
  'the first three rows are the followed people');
select ok(not exists (select 1 from public.get_feed(50, 0, public.utc_today()) where first_name = 'V'), 'the viewer is not in their own feed');
select is((select count(*) from public.get_feed(50, 0, public.utc_today()) where first_name like 'G%'), 5::bigint,
  'people who pass the filters still all appear');

-- the cap is an admin setting, read from app_settings
reset role;
update public.app_settings set followed_content_cap_percent = 100;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select is((select array_agg(is_followed) from public.get_feed(50, 0, public.utc_today())),
  array[true, true, true, true, true, false, false, false, false, false],
  'cap 100%: every followed person comes first, even though they fall outside the filters');

reset role;
update public.app_settings set followed_content_cap_percent = 10;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select is((select count(*) from public.get_feed(50, 0, public.utc_today()) where is_followed), 1::bigint, 'cap 10%: only one followed person is on top');

reset role;
update public.app_settings set followed_content_cap_percent = 0;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select is((select count(*) from public.get_feed(50, 0, public.utc_today())), 5::bigint,
  'cap 0%: no followed person gets a top slot, and those outside the filters do not appear');

-- with no filters, followed people beyond the cap still appear, ranked with everyone else
reset role;
update public.filter_preferences set filters = '{}' where user_id = pg_temp.uid(1);
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select is((select count(*) from public.get_feed(50, 0, public.utc_today())), 10::bigint,
  'cap 0% with no filters: followed people beyond the cap are ranked like anyone else');
select is((select count(*) from public.get_feed(50, 0, public.utc_today()) where is_followed), 5::bigint, 'they are still marked as followed');

reset role;
update public.app_settings set followed_content_cap_percent = 30;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select is((select array_agg(is_followed) from (select is_followed from public.get_feed(50, 0, public.utc_today()) limit 3) x),
  array[true, true, true], 'cap 30%, no filters: three followed on top');

-- followed content is per day: yesterday has its own cap
reset role;
select pg_temp.person(40, 'Y1', 'Man');
update public.answers set question_id = (select id from public.questions where question_date = public.utc_today() - 1)
  where user_id = pg_temp.uid(40);
update public.videos set question_id = (select id from public.questions where question_date = public.utc_today() - 1)
  where user_id = pg_temp.uid(40);
insert into public.follows (follower_id, followed_id) values (pg_temp.uid(1), pg_temp.uid(40));
select set_config('request.jwt.claims', pg_temp.claims(1), true);
set local role authenticated;
select is((select first_name from public.get_feed(50) offset 10 limit 1), 'Y1', 'earlier days follow after today''s whole list');
select is((select is_followed from public.get_feed(50, 0, public.utc_today() - 1)), true, 'a followed person''s earlier answer is marked as followed');

-- being followed changes nothing for the followed person, and nobody can read follows
select is((select count(*) from public.get_feed(50, 0, public.utc_today())), 10::bigint, 'the viewer''s feed is unaffected by who follows the viewer');
select throws_ok($$select * from public.follows$$, '42501', null, 'the viewer cannot read who they follow, or who follows them');

reset role;
select set_config('request.jwt.claims', pg_temp.claims(21), true);
set local role authenticated;
select throws_ok($$select count(*) from public.follows$$, '42501', null, 'a follower cannot read the follows table either');

select * from finish();
rollback;
