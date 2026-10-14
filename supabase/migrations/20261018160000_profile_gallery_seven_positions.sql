-- Avatar is position 1; gallery photos use positions 2–7 (six slots, not counting avatar).

alter table public.profile_photos drop constraint if exists profile_photos_position_check;
alter table public.profile_photos add constraint profile_photos_position_check check (position between 1 and 7);
