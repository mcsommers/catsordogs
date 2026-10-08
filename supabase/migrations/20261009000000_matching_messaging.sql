-- Phase 6: match requests, mutual matches, messaging, and what a block does to
-- them.
--
-- A match request is one person's interest in another. It is not visible in
-- the app as a table: the sender sees their Outgoing list and the recipient
-- their Incoming list, through the functions below. Declining is silent: the
-- request disappears for the recipient but stays "waiting for a response" for
-- the sender, so a decline can never be detected. A mutual interest (the
-- recipient accepts, or sends a request of their own) creates a match, which
-- opens a chat.
--
-- Incoming copy: "Liked your answer to …" when the request is tied to an
-- answer, or "Wants to match with you" when it was sent from a profile with
-- no answer. Liking another answer while a request is still waiting updates
-- the answer on that request.
--
-- A block ends any match and the chat, and removes requests in both
-- directions. To the blocked person it looks exactly as if the other person
-- had deleted their account. The messages are hidden from both people but kept
-- for moderators until either account is deleted.
--
-- The first profile photo is the avatar: any signed-in user can download it.
-- Later photos stay private to the owner.

-- ---------------------------------------------------------------------------
-- Avatar (first photo) is visible to signed-in users
-- ---------------------------------------------------------------------------
create function private.avatar_path(p_user uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select ph.storage_path from public.profile_photos ph
  where ph.user_id = p_user
  order by ph.position
  limit 1
$$;

create function private.is_avatar_path(p_path text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profile_photos ph
    where ph.storage_path = p_path
      and ph.position = (
        select min(p.position) from public.profile_photos p where p.user_id = ph.user_id
      )
  )
$$;

grant execute on function private.is_avatar_path(text) to authenticated;

create policy "signed-in users read avatars" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-photos' and private.is_avatar_path(name));

-- Blocked / Not Interested lists also show the avatar (already in the data model).
drop function public.list_blocked_and_not_interested();
create function public.list_blocked_and_not_interested()
returns table (kind text, user_id uuid, first_name text, age int, photo_path text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select 'blocked', p.id, p.first_name, private.age_in_years(p.birthday),
         private.avatar_path(p.id), b.created_at
  from public.blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = (select auth.uid())
  union all
  select 'not_interested', p.id, p.first_name, private.age_in_years(p.birthday),
         private.avatar_path(p.id), n.created_at
  from public.not_interested n join public.profiles p on p.id = n.target_id
  where n.user_id = (select auth.uid())
  order by 6 desc
$$;

revoke execute on function public.list_blocked_and_not_interested() from public, anon;
grant execute on function public.list_blocked_and_not_interested() to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.match_interests (
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  -- The answer that was liked ("Liked your answer to ..."). Empty when the
  -- request was sent from a profile page.
  answer_id uuid references public.answers (id) on delete set null,
  -- 'declined' is seen only by the recipient's side (the request leaves their
  -- Incoming list); the sender still sees it as waiting.
  status text not null default 'pending' check (status in ('pending', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  primary key (sender_id, recipient_id),
  check (sender_id <> recipient_id)
);
create index match_interests_recipient_idx on public.match_interests (recipient_id, status);
alter table public.match_interests enable row level security;
revoke all on public.match_interests from anon, authenticated;

-- One row per pair, stored with the smaller id first. A match that a block has
-- ended stays (hidden from both) with its messages, for moderation; the two
-- people can match again later, which creates a new row.
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles (id) on delete cascade,
  user_b uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  ended_reason text check (ended_reason in ('blocked')),
  check (user_a < user_b),
  check ((ended_at is null) = (ended_reason is null))
);
create unique index matches_active_pair_idx on public.matches (user_a, user_b) where ended_at is null;
create index matches_user_b_idx on public.matches (user_b);
alter table public.matches enable row level security;
revoke all on public.matches from anon, authenticated;
grant select on public.matches to authenticated;
create policy "members read their own active matches" on public.matches
  for select to authenticated
  using (ended_at is null and (select auth.uid()) in (user_a, user_b));

-- Text with emoji for now. kind exists so photo and video messages can be
-- added later without reshaping the table.
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'text' check (kind in ('text')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index messages_match_created_idx on public.messages (match_id, created_at desc);
alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant select on public.messages to authenticated;

-- Each person's mute for one conversation. Only they can see it: the other
-- person never learns they were muted.
create table public.conversation_mutes (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);
alter table public.conversation_mutes enable row level security;
revoke all on public.conversation_mutes from anon, authenticated;
grant select on public.conversation_mutes to authenticated;
create policy "users read their own mutes" on public.conversation_mutes
  for select to authenticated using (user_id = (select auth.uid()));

-- Is this person in this match, and is the match still going?
create function private.is_active_match_member(p_match uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match and m.ended_at is null and p_user in (m.user_a, m.user_b)
  )
$$;

-- The lookup on matches is itself limited by its read rule above: only my own
-- active matches.
create policy "members read messages in their active matches" on public.messages
  for select to authenticated
  using (exists (select 1 from public.matches m where m.id = match_id));

-- New messages reach an open chat instantly. Realtime applies the read rule
-- above, so only the two people in an active match get them. This is the
-- whole dashboard step: adding the table to the publication. Nothing else
-- has to be switched on by hand.
do $pub$
begin
  if not exists (
    select 1 from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end
$pub$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- Serialises everything that changes one pair (requests from both sides
-- arriving at once, accept, block), so a pair can never get two matches.
create function private.lock_pair(a uuid, b uuid) returns void
language sql volatile set search_path = ''
as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(least(a, b)::text || ':' || greatest(a, b)::text, 6))
$$;

create function private.active_match_id(a uuid, b uuid) returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.id from public.matches m
  where m.user_a = least(a, b) and m.user_b = greatest(a, b) and m.ended_at is null
$$;

-- The caller, who must have a finished profile to match or message.
create function private.require_finished_caller() returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if not exists (select 1 from public.profiles p where p.id = me and p.profile_completed_at is not null) then
    raise exception 'Finish your profile first.' using errcode = 'check_violation';
  end if;
  return me;
end;
$$;

-- Someone the caller can match with. A blocked person (either direction) and
-- an unfinished profile look exactly like someone who does not exist.
create function private.require_matchable_person(me uuid, p_user_id uuid) returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_user_id is null or p_user_id = me then
    raise exception 'Choose someone else.' using errcode = 'check_violation';
  end if;
  if private.is_blocked_between(me, p_user_id)
     or not exists (select 1 from public.profiles p where p.id = p_user_id and p.profile_completed_at is not null) then
    raise exception 'Person not found.' using errcode = 'no_data_found';
  end if;
end;
$$;

-- Creates the match, clears both requests, and tells the other person.
create function private.create_match(me uuid, other uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  new_id uuid;
begin
  delete from public.match_interests
    where (sender_id = me and recipient_id = other) or (sender_id = other and recipient_id = me);
  insert into public.matches (user_a, user_b) values (least(me, other), greatest(me, other))
    returning id into new_id;
  perform private.enqueue_notification(other, 'matches', 'match', null, null,
    jsonb_build_object('match_id', new_id), now(), 'match:' || new_id);
  perform private.kick_notification_worker();
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Match requests
-- ---------------------------------------------------------------------------
-- The heart button. p_answer_id is the answer that was liked (feed or answer
-- view), or empty when sent from a profile page. Liking an answer needs the
-- same right to see it as playing it (the daily gate); a request from a
-- profile page does not need the feed to be unlocked. Liking a different
-- answer while still waiting updates Incoming to that answer.
-- Returns 'sent' or 'matched' (when the other person already wanted to match).
create function public.send_match_request(p_user_id uuid, p_answer_id uuid default null) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_finished_caller();
  was_new boolean;
begin
  perform private.require_matchable_person(me, p_user_id);
  if p_answer_id is not null and not exists (
    select 1 from public.answers a
    where a.id = p_answer_id and a.user_id = p_user_id and a.status = 'live'
      and private.gate_state(me) = 'open'
  ) then
    raise exception 'Answer not found.' using errcode = 'no_data_found';
  end if;

  perform private.lock_pair(me, p_user_id);
  if private.active_match_id(me, p_user_id) is not null then
    return 'matched';
  end if;
  -- They already sent one (even one I declined): that is mutual interest.
  if exists (select 1 from public.match_interests where sender_id = p_user_id and recipient_id = me) then
    perform private.create_match(me, p_user_id);
    return 'matched';
  end if;

  insert into public.match_interests (sender_id, recipient_id, answer_id)
  values (me, p_user_id, p_answer_id)
  on conflict (sender_id, recipient_id) do update
    set answer_id = excluded.answer_id
  returning (xmax = 0) into was_new;
  if was_new then
    -- At most one request notification per sender, per recipient, per day, so
    -- cancelling and re-sending cannot be used to flood someone.
    perform private.enqueue_notification(p_user_id, 'matches', 'match_request', null, null,
      jsonb_build_object('sender_id', me), now(), 'match_request:' || me || ':' || public.utc_today());
    perform private.kick_notification_worker();
  end if;
  return 'sent';
end;
$$;

-- Accept (from the sender's profile, 07h). Returns the new match.
create function public.accept_match_request(p_user_id uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_finished_caller();
begin
  perform private.require_matchable_person(me, p_user_id);
  perform private.lock_pair(me, p_user_id);
  if not exists (
    select 1 from public.match_interests
    where sender_id = p_user_id and recipient_id = me and status = 'pending'
  ) then
    raise exception 'Request not found.' using errcode = 'no_data_found';
  end if;
  return private.create_match(me, p_user_id);
end;
$$;

-- Decline (07g). Silent: the sender is never told and still sees the request
-- as waiting. Declining something that is not there does nothing.
create function public.decline_match_request(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  update public.match_interests set status = 'declined', responded_at = now()
    where sender_id = p_user_id and recipient_id = me and status = 'pending';
end;
$$;

-- Cancel my own request (07f). Silent. I can send a new one later.
create function public.cancel_match_request(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  delete from public.match_interests where sender_id = me and recipient_id = p_user_id;
end;
$$;

-- Incoming (07 Matches): requests waiting for my answer, newest first.
-- question_text is empty when the request came from a profile (no liked
-- answer); the app then shows "Wants to match with you".
create function public.get_incoming_match_requests()
returns table (user_id uuid, first_name text, age int, photo_path text, answer_id uuid,
               question_text text, question_date date, requested_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.first_name, private.age_in_years(p.birthday), private.avatar_path(p.id),
         mi.answer_id, q.text, q.question_date, mi.created_at
  from public.match_interests mi
  join public.profiles p on p.id = mi.sender_id and p.profile_completed_at is not null
  left join public.answers a on a.id = mi.answer_id
  left join public.questions q on q.id = a.question_id
  where mi.recipient_id = (select auth.uid()) and mi.status = 'pending'
    and not private.is_blocked_between(mi.sender_id, mi.recipient_id)
  order by mi.created_at desc
$$;

-- Outgoing (07e): every request I sent and have not cancelled, all shown as
-- "Waiting for a response" (a decline is never revealed).
create function public.get_outgoing_match_requests()
returns table (user_id uuid, first_name text, age int, photo_path text, requested_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.first_name, private.age_in_years(p.birthday), private.avatar_path(p.id), mi.created_at
  from public.match_interests mi
  join public.profiles p on p.id = mi.recipient_id and p.profile_completed_at is not null
  where mi.sender_id = (select auth.uid())
    and not private.is_blocked_between(mi.sender_id, mi.recipient_id)
  order by mi.created_at desc
$$;

-- The heart button and the "wants to match with you" card on a profile (07h).
-- state: 'none', 'sent' (waiting for them), 'incoming' (they want to match;
-- with the answer they liked), or 'matched'. A blocked pair is always 'none'.
create function public.get_match_state(p_user_id uuid)
returns table (state text, match_id uuid, answer_id uuid, question_text text,
               requested_at timestamptz, photo_path text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  mid uuid;
  mi public.match_interests;
  avatar text;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  avatar := private.avatar_path(p_user_id);
  if p_user_id is null or p_user_id = me or private.is_blocked_between(me, p_user_id) then
    return query select 'none'::text, null::uuid, null::uuid, null::text, null::timestamptz, avatar;
    return;
  end if;
  mid := private.active_match_id(me, p_user_id);
  if mid is not null then
    return query select 'matched'::text, mid, null::uuid, null::text, null::timestamptz, avatar;
    return;
  end if;
  select * into mi from public.match_interests where sender_id = me and recipient_id = p_user_id;
  if found then
    return query select 'sent'::text, null::uuid, null::uuid, null::text, mi.created_at, avatar;
    return;
  end if;
  select * into mi from public.match_interests
    where sender_id = p_user_id and recipient_id = me and status = 'pending';
  if found then
    return query
      select 'incoming'::text, null::uuid, mi.answer_id, q.text, mi.created_at, avatar
      from (select 1) one
      left join public.answers a on a.id = mi.answer_id
      left join public.questions q on q.id = a.question_id;
    return;
  end if;
  return query select 'none'::text, null::uuid, null::uuid, null::text, null::timestamptz, avatar;
end;
$$;

-- "N matches" on my own profile: my matches that are still going.
create function public.get_my_match_count() returns bigint
language sql stable security definer set search_path = ''
as $$
  select case when (select auth.uid()) is null then null else (
    select count(*) from public.matches m
    where m.ended_at is null and (select auth.uid()) in (m.user_a, m.user_b)
  ) end
$$;

-- ---------------------------------------------------------------------------
-- Conversations and messages
-- ---------------------------------------------------------------------------
-- The Chats tab (07b): each match with the other person, the last message and
-- whether I muted it. A new match with no messages yet is listed too.
create function public.get_conversations()
returns table (match_id uuid, user_id uuid, first_name text, age int, photo_path text,
               matched_at timestamptz, last_message_body text, last_message_kind text,
               last_message_at timestamptz, last_message_is_mine boolean, muted boolean)
language sql stable security definer set search_path = ''
as $$
  select m.id, p.id, p.first_name, private.age_in_years(p.birthday), private.avatar_path(p.id),
         m.created_at, lm.body, lm.kind, lm.created_at, lm.sender_id = (select auth.uid()),
         exists (select 1 from public.conversation_mutes cm where cm.match_id = m.id and cm.user_id = (select auth.uid()))
  from public.matches m
  join public.profiles p on p.id = case when m.user_a = (select auth.uid()) then m.user_b else m.user_a end
  left join lateral (
    select msg.body, msg.kind, msg.created_at, msg.sender_id from public.messages msg
    where msg.match_id = m.id order by msg.created_at desc, msg.id desc limit 1
  ) lm on true
  where m.ended_at is null and (select auth.uid()) in (m.user_a, m.user_b)
  order by coalesce(lm.created_at, m.created_at) desc
$$;

-- The thread. Newest page of messages, returned oldest-first so the app can
-- append them. p_before pages to older messages.
create function public.get_messages(p_match_id uuid, p_before timestamptz default null, p_limit int default 50)
returns table (id uuid, sender_id uuid, kind text, body text, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  lim int := least(greatest(coalesce(p_limit, 50), 1), 100);
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if not private.is_active_match_member(p_match_id, me) then
    raise exception 'Conversation not found.' using errcode = 'no_data_found';
  end if;
  return query
    select q.id, q.sender_id, q.kind, q.body, q.created_at
    from (
      select msg.id, msg.sender_id, msg.kind, msg.body, msg.created_at
      from public.messages msg
      where msg.match_id = p_match_id
        and (p_before is null or msg.created_at < p_before)
      order by msg.created_at desc, msg.id desc
      limit lim
    ) q
    order by q.created_at asc, q.id asc;
end;
$$;

-- Send a text message. Only the two people in an active match can, and a
-- message to a match that has ended looks the same as one to a match that
-- never existed.
create function public.send_message(p_match_id uuid, p_body text)
returns table (id uuid, created_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  m public.matches;
  other uuid;
  body text := btrim(coalesce(p_body, ''));
  msg public.messages;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  select * into m from public.matches mm where mm.id = p_match_id and mm.ended_at is null and me in (mm.user_a, mm.user_b);
  if not found then
    raise exception 'Conversation not found.' using errcode = 'no_data_found';
  end if;
  other := case when m.user_a = me then m.user_b else m.user_a end;
  if private.is_blocked_between(me, other) then
    raise exception 'Conversation not found.' using errcode = 'no_data_found';
  end if;
  if char_length(body) = 0 then
    raise exception 'Write a message first.' using errcode = 'check_violation';
  end if;
  if char_length(body) > 1000 then
    raise exception 'Messages can be up to 1000 characters.' using errcode = 'check_violation';
  end if;
  insert into public.messages (match_id, sender_id, body) values (m.id, me, body) returning * into msg;
  perform private.enqueue_notification(other, 'messages', 'message', null, null,
    jsonb_build_object('match_id', m.id, 'message_id', msg.id), now(), null);
  perform private.kick_notification_worker();
  return query select msg.id, msg.created_at;
end;
$$;

-- Turn notifications for one conversation off or on (07d). Only I can see it.
create function public.set_conversation_muted(p_match_id uuid, p_muted boolean) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if p_muted is null then
    raise exception 'Choose on or off.' using errcode = 'check_violation';
  end if;
  if not private.is_active_match_member(p_match_id, me) then
    raise exception 'Conversation not found.' using errcode = 'no_data_found';
  end if;
  if p_muted then
    insert into public.conversation_mutes (match_id, user_id) values (p_match_id, me) on conflict do nothing;
  else
    delete from public.conversation_mutes where match_id = p_match_id and user_id = me;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Blocking now also ends any match and the chat, and removes requests in both
-- directions (on top of ending follows, from Phase 5). Unblocking brings none
-- of it back; the two can match again from scratch.
-- ---------------------------------------------------------------------------
create or replace function public.block_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_other_person(p_user_id);
begin
  perform private.lock_pair(me, p_user_id);
  insert into public.blocks (blocker_id, blocked_id) values (me, p_user_id)
    on conflict do nothing;
  delete from public.follows
    where (follower_id = me and followed_id = p_user_id) or (follower_id = p_user_id and followed_id = me);
  delete from public.match_interests
    where (sender_id = me and recipient_id = p_user_id) or (sender_id = p_user_id and recipient_id = me);
  update public.matches set ended_at = now(), ended_reason = 'blocked'
    where user_a = least(me, p_user_id) and user_b = greatest(me, p_user_id) and ended_at is null;
end;
$$;

revoke execute on function
  public.send_match_request(uuid, uuid), public.accept_match_request(uuid),
  public.decline_match_request(uuid), public.cancel_match_request(uuid),
  public.get_incoming_match_requests(), public.get_outgoing_match_requests(),
  public.get_match_state(uuid), public.get_my_match_count(), public.get_conversations(),
  public.get_messages(uuid, timestamptz, int), public.send_message(uuid, text),
  public.set_conversation_muted(uuid, boolean)
from public, anon;
grant execute on function
  public.send_match_request(uuid, uuid), public.accept_match_request(uuid),
  public.decline_match_request(uuid), public.cancel_match_request(uuid),
  public.get_incoming_match_requests(), public.get_outgoing_match_requests(),
  public.get_match_state(uuid), public.get_my_match_count(), public.get_conversations(),
  public.get_messages(uuid, timestamptz, int), public.send_message(uuid, text),
  public.set_conversation_muted(uuid, boolean)
to authenticated;

-- ---------------------------------------------------------------------------
-- Notifications for match requests, matches and messages
-- ---------------------------------------------------------------------------
-- The queue row holds only ids; names and message text are read when it is
-- sent, so anything that changed in between (a block, a cancelled request, a
-- mute) is respected. 'emailed' records that a row was sent by email, which is
-- how message emails are limited to one per conversation per hour.
alter table public.notification_outbox drop constraint notification_outbox_kind_check;
alter table public.notification_outbox add constraint notification_outbox_kind_check
  check (kind in ('daily_question', 'nudge', 'generic', 'match_request', 'match', 'message'));
alter table public.notification_outbox add column emailed boolean not null default false;
create index notification_outbox_message_email_idx on public.notification_outbox (user_id, claimed_at)
  where kind = 'message' and emailed;

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

    -- Message emails: at most one per conversation per hour.
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
