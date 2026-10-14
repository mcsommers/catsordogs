-- Send the once-a-day nudge notification as soon as the first nudge is saved.
-- An admin can still choose a wait of 1 to 60 minutes.

alter table public.app_settings alter column nudge_delay_minutes set default 0;

update public.app_settings set nudge_delay_minutes = 0;
