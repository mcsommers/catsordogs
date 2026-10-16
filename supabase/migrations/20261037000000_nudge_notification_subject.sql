-- Nudge push/email subject: "You have been nudged" (body unchanged).

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
        out_title := 'You have been nudged';
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

    elsif r.kind = 'missing_question' then
      if exists (
        select 1 from public.questions qs
        where qs.question_date = (r.data ->> 'question_date')::date
      ) then
        skip_reason := 'question was added';
      end if;
    end if;

    if skip_reason is not null then
      update public.notification_outbox set status = 'skipped', last_error = skip_reason where id = r.id;
      continue;
    end if;

    select * into pref from public.notification_preferences np where np.user_id = r.user_id and np.type = r.type;
    push_on := coalesce(pref.push_enabled, private.notification_default(r.type, 'push'));
    email_on := coalesce(pref.email_enabled, private.notification_default(r.type, 'email'));

    if r.kind = 'answer_disabled' then
      push_on := true;
      email_on := true;
    end if;

    if r.type = 'admin_alert' then
      push_on := false;
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
