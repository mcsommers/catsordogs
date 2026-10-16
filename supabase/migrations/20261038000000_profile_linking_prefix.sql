-- Expo Go opens notification emails via exp://…/--/ paths, not catsordogs://. The app
-- reports its current prefix whenever it runs; app-open reads it when redirecting.
-- Superseded by 20261039000000_drop_linking_prefix.sql (email deep links reverted).

alter table public.profiles
  add column if not exists linking_prefix text;

comment on column public.profiles.linking_prefix is
  'exp://host/--/ or catsordogs:// prefix for email deep links; set by the mobile app.';

create or replace function public.register_linking_prefix(p_prefix text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '42501';
  end if;
  if p_prefix is null or char_length(p_prefix) > 256 then
    raise exception 'Invalid linking prefix.' using errcode = '22023';
  end if;
  if p_prefix <> 'catsordogs://'
     and p_prefix !~ '^exp://[^/]+/--/$' then
    raise exception 'Invalid linking prefix.' using errcode = '22023';
  end if;
  update public.profiles set linking_prefix = p_prefix where id = auth.uid();
end;
$$;

revoke all on function public.register_linking_prefix(text) from public;
grant execute on function public.register_linking_prefix(text) to authenticated;
