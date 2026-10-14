-- Unread chat messages: per-user read cursor per match (07b orange dot, Chats pill count).

create table public.conversation_reads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  match_id uuid not null references public.matches (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, match_id)
);

alter table public.conversation_reads enable row level security;
revoke all on public.conversation_reads from anon, authenticated;

create function private.unread_message_count(p_match_id uuid, p_user uuid) returns bigint
language sql stable security definer set search_path = ''
as $$
  select count(*)::bigint
  from public.messages msg
  where msg.match_id = p_match_id
    and msg.sender_id <> p_user
    and msg.created_at > coalesce(
      (select cr.last_read_at
         from public.conversation_reads cr
        where cr.user_id = p_user and cr.match_id = p_match_id),
      '-infinity'::timestamptz
    )
$$;

create function public.mark_conversation_read(p_match_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if not private.is_active_match_member(p_match_id, me) then
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
  unread_count bigint
)
language sql stable security definer set search_path = ''
as $$
  select m.id, p.id, p.first_name, private.age_in_years(p.birthday), private.avatar_path(p.id), p.city,
         m.created_at, lm.body, lm.kind, lm.created_at, lm.sender_id = (select auth.uid()),
         exists (select 1 from public.conversation_mutes cm where cm.match_id = m.id and cm.user_id = (select auth.uid())),
         private.unread_message_count(m.id, (select auth.uid()))
  from public.matches m
  join public.profiles p on p.id = case when m.user_a = (select auth.uid()) then m.user_b else m.user_a end
  left join lateral (
    select msg.body, msg.kind, msg.created_at, msg.sender_id from public.messages msg
    where msg.match_id = m.id order by msg.created_at desc, msg.id desc limit 1
  ) lm on true
  where m.ended_at is null and (select auth.uid()) in (m.user_a, m.user_b)
  order by coalesce(lm.created_at, m.created_at) desc
$$;

revoke all on function public.get_conversations() from public;
grant execute on function public.get_conversations() to authenticated;

revoke all on function public.mark_conversation_read(uuid) from public;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
