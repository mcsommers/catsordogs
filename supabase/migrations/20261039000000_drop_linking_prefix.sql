-- Revert notification-email deep link experiment (linking_prefix for app-open).

drop function if exists public.register_linking_prefix(text);

alter table public.profiles
  drop column if exists linking_prefix;
