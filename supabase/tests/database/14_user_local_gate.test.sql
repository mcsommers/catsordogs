-- Local calendar day for the daily gate (profiles.time_zone).
begin;
select plan(3);

select is(
  public.user_local_today('00000000-0000-0000-0000-000000000099'::uuid, timestamptz '2026-10-12 03:30:00+00'),
  '2026-10-12'::date,
  'no profile time zone falls back to UTC'
);

select is(
  (timestamptz '2026-10-12 03:30:00+00' at time zone 'America/New_York')::date,
  '2026-10-11'::date,
  'example: UTC Oct 12 early morning is still Oct 11 in New York'
);

select is(
  (timestamptz '2026-10-12 12:00:00+00' at time zone 'America/New_York')::date,
  '2026-10-12'::date,
  'example: later UTC time is Oct 12 in New York'
);

select * from finish();
rollback;
