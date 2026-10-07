-- Phase 5 follow-up: the "today's question is live" notification is sent at a
-- set time of day in each person's own time zone (default 9:00 AM), and an
-- admin can change that time. The question itself stays global (one question
-- per UTC day); only the notification is per time zone.

-- ---------------------------------------------------------------------------
-- The admin setting
-- ---------------------------------------------------------------------------
alter table public.app_settings
  add column daily_question_notify_time time not null default '09:00'
  check (extract(second from daily_question_notify_time) = 0);

grant update (daily_question_notify_time) on public.app_settings to authenticated;

-- ---------------------------------------------------------------------------
-- Each person's time zone
-- ---------------------------------------------------------------------------
-- The phone reports it (an IANA name such as "America/New_York") each time the
-- app opens, so it follows the person when they travel. Nobody can write the
-- column directly: the server checks the name first, because an unknown name
-- would break the scheduled job for everyone. No time zone yet means UTC.
alter table public.profiles add column time_zone text;

create function public.set_time_zone(p_time_zone text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if p_time_zone is null or not exists (
    select 1 from pg_catalog.pg_timezone_names n where n.name = p_time_zone
  ) then
    raise exception 'That is not a known time zone.' using errcode = 'check_violation';
  end if;
  update public.profiles set time_zone = p_time_zone where id = me and time_zone is distinct from p_time_zone;
end;
$$;
revoke execute on function public.set_time_zone(text) from public, anon;
grant execute on function public.set_time_zone(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Queueing the notification
-- ---------------------------------------------------------------------------
-- A scheduled job runs this every 5 minutes. It queues "today's question is
-- live" for each person (with a finished profile) whose local date is the
-- question's date and whose local time has reached the admin-set time. Each
-- person is queued once per question (the queue's dedupe key), so running it
-- often is safe, and a missed run is made up on the next one. Where 9:00 AM
-- local falls before the question goes live (Australia, for example), the
-- notification goes out when the question goes live.
-- p_now exists so tests can pick the moment; the default is the real time.
drop function public.enqueue_daily_question_notifications();

create function public.enqueue_daily_question_notifications(p_now timestamptz default now())
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  q public.questions;
  notify_at time;
  added int;
begin
  select * into q from public.questions where question_date = (p_now at time zone 'utc')::date;
  if not found then
    return 0;
  end if;
  select s.daily_question_notify_time into notify_at from public.app_settings s;
  insert into public.notification_outbox (user_id, type, kind, title, body, data, dedupe_key)
  select p.id, 'daily_question', 'daily_question', 'Today''s question is live', q.text,
         jsonb_build_object('question_id', q.id), 'daily:' || q.id
  from public.profiles p
  where p.profile_completed_at is not null
    and (p_now at time zone coalesce(p.time_zone, 'UTC'))::date = q.question_date
    and (p_now at time zone coalesce(p.time_zone, 'UTC'))::time >= notify_at
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics added = row_count;
  return added;
end;
$$;
revoke execute on function public.enqueue_daily_question_notifications(timestamptz) from public, anon, authenticated;
grant execute on function public.enqueue_daily_question_notifications(timestamptz) to service_role;

select cron.schedule('daily-question-notifications', '*/5 * * * *', 'select public.enqueue_daily_question_notifications()');
