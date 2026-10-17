begin;
select plan(8);

create function pg_temp.uid(n int) returns uuid language sql
as $$ select ('e' || lpad(n::text, 7, '0') || '-0000-0000-0000-000000000000')::uuid $$;
create function pg_temp.become(n int) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', pg_temp.uid(n), 'role', 'authenticated')::text, true)
$$;

insert into auth.users (id, email, aud, role, instance_id) values
  (pg_temp.uid(1), 'member@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  (pg_temp.uid(2), 'admin@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
insert into public.admin_users (user_id) values (pg_temp.uid(2));

set local role anon;

select lives_ok(
  $$select public.submit_website_launch_notify('launch@example.com')$$,
  'anon can submit a launch notify email'
);

select throws_ok(
  $$select public.submit_website_launch_notify('not-an-email')$$,
  '22023',
  'Invalid email address',
  'invalid email is rejected'
);

select lives_ok(
  $$select public.submit_website_launch_notify('launch@example.com')$$,
  'duplicate email does not error'
);

select is(
  (select count(*)::int from public.notification_outbox where kind = 'website_launch_signup' and user_id = pg_temp.uid(2)),
  1,
  'a new signup queues one admin alert per admin'
);

select is(
  (select body from public.notification_outbox where kind = 'website_launch_signup' and user_id = pg_temp.uid(2) limit 1),
  'Email address: launch@example.com' || E'\n\n' ||
    'They asked to be notified when the Cats or Dogs? app launches. '
    || 'Open Email list in the admin panel to see every signup.',
  'admin alert body includes the submitted email'
);

set local role service_role;

select results_eq(
  $$select count(*)::int from public.website_launch_signups where email = 'launch@example.com'$$,
  $$values (1)$$,
  'only one row stored for duplicate signup'
);

set local role authenticated;
select pg_temp.become(1);

select throws_ok(
  $$select * from public.admin_list_website_launch_signups()$$,
  '42501',
  null,
  'a non-admin cannot list website launch signups'
);

select pg_temp.become(2);

select is(
  (select email from public.admin_list_website_launch_signups() limit 1),
  'launch@example.com',
  'an admin can list website launch signups'
);

reset role;
select ok((select send_email from public.claim_notifications(20)
           where user_id = pg_temp.uid(2) and kind = 'website_launch_signup' limit 1),
  'website launch signup alerts are always sent by email');

select * from finish();
rollback;
