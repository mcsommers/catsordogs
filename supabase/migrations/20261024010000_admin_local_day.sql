-- The admin question calendar follows the local calendar day of the admin who
-- is signed in, not UTC. The admin website reports its browser's time zone
-- (admin_set_time_zone); it is kept on that admin's row in admin_users, so it
-- never changes the time zone the phone reports for their own profile.
-- "Today" for the calendar rules below (no scheduling in the past, no changing
-- a past question, no removing today's or a past question, answer counts) is
-- that admin's local today. An admin with no time zone yet is treated as UTC.

alter table public.admin_users add column time_zone text;

create function private.admin_local_today() returns date
language sql stable security definer set search_path = ''
as $$
  select (now() at time zone coalesce(
    (select a.time_zone from public.admin_users a where a.user_id = auth.uid()), 'UTC'))::date
$$;

create function public.admin_set_time_zone(p_time_zone text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_time_zone is null or not exists (select 1 from pg_timezone_names where name = p_time_zone) then
    raise exception 'Unknown time zone.' using errcode = 'invalid_parameter_value';
  end if;
  update public.admin_users set time_zone = p_time_zone where user_id = auth.uid();
end;
$$;
revoke all on function public.admin_set_time_zone(text) from public, anon;
grant execute on function public.admin_set_time_zone(text) to authenticated;

create or replace function private.guard_question_changes() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  today date := private.admin_local_today();
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.question_date < today then
      raise exception 'Questions cannot be scheduled in the past.' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if auth.uid() is not null and old.question_date <= today then
      raise exception 'Today''s and past questions cannot be removed.' using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- UPDATE
  if auth.uid() is not null and old.question_date < today then
    raise exception 'Past questions cannot be changed.' using errcode = 'check_violation';
  end if;
  if new.text is distinct from old.text then
    new.is_override := true;
    insert into public.question_overrides (question_id, previous_text, new_text, overridden_by)
      values (old.id, old.text, new.text, auth.uid());
  end if;
  return new;
end;
$$;

create or replace function public.admin_question_answer_counts()
returns table (question_id uuid, answer_count bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select q.id, count(a.id)
    from public.questions q
    left join public.answers a
      on a.question_id = q.id and a.status in ('live', 'disabled')
    where q.question_date <= private.admin_local_today()
    group by q.id;
end;
$$;
