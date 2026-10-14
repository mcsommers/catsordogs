-- How long to hold the once-a-day nudge notification so later nudges can be
-- counted in the same notice. 0 means it is due immediately, and the worker
-- is woken right then. Admins edit it. The phone never reads it.

alter table public.app_settings
  add column nudge_delay_minutes int not null default 15
    check (nudge_delay_minutes between 0 and 60);

grant update (nudge_delay_minutes) on public.app_settings to authenticated;

create or replace function public.nudge_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_other_person(p_user_id);
  q uuid;
  added int;
  delay int;
  queued boolean;
  their_today date;
begin
  their_today := public.user_local_today(p_user_id);
  select id into q from public.questions where question_date = their_today;
  if q is null then
    raise exception 'There is no question today.' using errcode = 'no_data_found';
  end if;
  if private.is_blocked_between(me, p_user_id) then
    raise exception 'Person not found.' using errcode = 'no_data_found';
  end if;
  if not exists (select 1 from public.follows f where f.follower_id = me and f.followed_id = p_user_id) then
    raise exception 'You can only nudge people you follow.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.allow_followers) then
    raise exception 'This person is not accepting followers.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.answers a where a.user_id = p_user_id and a.question_id = q) then
    raise exception 'They have already answered today.' using errcode = 'check_violation';
  end if;

  insert into public.nudges (sender_id, target_id, question_id) values (me, p_user_id, q)
    on conflict do nothing;
  get diagnostics added = row_count;
  if added = 0 then
    raise exception 'You have already nudged this person today.' using errcode = 'check_violation';
  end if;

  select s.nudge_delay_minutes into delay from public.app_settings s;
  queued := private.enqueue_notification(p_user_id, 'nudges', 'nudge', null, null,
    jsonb_build_object('question_id', q), now() + make_interval(mins => delay), 'nudge:' || q);
  -- 0 is due now. Wake the worker so it does not wait for the next minute.
  -- Later nudges that day do not create another notice; the count is whatever
  -- has arrived by the time this one is claimed.
  if delay = 0 and queued then
    perform private.kick_notification_worker();
  end if;
end;
$$;
