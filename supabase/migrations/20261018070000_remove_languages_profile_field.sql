-- Languages removed from Build / Edit Profile UI; column kept for legacy data.

update public.profile_field_defs
set active = false
where field = 'languages';
