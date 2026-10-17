-- Public marketing site: email signups for launch notification (insert-only via RPC).

create table public.website_launch_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now(),
  constraint website_launch_signups_email_unique unique (email)
);

alter table public.website_launch_signups enable row level security;

create or replace function public.submit_website_launch_notify(p_email text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  v_email := lower(trim(p_email));
  if v_email is null or v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Invalid email address' using errcode = '22023';
  end if;

  insert into public.website_launch_signups (email)
  values (v_email)
  on conflict (email) do nothing;

  return true;
end;
$$;

revoke all on table public.website_launch_signups from public;
revoke all on table public.website_launch_signups from anon, authenticated;
grant select, insert, update, delete on table public.website_launch_signups to service_role;

grant execute on function public.submit_website_launch_notify(text) to anon, authenticated;
