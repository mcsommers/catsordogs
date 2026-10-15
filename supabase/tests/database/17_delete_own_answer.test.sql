-- Deleting your own answer (06ka / 06kb / 06kc).
begin;
select plan(16);

delete from public.answers;
delete from public.videos;
delete from public.questions;
insert into public.questions (question_date, text)
select public.utc_today() - n, 'Question ' || n from generate_series(0, 3) n;

create function pg_temp.uid(n int) returns uuid language sql
as $$ select ('e' || lpad(n::text, 7, '0') || '-0000-0000-0000-000000000000')::uuid $$;

create function pg_temp.claims(n int) returns text language sql
as $$ select json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text $$;

create function pg_temp.person(n int, label text) returns void language plpgsql as $$
begin
  insert into auth.users (id, email, aud, role, instance_id)
  values (pg_temp.uid(n), label || '@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  update public.profiles set first_name = label, gender = 'Woman', birthday = '1995-05-05',
         profile_completed_at = now() where id = pg_temp.uid(n);
end $$;

create function pg_temp.answers_on(n int, days int[]) returns void language plpgsql as $$
declare
  d int; vid uuid; qid uuid;
begin
  foreach d in array days loop
    vid := gen_random_uuid();
    qid := (select id from public.questions where question_date = public.utc_today() - d);
    insert into public.videos (id, user_id, question_id, status, mux_asset_id, mux_playback_id, duration_seconds,
                               captions_status, auto_caption_segments, caption_segments, submitted_at)
    values (vid, pg_temp.uid(n), qid, 'ready', 'asset-' || vid, 'pb-' || vid, 10, 'ready', '[]', '[]', now());
    insert into public.answers (user_id, question_id, video_id, duration_seconds)
    values (pg_temp.uid(n), qid, vid, 10);
  end loop;
end $$;

-- 1 Owner (answered today, yesterday, two days ago)   2 Other person (answered today)
select pg_temp.person(1, 'Owner'); select pg_temp.answers_on(1, array[0, 1, 2]);
select pg_temp.person(2, 'Other'); select pg_temp.answers_on(2, array[0]);

create temp table ids (name text primary key, id uuid not null);
grant select on ids to public;
insert into ids select 'today', a.id from public.answers a join public.questions q on q.id = a.question_id
  where a.user_id = pg_temp.uid(1) and q.question_date = public.utc_today();
insert into ids select 'yesterday', a.id from public.answers a join public.questions q on q.id = a.question_id
  where a.user_id = pg_temp.uid(1) and q.question_date = public.utc_today() - 1;
insert into ids select 'other', id from public.answers where user_id = pg_temp.uid(2);

-- a flag review that is still open on yesterday's answer
insert into public.moderation_actions (kind, answer_id, snapshot)
select 'answer', id, '{}'::jsonb from ids where name = 'yesterday';

-- Signed out and other people are refused
set local role anon;
select throws_ok($$select public.delete_my_answer((select id from ids where name = 'today'))$$, '42501', null,
  'signed-out visitors cannot delete an answer');

reset role;
set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims(2), true);
select throws_ok($$select public.delete_my_answer((select id from ids where name = 'today'))$$, 'P0002', 'Answer not found.',
  'you cannot delete someone else''s answer');
select is((select count(*)::int from public.answers where user_id = pg_temp.uid(1)), 0,
  'the other person cannot even see the owner''s answers (and nothing was deleted)') ;

reset role;
select is((select count(*)::int from public.answers where user_id = pg_temp.uid(1)), 3, 'all three answers still exist after the refused attempt');

set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
select throws_ok($$select public.delete_my_answer(gen_random_uuid())$$, 'P0002', 'Answer not found.',
  'an answer that does not exist is refused');

-- Deleting a past answer
reset role;
select is(private.streak_days(pg_temp.uid(1)), 3, 'before deleting: streak is 3');
set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
select is(public.delete_my_answer((select id from ids where name = 'yesterday')) like 'asset-%', true,
  'deleting returns the Mux asset id so the server function can remove the file');
select is((select count(*)::int from public.answers where user_id = pg_temp.uid(1)), 2, 'the past answer is gone');
reset role;
select is(private.streak_days(pg_temp.uid(1)), 1, 'the streak has a gap, so it drops to 1');
select is(private.gate_state(pg_temp.uid(1)), 'open', 'deleting a past answer leaves today''s gate open');

-- Deleting today's answer closes the gate again
set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
select public.delete_my_answer((select id from ids where name = 'today'));
reset role;
select is(private.gate_state(pg_temp.uid(1)), 'not_answered', 'deleting today''s answer closes the daily gate');

reset role;
select is((select status || '/' || coalesce(mux_asset_id, 'none') || '/' || (submitted_at is null)::text
           from public.videos where user_id = pg_temp.uid(1) and question_id = (select id from public.questions where question_date = public.utc_today())),
  'cancelled/none/true', 'the recording is kept but emptied and cancelled (it still counts toward the daily limit)');
select is((select count(*)::int from public.videos where user_id = pg_temp.uid(1)
           and question_id = (select id from public.questions where question_date = public.utc_today())), 1,
  'the daily recording count is not given back');
select is((select status from public.moderation_actions where kind = 'answer' and (snapshot ->> 'deleted_by_owner') = 'true'), 'reviewed',
  'an open flag review on a deleted answer is closed');
select is((select count(*)::int from public.answers where id = (select id from ids where name = 'other')), 1,
  'nobody else''s answer was touched');

-- The same recording cannot be submitted again
set local role authenticated;
select set_config('request.jwt.claims', pg_temp.claims(1), true);
select throws_ok(
  $$select public.submit_answer((select id from public.videos where user_id = pg_temp.uid(1)
      and question_id = (select id from public.questions where question_date = public.utc_today())))$$,
  null, null, 'a deleted recording can never be submitted again');

select * from finish();
rollback;
