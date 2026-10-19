begin;
select plan(9);

set local role anon;

select lives_ok(
  $$select public.submit_website_support_inquiry(
    'help@example.com',
    'I have a question about how matching works on the app.'
  )$$,
  'anon can submit a support inquiry'
);

select throws_ok(
  $$select public.submit_website_support_inquiry('not-an-email', 'This is a valid length message.')$$,
  '22023',
  'Invalid email address',
  'invalid email is rejected'
);

select throws_ok(
  $$select public.submit_website_support_inquiry('help@example.com', 'short')$$,
  '22023',
  'Message is too short',
  'short message is rejected'
);

select lives_ok(
  $$select public.submit_website_support_inquiry(
    'help@example.com',
    'I have a question about how matching works on the app.',
    'https://spam.example'
  )$$,
  'honeypot submission returns without error'
);

set local role service_role;

select is(
  (select count(*)::int from public.website_support_inquiries where email = 'help@example.com'),
  1,
  'honeypot does not insert a row'
);

select lives_ok(
  $$select public.submit_website_support_inquiry(
    'help@example.com',
    'Second message with enough characters for validation.'
  )$$,
  'second inquiry from same email within hour is allowed'
);

select lives_ok(
  $$select public.submit_website_support_inquiry(
    'help@example.com',
    'Third message with enough characters for validation.'
  )$$,
  'third inquiry from same email within hour is allowed'
);

select throws_ok(
  $$select public.submit_website_support_inquiry(
    'help@example.com',
    'Fourth message with enough characters for validation.'
  )$$,
  '22023',
  'Too many requests. Try again later.',
  'fourth inquiry from same email within hour is rejected'
);

select throws_ok(
  $$select * from public.website_support_inquiries$$,
  '42501',
  null,
  'anon cannot read support inquiries directly'
);

select * from finish();
rollback;
