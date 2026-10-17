-- Marketing launch signups: wake a small Edge Function directly (no notification_outbox).

create or replace function private.dispatch_website_launch_signup_alert(p_email text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  c private.worker_config;
  v_url text;
begin
  select * into c from private.worker_config;
  if not found then
    return;
  end if;

  v_url := regexp_replace(c.url, '/process-notifications$', '/website-launch-signup-alert');
  if v_url = c.url then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', c.secret
    ),
    body := jsonb_build_object('signup_email', p_email)
  );
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
    perform private.dispatch_website_launch_signup_alert(v_email);
  end if;

  return true;
end;
$$;

grant execute on function public.submit_website_launch_notify(text) to anon, authenticated;

drop function if exists private.enqueue_website_launch_signup_owner_alert(text, uuid);
