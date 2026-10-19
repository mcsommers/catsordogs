-- Marketing site: support inquiry form (insert-only via RPC, email via Edge Function).

create table public.website_support_inquiries (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create index website_support_inquiries_email_created_at_idx
  on public.website_support_inquiries (lower(email), created_at desc);

create index website_support_inquiries_created_at_idx
  on public.website_support_inquiries (created_at desc);

alter table public.website_support_inquiries enable row level security;

revoke all on table public.website_support_inquiries from public;
revoke all on table public.website_support_inquiries from anon, authenticated;
grant select, insert, update, delete on table public.website_support_inquiries to service_role;

create or replace function private.dispatch_website_support_inquiry(p_email text, p_message text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c private.worker_config;
  v_url text;
begin
  select * into c from private.worker_config;
  if not found then
    return;
  end if;

  v_url := regexp_replace(c.url, '/process-notifications$', '/website-support-inquiry');
  if v_url = c.url then
    return;
  end if;

  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-worker-secret', c.secret
    ),
    body := jsonb_build_object(
      'inquiry_email', p_email,
      'inquiry_message', p_message
    )
  );
end;
$$;

create or replace function public.submit_website_support_inquiry(
  p_email text,
  p_message text,
  p_company_website text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_message text;
  v_recent_email int;
  v_recent_global int;
begin
  if p_company_website is not null and trim(p_company_website) <> '' then
    return true;
  end if;

  v_email := lower(trim(p_email));
  if v_email is null or v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid email address' using errcode = '22023';
  end if;

  v_message := trim(p_message);
  if v_message is null or length(v_message) < 10 then
    raise exception 'Message is too short' using errcode = '22023';
  end if;
  if length(v_message) > 4000 then
    raise exception 'Message is too long' using errcode = '22023';
  end if;

  select count(*)::int into v_recent_email
  from public.website_support_inquiries
  where lower(email) = v_email
    and created_at > now() - interval '1 hour';

  if v_recent_email >= 3 then
    raise exception 'Too many requests. Try again later.' using errcode = '22023';
  end if;

  select count(*)::int into v_recent_global
  from public.website_support_inquiries
  where created_at > now() - interval '1 hour';

  if v_recent_global >= 60 then
    raise exception 'Too many requests. Try again later.' using errcode = '22023';
  end if;

  insert into public.website_support_inquiries (email, message)
  values (v_email, v_message);

  perform private.dispatch_website_support_inquiry(v_email, v_message);

  return true;
end;
$$;

grant execute on function public.submit_website_support_inquiry(text, text, text) to anon, authenticated;
