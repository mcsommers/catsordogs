-- Align profile_field_defs with Build / Edit Profile (03 / 08d).

-- Occupation is a single optional text field stored in job_title (feed filter unchanged).
update public.profile_field_defs
set active = false
where field = 'pronouns';
