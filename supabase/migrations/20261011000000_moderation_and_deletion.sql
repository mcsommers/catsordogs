-- Phase 7: flagging, profile and message reports, the moderator queue,
-- notifying the poster when a video is hidden, and account deletion.
--
-- Automatic scanning of videos is deferred until a moderation vendor is chosen.
-- Appeals are not in-app: the hidden-video notification points people to Help
-- & Support. Moderators are the same people as admins.

-- ---------------------------------------------------------------------------
-- Flags (one video) and reports (a profile or a chat message)
-- ---------------------------------------------------------------------------
-- No reason is stored: the designs confirm the report and nothing else.
-- Unique per reporter and target, so a second tap is a no-op. The app cannot
-- read these tables; only the functions below write them, and only admins
-- read them through the queue.

create table public.flags (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid references public.answers (id) on delete set null,
  reporter_id uuid references public.profiles (id) on delete set null,
  poster_id uuid references public.profiles (id) on delete set null,
  question_text text,
  created_at timestamptz not null default now()
);
create unique index flags_answer_reporter_idx
  on public.flags (answer_id, reporter_id) where answer_id is not null and reporter_id is not null;
create index flags_answer_idx on public.flags (answer_id);
alter table public.flags enable row level security;
revoke all on public.flags from anon, authenticated;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('profile', 'message')),
  reporter_id uuid references public.profiles (id) on delete set null,
  target_user_id uuid references public.profiles (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (kind <> 'profile' or message_id is null)
);
create unique index reports_profile_uniq
  on public.reports (reporter_id, target_user_id)
  where kind = 'profile' and reporter_id is not null and target_user_id is not null;
create unique index reports_message_uniq
  on public.reports (reporter_id, message_id)
  where kind = 'message' and reporter_id is not null and message_id is not null;
create index reports_target_idx on public.reports (kind, target_user_id);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

-- One open row per subject the moderator still needs to look at. Snapshots
-- keep a name and question/message after the account is deleted.
create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('answer', 'profile', 'message')),
  status text not null default 'open'
    check (status in ('open', 'kept_disabled', 'restored', 'reviewed')),
  answer_id uuid references public.answers (id) on delete set null,
  target_user_id uuid references public.profiles (id) on delete set null,
  message_id uuid references public.messages (id) on delete set null,
  snapshot jsonb not null default '{}'::jsonb,
  opened_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  check ((status = 'open') = (reviewed_at is null))
);
create unique index moderation_open_answer_idx
  on public.moderation_actions (answer_id) where kind = 'answer' and status = 'open' and answer_id is not null;
create unique index moderation_open_profile_idx
  on public.moderation_actions (target_user_id) where kind = 'profile' and status = 'open' and target_user_id is not null;
create unique index moderation_open_message_idx
  on public.moderation_actions (message_id) where kind = 'message' and status = 'open' and message_id is not null;
alter table public.moderation_actions enable row level security;
revoke all on public.moderation_actions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Hidden-video notification (cannot be turned off)
-- ---------------------------------------------------------------------------
alter table public.notification_outbox drop constraint notification_outbox_type_check;
alter table public.notification_outbox add constraint notification_outbox_type_check
  check (type in ('daily_question', 'matches', 'messages', 'nudges', 'moderation'));
alter table public.notification_outbox drop constraint notification_outbox_kind_check;
alter table public.notification_outbox add constraint notification_outbox_kind_check
  check (kind in ('daily_question', 'nudge', 'generic', 'match_request', 'match', 'message', 'answer_disabled'));

create or replace function private.notification_default(p_type text, p_channel text) returns boolean
language sql immutable
as $$
  select case
    when p_type = 'moderation' then true
    when p_channel = 'push' then true
    when p_channel = 'email' then p_type = 'matches'
    else false
  end
$$;

create or replace function public.claim_notifications(p_limit int default 50)
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
  skip_reason text;
  other_id uuid;
  other_name text;
  mid uuid;
  msg public.messages;
begin
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
    skip_reason := null;
    other_id := null;
    other_name := null;

    if r.kind = 'nudge' then
      q := (r.data ->> 'question_id')::uuid;
      if exists (select 1 from public.answers a where a.user_id = r.user_id and a.question_id = q) then
        skip_reason := 'already answered';
      else
        select count(*) into n from public.nudges where target_id = r.user_id and question_id = q;
        out_title := 'Your followers are waiting';
        out_body := case when n > 1 then n || ' followers want to hear your answer to today''s question.'
                         else 'A follower wants to hear your answer to today''s question.' end;
      end if;

    elsif r.kind = 'match_request' then
      other_id := (r.data ->> 'sender_id')::uuid;
      if not exists (
        select 1 from public.match_interests mi
        where mi.sender_id = other_id and mi.recipient_id = r.user_id and mi.status = 'pending'
      ) or private.is_blocked_between(r.user_id, other_id) then
        skip_reason := 'request no longer open';
      else
        select p.first_name into other_name from public.profiles p where p.id = other_id;
        out_title := 'New match request';
        out_body := coalesce(other_name, 'Someone') || ' wants to match with you.';
      end if;

    elsif r.kind = 'match' then
      mid := (r.data ->> 'match_id')::uuid;
      if not private.is_active_match_member(mid, r.user_id) then
        skip_reason := 'match ended';
      else
        select p.first_name into other_name
        from public.matches m join public.profiles p
          on p.id = case when m.user_a = r.user_id then m.user_b else m.user_a end
        where m.id = mid;
        out_title := 'It''s a match!';
        out_body := 'You and ' || coalesce(other_name, 'your match') || ' can chat now.';
      end if;

    elsif r.kind = 'message' then
      mid := (r.data ->> 'match_id')::uuid;
      select * into msg from public.messages mm where mm.id = (r.data ->> 'message_id')::uuid;
      if msg.id is null or not private.is_active_match_member(mid, r.user_id) then
        skip_reason := 'match ended';
      elsif exists (select 1 from public.conversation_mutes cm where cm.match_id = mid and cm.user_id = r.user_id) then
        skip_reason := 'conversation muted';
      else
        select p.first_name into other_name from public.profiles p where p.id = msg.sender_id;
        out_title := 'New message from ' || coalesce(other_name, 'your match');
        out_body := case when char_length(msg.body) > 140 then left(msg.body, 139) || '…' else msg.body end;
      end if;
    end if;

    if skip_reason is not null then
      update public.notification_outbox set status = 'skipped', last_error = skip_reason where id = r.id;
      continue;
    end if;

    select * into pref from public.notification_preferences np where np.user_id = r.user_id and np.type = r.type;
    push_on := coalesce(pref.push_enabled, private.notification_default(r.type, 'push'));
    email_on := coalesce(pref.email_enabled, private.notification_default(r.type, 'email'));

    -- Hidden-video notices cannot be turned off.
    if r.kind = 'answer_disabled' then
      push_on := true;
      email_on := true;
    end if;

    if email_on and r.kind = 'message' and exists (
      select 1 from public.notification_outbox o
      where o.user_id = r.user_id and o.kind = 'message' and o.emailed and o.id <> r.id
        and o.data ->> 'match_id' = r.data ->> 'match_id'
        and o.claimed_at > now() - interval '1 hour'
    ) then
      email_on := false;
    end if;

    select array_agg(d.token) into tokens from public.device_tokens d where d.user_id = r.user_id;
    select u.email into addr from auth.users u where u.id = r.user_id;

    if not ((push_on and cardinality(coalesce(tokens, '{}')) > 0) or (email_on and addr is not null)) then
      update public.notification_outbox set status = 'skipped', last_error = 'no channel enabled' where id = r.id;
      continue;
    end if;

    update public.notification_outbox
      set status = 'sending', claimed_at = now(), attempts = attempts + 1, emailed = email_on and addr is not null
      where id = r.id;
    return query select r.id, r.user_id, r.type, out_title, out_body, r.data, addr,
                        coalesce(tokens, '{}'), push_on and cardinality(coalesce(tokens, '{}')) > 0, email_on and addr is not null;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Flag a video
-- ---------------------------------------------------------------------------
create function private.open_moderation_action(
  p_kind text, p_answer uuid, p_target uuid, p_message uuid, p_snapshot jsonb
) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.moderation_actions (kind, answer_id, target_user_id, message_id, snapshot)
  values (p_kind, p_answer, p_target, p_message, coalesce(p_snapshot, '{}'::jsonb));
exception
  when unique_violation then
    null;
end;
$$;

create function private.notify_answer_disabled(p_user uuid, p_answer uuid, p_question text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  help text;
  body text;
begin
  select s.help_support_url into help from public.app_settings s;
  body := 'Your answer to "' || coalesce(p_question, 'today''s question')
    || '" was hidden while we review reports. Nobody is told who reported it. '
    || 'If you think this was a mistake, contact Help & Support.';
  if help is not null then
    body := body || ' ' || help;
  end if;
  perform private.enqueue_notification(
    p_user, 'moderation', 'answer_disabled',
    'Your answer was hidden', body,
    jsonb_build_object('answer_id', p_answer),
    now(), 'answer_disabled:' || p_answer::text);
end;
$$;

create function public.flag_answer(p_answer_id uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  ans public.answers;
  qtext text;
  poster_name text;
  n int;
  threshold int;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if p_answer_id is null then
    raise exception 'Answer not found.' using errcode = 'no_data_found';
  end if;

  select a.* into ans from public.answers a where a.id = p_answer_id;
  if ans.id is null or ans.status <> 'live' or ans.user_id = me
     or private.gate_state(me) <> 'open'
     or private.is_blocked_between(me, ans.user_id)
     or not exists (select 1 from public.profiles p where p.id = ans.user_id and p.profile_completed_at is not null) then
    raise exception 'Answer not found.' using errcode = 'no_data_found';
  end if;

  begin
    insert into public.flags (answer_id, reporter_id, poster_id, question_text)
    values (ans.id, me, ans.user_id,
            (select q.text from public.questions q where q.id = ans.question_id));
  exception
    when unique_violation then
      return 'already_flagged';
  end;

  select count(*) into n from public.flags f where f.answer_id = ans.id;
  select s.flag_threshold into threshold from public.app_settings s;
  if n >= threshold then
    update public.answers set status = 'disabled' where id = ans.id and status = 'live';
    if found then
      select q.text, p.first_name into qtext, poster_name
      from public.questions q, public.profiles p
      where q.id = ans.question_id and p.id = ans.user_id;
      perform private.open_moderation_action(
        'answer', ans.id, ans.user_id, null,
        jsonb_build_object('question_text', qtext, 'first_name', poster_name, 'flag_count', n));
      perform private.notify_answer_disabled(ans.user_id, ans.id, qtext);
    end if;
    return 'disabled';
  end if;
  return 'flagged';
end;
$$;

-- ---------------------------------------------------------------------------
-- Report a profile or a chat message
-- ---------------------------------------------------------------------------
create function public.report_profile(p_user_id uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_other_person(p_user_id);
  nm text;
begin
  if private.is_blocked_between(me, p_user_id)
     or not exists (select 1 from public.profiles p where p.id = p_user_id and p.profile_completed_at is not null) then
    raise exception 'Person not found.' using errcode = 'no_data_found';
  end if;
  select p.first_name into nm from public.profiles p where p.id = p_user_id;
  begin
    insert into public.reports (kind, reporter_id, target_user_id, snapshot)
    values ('profile', me, p_user_id, jsonb_build_object('first_name', nm));
  exception
    when unique_violation then
      return 'already_reported';
  end;
  perform private.open_moderation_action(
    'profile', null, p_user_id, null, jsonb_build_object('first_name', nm));
  return 'reported';
end;
$$;

create function public.report_message(p_message_id uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  msg public.messages;
  nm text;
  preview text;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  select m.* into msg from public.messages m where m.id = p_message_id;
  if msg.id is null or not private.is_active_match_member(msg.match_id, me) or msg.sender_id = me then
    raise exception 'Message not found.' using errcode = 'no_data_found';
  end if;
  select p.first_name into nm from public.profiles p where p.id = msg.sender_id;
  preview := case when char_length(msg.body) > 140 then left(msg.body, 139) || '…' else msg.body end;
  begin
    insert into public.reports (kind, reporter_id, target_user_id, message_id, snapshot)
    values ('message', me, msg.sender_id, msg.id,
            jsonb_build_object('first_name', nm, 'body', preview));
  exception
    when unique_violation then
      return 'already_reported';
  end;
  perform private.open_moderation_action(
    'message', null, msg.sender_id, msg.id,
    jsonb_build_object('first_name', nm, 'body', preview));
  return 'reported';
end;
$$;

-- ---------------------------------------------------------------------------
-- Moderator queue (admins only; the website for this is Phase 8)
-- ---------------------------------------------------------------------------
create function public.get_moderation_queue()
returns table (
  id uuid, kind text, high_priority boolean, report_count bigint,
  answer_id uuid, target_user_id uuid, message_id uuid,
  snapshot jsonb, opened_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  priority_at int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  select s.profile_report_priority_count into priority_at from public.app_settings s;
  return query
    select a.id, a.kind,
           case when a.kind = 'profile' then (
             select count(distinct r.reporter_id) from public.reports r
             where r.kind = 'profile' and r.target_user_id is not distinct from a.target_user_id
           ) >= priority_at else false end,
           case a.kind
             when 'answer' then (select count(*) from public.flags f where f.answer_id is not distinct from a.answer_id)
             when 'profile' then (select count(*) from public.reports r where r.kind = 'profile' and r.target_user_id is not distinct from a.target_user_id)
             else (select count(*) from public.reports r where r.kind = 'message' and r.message_id is not distinct from a.message_id)
           end,
           a.answer_id, a.target_user_id, a.message_id, a.snapshot, a.opened_at
    from public.moderation_actions a
    where a.status = 'open'
    order by 3 desc, a.opened_at desc;
end;
$$;

create function public.review_queue_item(p_id uuid, p_decision text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  item public.moderation_actions;
  decision text := lower(btrim(p_decision));
  new_status text;
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  select * into item from public.moderation_actions where id = p_id and status = 'open';
  if item.id is null then
    raise exception 'Item not found.' using errcode = 'no_data_found';
  end if;
  if item.kind = 'answer' then
    if decision not in ('restore', 'keep') then
      raise exception 'Choose restore or keep.' using errcode = 'check_violation';
    end if;
    if decision = 'restore' then
      update public.answers set status = 'live' where id = item.answer_id and status = 'disabled';
      new_status := 'restored';
    else
      new_status := 'kept_disabled';
    end if;
  else
    if decision <> 'reviewed' then
      raise exception 'Mark it as reviewed.' using errcode = 'check_violation';
    end if;
    new_status := 'reviewed';
  end if;
  update public.moderation_actions
    set status = new_status, reviewed_at = now(), reviewed_by = auth.uid()
    where id = item.id;
end;
$$;

revoke execute on function
  public.flag_answer(uuid), public.report_profile(uuid), public.report_message(uuid),
  public.get_moderation_queue(), public.review_queue_item(uuid, text)
from public, anon;
grant execute on function
  public.flag_answer(uuid), public.report_profile(uuid), public.report_message(uuid)
to authenticated;
grant execute on function
  public.get_moderation_queue(), public.review_queue_item(uuid, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Account deletion
-- ---------------------------------------------------------------------------
-- Immediate and permanent. Visible data goes away (profile, photos, videos,
-- chats, matches). Flag, report, and queue rows stay, with names stripped,
-- so a moderator can still see that a video or profile was reported.
create function public.delete_account()
returns table (mux_asset_id text)
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  assets text[];
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  select array_agg(v.mux_asset_id) filter (where v.mux_asset_id is not null)
    into assets
    from public.videos v where v.user_id = me;

  update public.moderation_actions a
    set snapshot = a.snapshot || jsonb_build_object('account_deleted', true)
    where a.target_user_id = me
       or a.answer_id in (select ans.id from public.answers ans where ans.user_id = me)
       or a.message_id in (
            select m.id from public.messages m
            join public.matches mt on mt.id = m.match_id
            where mt.user_a = me or mt.user_b = me);

  -- Detach rows we keep so cascade on messages/answers cannot fail the FK.
  update public.reports r set message_id = null
    where r.message_id in (
      select m.id from public.messages m
      join public.matches mt on mt.id = m.match_id
      where mt.user_a = me or mt.user_b = me);
  update public.moderation_actions a set message_id = null, answer_id = null, target_user_id = null
    where a.target_user_id = me
       or a.answer_id in (select ans.id from public.answers ans where ans.user_id = me)
       or a.message_id in (
            select m.id from public.messages m
            join public.matches mt on mt.id = m.match_id
            where mt.user_a = me or mt.user_b = me);
  update public.flags f
    set answer_id = null
    where f.poster_id = me or f.answer_id in (select ans.id from public.answers ans where ans.user_id = me);

  delete from auth.users where id = me;

  return query select unnest(coalesce(assets, '{}'::text[]));
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
