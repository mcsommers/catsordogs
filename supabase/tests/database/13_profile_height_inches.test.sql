-- Height is stored in total inches; filters use height_inches.
begin;
select plan(3);

create function pg_temp.uid() returns uuid language sql
as $$ select 'aaaaaaaa-0000-0000-0000-000000000001'::uuid $$;

insert into auth.users (id, email, aud, role, instance_id)
values (pg_temp.uid(), 'h@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(), 'role', 'authenticated')::text, true);

select lives_ok(
  $$update public.profiles set height_inches = 69 where id = pg_temp.uid()$$,
  '69 inches (5 ft 9 in) is allowed'
);
select is((select height_inches from public.profiles where id = pg_temp.uid()), 69::smallint, 'height is stored in inches');

select throws_ok(
  $$update public.profiles set height_inches = 34 where id = pg_temp.uid()$$,
  '23514',
  null,
  'under 35 inches is rejected'
);

select * from finish();
rollback;
