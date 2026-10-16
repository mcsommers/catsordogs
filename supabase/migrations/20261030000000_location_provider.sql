-- Admin-editable city lookup: Open-Meteo (default, existing code) or Google Places.
-- The Google API key is a server secret, never stored here.

alter table public.app_settings
  add column location_provider text not null default 'open_meteo'
    check (location_provider in ('open_meteo', 'google_places'));

grant update (location_provider) on public.app_settings to authenticated;
