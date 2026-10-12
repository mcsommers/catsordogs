-- Expose feed look-back days for caught-up copy on the Feed end screen (06v).
drop function if exists public.get_app_config();

create function public.get_app_config()
returns table (recording_length_seconds int, min_watch_seconds int, help_support_url text, feed_lookback_days int)
language sql stable security definer set search_path = ''
as $$
  select s.recording_length_seconds, s.min_watch_seconds, s.help_support_url, s.feed_lookback_days
  from public.app_settings s
$$;

revoke execute on function public.get_app_config() from public, anon;
grant execute on function public.get_app_config() to authenticated;
