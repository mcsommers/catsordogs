-- Unmatch: the person who unmatches loses the chat. The other person keeps
-- the history and can read it, but cannot send. A block still hides the chat
-- from both. Older unmatched rows have no ended_by, so they stay hidden.

alter table public.matches
  add column if not exists ended_by uuid references public.profiles (id) on delete set null;

create or replace function private.can_view_conversation(p_match uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.matches m
    where m.id = p_match
      and p_user in (m.user_a, m.user_b)
      and not private.is_blocked_between(m.user_a, m.user_b)
      and (
        m.ended_at is null
        or (
          m.ended_reason = 'unmatched'
          and m.ended_by is not null
          and m.ended_by <> p_user
        )
      )
  )
$$;

create or replace function public.unmatch_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_finished_caller();
  mid uuid;
begin
  perform private.require_matchable_person(me, p_user_id);
  perform private.lock_pair(me, p_user_id);
  mid := private.active_match_id(me, p_user_id);
  if mid is null then
    raise exception 'Conversation not found.' using errcode = 'no_data_found';
  end if;
  update public.matches
    set ended_at = now(), ended_reason = 'unmatched', ended_by = me
    where id = mid and ended_at is null;
end;
$$;

create or replace function public.get_messages(p_match_id uuid, p_before timestamptz default null, p_limit int default 50)
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
  if not private.can_view_conversation(p_match_id, me) then
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

create or replace function public.mark_conversation_read(p_match_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if not private.can_view_conversation(p_match_id, me) then
    raise exception 'Conversation not found.' using errcode = 'no_data_found';
  end if;
  insert into public.conversation_reads (user_id, match_id, last_read_at)
  values (me, p_match_id, now())
  on conflict (user_id, match_id) do update
    set last_read_at = greatest(public.conversation_reads.last_read_at, excluded.last_read_at);
end;
$$;

drop function if exists public.get_conversations();

create function public.get_conversations()
returns table (
  match_id uuid, user_id uuid, first_name text, age int, photo_path text, city text,
  matched_at timestamptz, last_message_body text, last_message_kind text,
  last_message_at timestamptz, last_message_is_mine boolean, muted boolean,
  unread_count bigint, closed boolean
)
language sql stable security definer set search_path = ''
as $$
  select m.id, p.id, p.first_name, private.age_in_years(p.birthday), private.avatar_path(p.id), p.city,
         m.created_at, lm.body, lm.kind, lm.created_at, lm.sender_id = (select auth.uid()),
         exists (select 1 from public.conversation_mutes cm where cm.match_id = m.id and cm.user_id = (select auth.uid())),
         case
           when m.ended_at is not null then 0::bigint
           when lm.sender_id is not null and lm.sender_id = (select auth.uid()) then 0::bigint
           else private.unread_message_count(m.id, (select auth.uid()))
         end,
         m.ended_at is not null
  from public.matches m
  join public.profiles p on p.id = case when m.user_a = (select auth.uid()) then m.user_b else m.user_a end
  left join lateral (
    select msg.body, msg.kind, msg.created_at, msg.sender_id from public.messages msg
    where msg.match_id = m.id order by msg.created_at desc, msg.id desc limit 1
  ) lm on true
  where (select auth.uid()) in (m.user_a, m.user_b)
    and not private.is_blocked_between(m.user_a, m.user_b)
    and (
      m.ended_at is null
      or (
        m.ended_reason = 'unmatched'
        and m.ended_by is not null
        and m.ended_by <> (select auth.uid())
      )
    )
  order by coalesce(lm.created_at, m.created_at) desc
$$;

revoke all on function public.get_conversations() from public;
grant execute on function public.get_conversations() to authenticated;
