-- Unread badges (07b): only peer-sent messages count; no indicator when you sent the last message.

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
         case
           when lm.sender_id is not null and lm.sender_id = (select auth.uid()) then 0::bigint
           else private.unread_message_count(m.id, (select auth.uid()))
         end
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
