-- Email every admin when someone signs up on the marketing site launch list.

alter table public.notification_outbox drop constraint notification_outbox_kind_check;
alter table public.notification_outbox add constraint notification_outbox_kind_check
  check (kind in (
    'daily_question', 'nudge', 'generic', 'match_request', 'match', 'message',
    'answer_disabled', 'missing_question', 'moderation_report', 'website_launch_signup'
  ));

create function private.enqueue_website_launch_signup_admin_alerts(
  p_email text,
  p_signup_id uuid
) returns int
language plpgsql security definer set search_path = ''
as $$
declare
  added int;
begin
  insert into public.notification_outbox (user_id, type, kind, title, body, data, dedupe_key)
  select
    a.user_id,
    'admin_alert',
    'website_launch_signup',
    'New website launch signup',
    'Email address: ' || p_email || E'\n\n'
      || 'They asked to be notified when the Cats or Dogs? app launches. '
      || 'Open Email list in the admin panel to see every signup.',
    jsonb_build_object('signup_email', p_email, 'signup_id', p_signup_id),
    'website_launch_signup:' || p_signup_id::text
  from public.admin_users a
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics added = row_count;
  return added;
end;
$$;

create or replace function public.submit_website_launch_notify(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_id uuid;
begin
  v_email := lower(trim(p_email));
  if v_email is null or v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid email address' using errcode = '22023';
  end if;

  insert into public.website_launch_signups (email)
  values (v_email)
  on conflict (email) do nothing
  returning id into v_id;

  if v_id is not null then
    perform private.enqueue_website_launch_signup_admin_alerts(v_email, v_id);
  end if;

  return true;
end;
$$;

grant execute on function public.submit_website_launch_notify(text) to anon, authenticated;
