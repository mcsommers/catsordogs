-- Phase 2: the daily question calendar, admin-editable settings, and the
-- endpoints the app uses to ask "what is today's question?".
--
-- "Today" always means the current UTC day, the same for every user.

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------
-- Who counts as an admin. The app can never read or write this table; people
-- are added by hand (see README, "Making yourself an admin").
create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()))
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create function public.utc_today() returns date
language sql stable set search_path = ''
as $$ select (now() at time zone 'utc')::date $$;
revoke execute on function public.utc_today() from public, anon;
grant execute on function public.utc_today() to authenticated;

-- ---------------------------------------------------------------------------
-- questions: one per UTC day
-- ---------------------------------------------------------------------------
create table public.questions (
  id uuid primary key default gen_random_uuid(),
  question_date date not null unique,
  text text not null check (char_length(btrim(text)) between 1 and 200),
  is_override boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Every time an admin swaps a question's text, the old text is kept here
-- (admins only), so a current-events swap is always traceable.
create table public.question_overrides (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions (id) on delete cascade,
  previous_text text not null,
  new_text text not null,
  overridden_by uuid references auth.users (id) on delete set null,
  overridden_at timestamptz not null default now()
);

alter table public.questions enable row level security;
alter table public.question_overrides enable row level security;

-- Everyone signed in can read today's and earlier questions. Future questions
-- (the calendar) are visible to admins only. Only admins can write.
grant select on public.questions to authenticated;
grant insert (question_date, text) on public.questions to authenticated;
grant update (text) on public.questions to authenticated;
grant delete on public.questions to authenticated;
grant select on public.question_overrides to authenticated;

create policy "everyone reads today's and past questions" on public.questions
  for select to authenticated
  using (question_date <= public.utc_today() or public.is_admin());
create policy "admins add questions" on public.questions
  for insert to authenticated with check (public.is_admin());
create policy "admins edit questions" on public.questions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins delete questions" on public.questions
  for delete to authenticated using (public.is_admin());
create policy "admins read override history" on public.question_overrides
  for select to authenticated using (public.is_admin());

-- Calendar rules for anyone working through the API (admins in the admin panel):
--   * new questions must be for today or later;
--   * a past question can never be changed or removed;
--   * today's question can be swapped (an "override") but not removed;
--   * any text change is recorded as an override.
-- Work done directly on the database (migrations, seeding) is not restricted.
create function private.guard_question_changes() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null and new.question_date < public.utc_today() then
      raise exception 'Questions cannot be scheduled in the past.' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if auth.uid() is not null and old.question_date <= public.utc_today() then
      raise exception 'Today''s and past questions cannot be removed.' using errcode = 'check_violation';
    end if;
    return old;
  end if;

  -- UPDATE
  if auth.uid() is not null and old.question_date < public.utc_today() then
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

create trigger questions_guard
  before insert or update or delete on public.questions
  for each row execute function private.guard_question_changes();
create trigger questions_touch_updated_at
  before update on public.questions
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- app_settings: a single row of admin-editable values
-- ---------------------------------------------------------------------------
create table public.app_settings (
  id boolean primary key default true check (id),   -- only one row can exist
  recording_length_seconds int not null default 14 check (recording_length_seconds between 3 and 60),
  min_watch_seconds int not null default 3 check (min_watch_seconds >= 0),
  onboarding_mode text not null default 'todays_question'
    check (onboarding_mode in ('todays_question', 'fixed_question')),
  onboarding_fixed_question text not null default 'Cats or dogs?'
    check (char_length(btrim(onboarding_fixed_question)) between 1 and 200),
  followed_content_cap_percent int not null default 30 check (followed_content_cap_percent between 0 and 100),
  flag_threshold int not null default 5 check (flag_threshold >= 1),
  profile_report_priority_count int not null default 3 check (profile_report_priority_count >= 1),
  feed_lookback_days int not null default 7 check (feed_lookback_days between 0 and 90),
  help_support_url text check (help_support_url is null or help_support_url ~* '^https://\S+$'),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  constraint min_watch_within_recording check (min_watch_seconds <= recording_length_seconds)
);

insert into public.app_settings default values;

alter table public.app_settings enable row level security;

-- The table is for admins only. The app gets the few values it needs from
-- get_app_config() below.
grant select on public.app_settings to authenticated;
grant update (
  recording_length_seconds, min_watch_seconds, onboarding_mode, onboarding_fixed_question,
  followed_content_cap_percent, flag_threshold, profile_report_priority_count,
  feed_lookback_days, help_support_url
) on public.app_settings to authenticated;

create policy "admins read settings" on public.app_settings
  for select to authenticated using (public.is_admin());
create policy "admins edit settings" on public.app_settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create function private.stamp_settings_update() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger app_settings_stamp
  before update on public.app_settings
  for each row execute function private.stamp_settings_update();

-- ---------------------------------------------------------------------------
-- What the app is allowed to ask
-- ---------------------------------------------------------------------------
-- The settings the phone needs to behave correctly. Everything else
-- (flag threshold, feed cap, look-back days, ...) is used by the server only.
create function public.get_app_config()
returns table (recording_length_seconds int, min_watch_seconds int, help_support_url text)
language sql stable security definer set search_path = ''
as $$
  select s.recording_length_seconds, s.min_watch_seconds, s.help_support_url
  from public.app_settings s
$$;
revoke execute on function public.get_app_config() from public, anon;
grant execute on function public.get_app_config() to authenticated;

-- Today's question (UTC day). Returns no rows if nothing is scheduled.
create function public.get_todays_question()
returns table (question_id uuid, question_date date, text text, is_override boolean)
language sql stable security definer set search_path = ''
as $$
  select q.id, q.question_date, q.text, q.is_override
  from public.questions q
  where q.question_date = public.utc_today()
$$;
revoke execute on function public.get_todays_question() from public, anon;
grant execute on function public.get_todays_question() to authenticated;

-- The question shown for a new user's first recording (after "How it works").
-- In the default mode it is today's question. If an admin switched the
-- onboarding mode to "fixed question", prompt_text is that fixed question
-- instead. Either way, question_id is today's question, because the first
-- recording is what unlocks today's feed. Returns no rows if no question is
-- scheduled for today.
create function public.get_onboarding_question()
returns table (question_id uuid, question_date date, prompt_text text, prompt_source text)
language sql stable security definer set search_path = ''
as $$
  select q.id,
         q.question_date,
         case when s.onboarding_mode = 'fixed_question' then s.onboarding_fixed_question else q.text end,
         case when s.onboarding_mode = 'fixed_question' then 'fixed' else 'today' end
  from public.questions q
  cross join public.app_settings s
  where q.question_date = public.utc_today()
$$;
revoke execute on function public.get_onboarding_question() from public, anon;
grant execute on function public.get_onboarding_question() to authenticated;
