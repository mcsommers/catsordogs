-- The admin question calendar follows the signed-in admin's own local day.
-- Pacific/Kiritimati (UTC+14) is always ahead of Pacific/Pago_Pago (UTC-11),
-- so one date is "today" for one admin and already "past" for the other.
begin;
select plan(13);

delete from public.videos;
delete from public.questions;

insert into auth.users (id, email, aud, role, instance_id) values
  ('a0000000-0000-0000-0000-00000000000a', 'admin@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('b0000000-0000-0000-0000-00000000000b', 'user@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into public.admin_users (user_id) values ('a0000000-0000-0000-0000-00000000000a');

create temp table days as
select (now() at time zone 'Pacific/Pago_Pago')::date as behind,
       (now() at time zone 'Pacific/Kiritimati')::date as ahead;
grant select on days to public;

insert into public.questions (question_date, text)
values ((select behind from days), 'Behind day'), ((select ahead from days), 'Ahead day');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select throws_ok($$select public.admin_set_time_zone('Pacific/Kiritimati')$$, '42501', null,
  'a normal user cannot set an admin time zone');

select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select throws_ok($$select public.admin_set_time_zone('Not/AZone')$$, '22023', 'Unknown time zone.',
  'an unknown time zone is refused');

-- Admin far behind UTC: the "behind" date is still today for them.
select lives_ok($$select public.admin_set_time_zone('Pacific/Pago_Pago')$$, 'an admin can set their time zone');
select lives_ok($$update public.questions set text = 'Behind day, swapped' where question_date = (select behind from days)$$,
  'a day that is still today for this admin can be swapped');
select throws_ok($$delete from public.questions where question_date = (select behind from days)$$, '23514',
  'Today''s and past questions cannot be removed.', 'their today cannot be removed');
select is((select count(*) from public.admin_question_answer_counts()
            where question_id = (select id from public.questions where question_date = (select ahead from days))),
  0::bigint, 'a day after their today has no answer count');

-- Admin far ahead of UTC: the "behind" date is already past for them.
select public.admin_set_time_zone('Pacific/Kiritimati');
select throws_ok($$update public.questions set text = 'Too late' where question_date = (select behind from days)$$,
  '23514', 'Past questions cannot be changed.', 'a day already past for this admin is locked');
select throws_ok($$insert into public.questions (question_date, text) values ((select behind from days) - 5, 'Old')$$,
  '23514', 'Questions cannot be scheduled in the past.', 'they cannot schedule a day that is past for them');
select lives_ok($$update public.questions set text = 'Ahead day, swapped' where question_date = (select ahead from days)$$,
  'their today can be swapped');
select is((select count(*) from public.admin_question_answer_counts()
            where question_id = (select id from public.questions where question_date = (select ahead from days))),
  1::bigint, 'their today has an answer count');

reset role;
select is((select time_zone from public.admin_users), 'Pacific/Kiritimati'::text, 'the time zone is saved on the admin row');
select is((select time_zone from public.profiles where id = 'a0000000-0000-0000-0000-00000000000a'), null::text,
  'it does not change the time zone on their phone profile');
select set_config('request.jwt.claims', '', true);
select is(private.admin_local_today(), public.utc_today(),
  'with no signed-in admin, today falls back to UTC');

select * from finish();
rollback;
