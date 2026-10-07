-- Phase 5: follow, nudge, and notifications (push and email).
--
-- Follower anonymity: the follows and nudges tables have no app access at all.
-- Everything goes through the functions below, and nothing they return ever
-- identifies a follower. The app can learn: how many followers I have, whether
-- I follow a given person, and whether I may nudge them.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ---------------------------------------------------------------------------
-- Notification types and defaults
-- ---------------------------------------------------------------------------
-- The four types a user can switch on or off, separately for push and email.
-- Defaults: push on for all; email on only for matches.
create function private.notification_types() returns text[]
language sql immutable
as $$ select array['daily_question', 'matches', 'messages', 'nudges'] $$;

create function private.notification_default(p_type text, p_channel text) returns boolean
language sql immutable
as $$ select case p_channel when 'push' then true when 'email' then p_type = 'matches' else false end $$;

-- ---------------------------------------------------------------------------
-- nudges (no app access) and the follow / nudge functions
-- ---------------------------------------------------------------------------
create table public.nudges (
  sender_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- one nudge per follower, per followed profile, per day
  primary key (sender_id, target_id, question_id),
  check (sender_id <> target_id)
);
create index nudges_target_question_idx on public.nudges (target_id, question_id);
alter table public.nudges enable row level security;
revoke all on public.nudges from anon, authenticated;

create function public.follow_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_other_person(p_user_id);
begin
  -- A blocked person (either direction) looks exactly like a missing one.
  if private.is_blocked_between(me, p_user_id)
     or not exists (select 1 from public.profiles p where p.id = p_user_id and p.profile_completed_at is not null) then
    raise exception 'Person not found.' using errcode = 'no_data_found';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.allow_followers) then
    raise exception 'This person is not accepting followers.' using errcode = 'check_violation';
  end if;
  insert into public.follows (follower_id, followed_id) values (me, p_user_id) on conflict do nothing;
end;
$$;

-- Silent: the other person is never told.
create function public.unfollow_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_other_person(p_user_id);
begin
  delete from public.follows where follower_id = me and followed_id = p_user_id;
end;
$$;

-- The only follower information the app ever gets: a number.
create function public.get_follower_count() returns bigint
language sql stable security definer set search_path = ''
as $$
  select case when (select auth.uid()) is null then null
    else (select count(*) from public.follows where followed_id = (select auth.uid())) end
$$;

-- For the Follow / Unfollow menu item and the Nudge card on someone's profile.
-- Says only things about the caller's own relationship to that person.
create function public.get_follow_state(p_user_id uuid)
returns table (following boolean, can_nudge boolean, already_nudged boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  q uuid;
  follows_them boolean;
  nudged boolean;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  select id into q from public.questions where question_date = public.utc_today();
  follows_them := exists (select 1 from public.follows f where f.follower_id = me and f.followed_id = p_user_id)
                  and not private.is_blocked_between(me, p_user_id);
  nudged := q is not null and exists (
    select 1 from public.nudges n where n.sender_id = me and n.target_id = p_user_id and n.question_id = q);
  return query select
    follows_them,
    follows_them and q is not null and not nudged
      and exists (select 1 from public.profiles p where p.id = p_user_id and p.allow_followers)
      and not exists (select 1 from public.answers a where a.user_id = p_user_id and a.question_id = q),
    nudged;
end;
$$;

-- A follower nudges a followed person who has not answered today. The person
-- gets at most one notification a day however many followers nudge, and it
-- never says who.
create function public.nudge_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_other_person(p_user_id);
  q uuid;
  added int;
begin
  select id into q from public.questions where question_date = public.utc_today();
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

  -- One notification per recipient per day: the dedupe key makes every nudge
  -- after the first a no-op. It waits a few minutes so the text can say how
  -- many followers want to hear the answer.
  perform private.enqueue_notification(p_user_id, 'nudges', 'nudge', null, null,
    jsonb_build_object('question_id', q), now() + interval '15 minutes', 'nudge:' || q);
end;
$$;

-- Not Interested also silently unfollows (Phase 4 left this for here).
create or replace function public.mark_not_interested(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_other_person(p_user_id);
begin
  insert into public.not_interested (user_id, target_id) values (me, p_user_id)
    on conflict do nothing;
  delete from public.follows where follower_id = me and followed_id = p_user_id;
end;
$$;

-- A block also ends any follow, in both directions (silently). Unblocking
-- does not bring a follow back.
create or replace function public.block_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_other_person(p_user_id);
begin
  insert into public.blocks (blocker_id, blocked_id) values (me, p_user_id)
    on conflict do nothing;
  delete from public.follows
    where (follower_id = me and followed_id = p_user_id) or (follower_id = p_user_id and followed_id = me);
end;
$$;

revoke execute on function
  public.follow_user(uuid), public.unfollow_user(uuid), public.get_follower_count(),
  public.get_follow_state(uuid), public.nudge_user(uuid)
from public, anon;
grant execute on function
  public.follow_user(uuid), public.unfollow_user(uuid), public.get_follower_count(),
  public.get_follow_state(uuid), public.nudge_user(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Notification preferences
-- ---------------------------------------------------------------------------
create table public.notification_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('daily_question', 'matches', 'messages', 'nudges')),
  push_enabled boolean not null,
  email_enabled boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, type)
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from anon, authenticated;
grant select on public.notification_preferences to authenticated;
create policy "users read their own notification preferences" on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));

-- All four types with the defaults filled in for anything not yet changed.
create function public.get_notification_preferences()
returns table (type text, push_enabled boolean, email_enabled boolean)
language sql stable security definer set search_path = ''
as $$
  select t.type,
         coalesce(np.push_enabled, private.notification_default(t.type, 'push')),
         coalesce(np.email_enabled, private.notification_default(t.type, 'email'))
  from unnest(private.notification_types()) with ordinality as t(type, ord)
  left join public.notification_preferences np on np.user_id = (select auth.uid()) and np.type = t.type
  where (select auth.uid()) is not null
  order by t.ord
$$;

create function public.set_notification_preference(p_type text, p_channel text, p_enabled boolean) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if p_type <> all (private.notification_types()) then
    raise exception 'Unknown notification type.' using errcode = 'check_violation';
  end if;
  if p_channel not in ('push', 'email') or p_enabled is null then
    raise exception 'Choose push or email, and on or off.' using errcode = 'check_violation';
  end if;
  insert into public.notification_preferences (user_id, type, push_enabled, email_enabled)
  values (me, p_type,
          case when p_channel = 'push' then p_enabled else private.notification_default(p_type, 'push') end,
          case when p_channel = 'email' then p_enabled else private.notification_default(p_type, 'email') end)
  on conflict (user_id, type) do update set
    push_enabled = case when p_channel = 'push' then p_enabled else public.notification_preferences.push_enabled end,
    email_enabled = case when p_channel = 'email' then p_enabled else public.notification_preferences.email_enabled end,
    updated_at = now();
end;
$$;

-- Email unsubscribe link (server only). p_type is one type, or 'all'.
create function public.unsubscribe_email(p_user_id uuid, p_type text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  t text;
begin
  if p_type <> 'all' and p_type <> all (private.notification_types()) then
    raise exception 'Unknown notification type.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    return;
  end if;
  foreach t in array private.notification_types() loop
    continue when p_type <> 'all' and p_type <> t;
    insert into public.notification_preferences (user_id, type, push_enabled, email_enabled)
    values (p_user_id, t, private.notification_default(t, 'push'), false)
    on conflict (user_id, type) do update set email_enabled = false, updated_at = now();
  end loop;
end;
$$;

revoke execute on function
  public.get_notification_preferences(), public.set_notification_preference(text, text, boolean)
from public, anon;
grant execute on function
  public.get_notification_preferences(), public.set_notification_preference(text, text, boolean)
to authenticated;
revoke execute on function public.unsubscribe_email(uuid, text) from public, anon, authenticated;
grant execute on function public.unsubscribe_email(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Phone push tokens
-- ---------------------------------------------------------------------------
create table public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index device_tokens_user_idx on public.device_tokens (user_id);
alter table public.device_tokens enable row level security;
revoke all on public.device_tokens from anon, authenticated;
grant select on public.device_tokens to authenticated;
create policy "users read their own device tokens" on public.device_tokens
  for select to authenticated using (user_id = (select auth.uid()));

-- Expo push tokens look like ExponentPushToken[xxxx]. A token that moves to a
-- new signed-in user (shared phone) follows the newest sign-in.
create function public.register_device_token(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{1,100}\]$' then
    raise exception 'That is not a valid push token.' using errcode = 'check_violation';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'Platform must be ios or android.' using errcode = 'check_violation';
  end if;
  insert into public.device_tokens (user_id, token, platform) values (me, p_token, p_platform)
  on conflict (token) do update set user_id = me, platform = p_platform, updated_at = now();
  -- keep the newest 10 per person
  delete from public.device_tokens d
  where d.user_id = me and d.id in (
    select id from public.device_tokens where user_id = me order by updated_at desc offset 10);
end;
$$;

create function public.unregister_device_token(p_token text) returns void
language sql security definer set search_path = ''
as $$ delete from public.device_tokens where token = p_token and user_id = (select auth.uid()) $$;

-- Server only: Expo says the token is no longer valid.
create function public.remove_device_token(p_token text) returns void
language sql security definer set search_path = ''
as $$ delete from public.device_tokens where token = p_token $$;

revoke execute on function public.register_device_token(text, text), public.unregister_device_token(text)
  from public, anon;
grant execute on function public.register_device_token(text, text), public.unregister_device_token(text)
  to authenticated;
revoke execute on function public.remove_device_token(text) from public, anon, authenticated;
grant execute on function public.remove_device_token(text) to service_role;

-- ---------------------------------------------------------------------------
-- The notification queue (no app access)
-- ---------------------------------------------------------------------------
-- Anything that wants to notify someone adds a row here (daily question,
-- nudges, and later matches and messages). A worker (the process-notifications
-- Edge Function) picks rows up, applies each person's preferences, and sends
-- by push and/or email. The dedupe key is what limits a person to one nudge
-- notification a day.
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('daily_question', 'matches', 'messages', 'nudges')),
  kind text not null check (kind in ('daily_question', 'nudge', 'generic')),
  title text,
  body text,
  data jsonb not null default '{}'::jsonb,
  dedupe_key text,
  send_after timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'skipped', 'failed')),
  attempts int not null default 0,
  last_error text,
  claimed_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notification_outbox_due_idx on public.notification_outbox (send_after) where status = 'pending';
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon, authenticated;

-- Returns false if a notification with the same dedupe key already exists.
create function private.enqueue_notification(
  p_user uuid, p_type text, p_kind text, p_title text, p_body text, p_data jsonb,
  p_send_after timestamptz default now(), p_dedupe text default null
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  added int;
begin
  insert into public.notification_outbox (user_id, type, kind, title, body, data, send_after, dedupe_key)
  values (p_user, p_type, p_kind, p_title, p_body, coalesce(p_data, '{}'::jsonb), p_send_after, p_dedupe)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics added = row_count;
  return added > 0;
end;
$$;

-- Everyone with a finished profile hears that today's question is live.
-- Safe to run twice: each person gets it once per question.
create function public.enqueue_daily_question_notifications() returns int
language plpgsql security definer set search_path = ''
as $$
declare
  q public.questions;
  added int;
begin
  select * into q from public.questions where question_date = public.utc_today();
  if not found then
    return 0;
  end if;
  insert into public.notification_outbox (user_id, type, kind, title, body, data, dedupe_key)
  select p.id, 'daily_question', 'daily_question', 'Today''s question is live', q.text,
         jsonb_build_object('question_id', q.id), 'daily:' || q.id
  from public.profiles p
  where p.profile_completed_at is not null
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics added = row_count;
  return added;
end;
$$;

-- The worker asks for work. For each due notification this applies the
-- person's preferences, writes the text (a nudge says how many followers want
-- to hear the answer, never who), and says which channels to use. A nudge is
-- dropped if the person has answered in the meantime.
create function public.claim_notifications(p_limit int default 50)
returns table (id uuid, user_id uuid, type text, title text, body text, data jsonb,
               email text, push_tokens text[], send_push boolean, send_email boolean)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  r public.notification_outbox;
  pref public.notification_preferences;
  push_on boolean;
  email_on boolean;
  tokens text[];
  addr text;
  n bigint;
  q uuid;
  out_title text;
  out_body text;
begin
  -- a worker that died mid-way: try those again
  update public.notification_outbox set status = 'pending'
  where status = 'sending' and claimed_at < now() - interval '10 minutes';

  for r in
    select * from public.notification_outbox o
    where o.status = 'pending' and o.send_after <= now()
    order by o.send_after, o.created_at
    limit greatest(1, least(coalesce(p_limit, 50), 200))
    for update skip locked
  loop
    out_title := r.title;
    out_body := r.body;

    if r.kind = 'nudge' then
      q := (r.data ->> 'question_id')::uuid;
      if exists (select 1 from public.answers a where a.user_id = r.user_id and a.question_id = q) then
        update public.notification_outbox set status = 'skipped', last_error = 'already answered' where id = r.id;
        continue;
      end if;
      select count(*) into n from public.nudges where target_id = r.user_id and question_id = q;
      out_title := 'Your followers are waiting';
      out_body := case when n > 1 then n || ' followers want to hear your answer to today''s question.'
                       else 'A follower wants to hear your answer to today''s question.' end;
    end if;

    select * into pref from public.notification_preferences np where np.user_id = r.user_id and np.type = r.type;
    push_on := coalesce(pref.push_enabled, private.notification_default(r.type, 'push'));
    email_on := coalesce(pref.email_enabled, private.notification_default(r.type, 'email'));

    select array_agg(d.token) into tokens from public.device_tokens d where d.user_id = r.user_id;
    select u.email into addr from auth.users u where u.id = r.user_id;

    if not ((push_on and cardinality(coalesce(tokens, '{}')) > 0) or (email_on and addr is not null)) then
      update public.notification_outbox set status = 'skipped', last_error = 'no channel enabled' where id = r.id;
      continue;
    end if;

    update public.notification_outbox set status = 'sending', claimed_at = now(), attempts = attempts + 1 where id = r.id;
    return query select r.id, r.user_id, r.type, out_title, out_body, r.data, addr,
                        coalesce(tokens, '{}'), push_on and cardinality(coalesce(tokens, '{}')) > 0, email_on and addr is not null;
  end loop;
end;
$$;

-- The worker reports back. A failure is retried a few minutes later, up to 3 tries.
create function public.complete_notification(p_id uuid, p_ok boolean, p_error text default null) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_ok then
    update public.notification_outbox set status = 'sent', sent_at = now(), last_error = null
    where id = p_id and status = 'sending';
  else
    update public.notification_outbox
    set status = case when attempts >= 3 then 'failed' else 'pending' end,
        send_after = now() + interval '5 minutes',
        last_error = left(coalesce(p_error, 'unknown error'), 500)
    where id = p_id and status = 'sending';
  end if;
end;
$$;

revoke execute on function
  public.enqueue_daily_question_notifications(), public.claim_notifications(int),
  public.complete_notification(uuid, boolean, text)
from public, anon, authenticated;
grant execute on function
  public.enqueue_daily_question_notifications(), public.claim_notifications(int),
  public.complete_notification(uuid, boolean, text)
to service_role;
revoke execute on function private.enqueue_notification(uuid, text, text, text, text, jsonb, timestamptz, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Scheduling
-- ---------------------------------------------------------------------------
-- Where the worker lives. Set once per environment (see the README, "Notifications"):
--   insert into private.worker_config (url, secret) values ('https://<project>.supabase.co/functions/v1/process-notifications', '<secret>');
-- Until then the scheduled job does nothing. The secret is never readable by the app.
create table private.worker_config (
  id boolean primary key default true check (id),
  url text not null check (url ~ '^https?://'),
  secret text not null check (char_length(secret) >= 16)
);

create function private.kick_notification_worker() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  c private.worker_config;
begin
  select * into c from private.worker_config;
  if not found then
    return;
  end if;
  if not exists (
    select 1 from public.notification_outbox o
    where (o.status = 'pending' and o.send_after <= now())
       or (o.status = 'sending' and o.claimed_at < now() - interval '10 minutes')
  ) then
    return;
  end if;
  perform net.http_post(
    url := c.url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-worker-secret', c.secret),
    body := '{}'::jsonb
  );
end;
$$;

-- Every minute, wake the worker if anything is due. At the start of each UTC
-- day, queue "today's question is live" for everyone.
select cron.schedule('notification-worker', '* * * * *', 'select private.kick_notification_worker()');
select cron.schedule('daily-question-notifications', '0 0 * * *', 'select public.enqueue_daily_question_notifications()');
