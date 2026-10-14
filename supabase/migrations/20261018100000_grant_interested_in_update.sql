-- Mobile Build / Edit Profile saves interested_in; column grants are per-column on profiles.
grant update (interested_in) on public.profiles to authenticated;
