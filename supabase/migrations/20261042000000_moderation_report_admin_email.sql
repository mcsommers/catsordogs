-- Email every admin when a video, profile, or chat message is reported.

alter table public.notification_outbox drop constraint notification_outbox_kind_check;
alter table public.notification_outbox add constraint notification_outbox_kind_check
  check (kind in (
    'daily_question', 'nudge', 'generic', 'match_request', 'match', 'message',
    'answer_disabled', 'missing_question', 'moderation_report'
  ));

create function private.enqueue_moderation_report_admin_alerts(
  p_title text,
  p_body text,
  p_data jsonb,
  p_dedupe_key text
) returns int
language plpgsql security definer set search_path = ''
as $$
declare
  added int;
begin
  insert into public.notification_outbox (user_id, type, kind, title, body, data, dedupe_key)
  select a.user_id, 'admin_alert', 'moderation_report', p_title, p_body, coalesce(p_data, '{}'::jsonb), p_dedupe_key
  from public.admin_users a
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics added = row_count;
  return added;
end;
$$;

create or replace function public.flag_answer(p_answer_id uuid) returns text
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

  select q.text, p.first_name into qtext, poster_name
  from public.questions q, public.profiles p
  where q.id = ans.question_id and p.id = ans.user_id;

  perform private.enqueue_moderation_report_admin_alerts(
    'Video answer reported',
    coalesce(poster_name, 'Someone') || '''s answer to "' || coalesce(qtext, 'today''s question')
      || '" was reported. Open the moderation queue in the admin panel to review. Reporters are not named.',
    jsonb_build_object('kind', 'answer', 'answer_id', ans.id, 'target_user_id', ans.user_id),
    'moderation_report:answer:' || ans.id::text || ':reporter:' || me::text);

  select count(*) into n from public.flags f where f.answer_id = ans.id;
  select s.flag_threshold into threshold from public.app_settings s;
  if n >= threshold then
    update public.answers set status = 'disabled' where id = ans.id and status = 'live';
    if found then
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

create or replace function public.report_profile(p_user_id uuid) returns text
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
  perform private.enqueue_moderation_report_admin_alerts(
    'Profile reported',
    coalesce(nm, 'Someone') || '''s profile was reported. Open the moderation queue in the admin panel to review. Reporters are not named.',
    jsonb_build_object('kind', 'profile', 'target_user_id', p_user_id),
    'moderation_report:profile:' || p_user_id::text || ':reporter:' || me::text);
  perform private.open_moderation_action(
    'profile', null, p_user_id, null, jsonb_build_object('first_name', nm));
  return 'reported';
end;
$$;

create or replace function public.report_message(p_message_id uuid) returns text
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
  perform private.enqueue_moderation_report_admin_alerts(
    'Chat message reported',
    'A chat message from ' || coalesce(nm, 'someone')
      || ' was reported. Open the moderation queue in the admin panel to review. Reporters are not named.',
    jsonb_build_object('kind', 'message', 'message_id', msg.id, 'target_user_id', msg.sender_id),
    'moderation_report:message:' || msg.id::text || ':reporter:' || me::text);
  perform private.open_moderation_action(
    'message', null, msg.sender_id, msg.id,
    jsonb_build_object('first_name', nm, 'body', preview));
  return 'reported';
end;
$$;
