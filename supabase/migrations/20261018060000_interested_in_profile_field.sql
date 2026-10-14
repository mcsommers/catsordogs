-- "Interested in" (Men, Women, Non-Binary) replaces hobbies on Build / Edit Profile.

alter table public.profiles
  add column if not exists interested_in text[] not null default '{}';

update public.profile_field_defs
set active = false
where field = 'interests';

insert into public.profile_field_defs (field, label, kind, option_category, allow_custom, max_selected, sort_order, active)
values ('interested_in', 'Interested in', 'multi', 'interested_in', false, 3, 6, true)
on conflict (field) do update set
  label = excluded.label,
  kind = excluded.kind,
  option_category = excluded.option_category,
  allow_custom = excluded.allow_custom,
  max_selected = excluded.max_selected,
  sort_order = excluded.sort_order,
  active = excluded.active;

delete from public.profile_options where category = 'interested_in';

insert into public.profile_options (category, value, sort_order) values
  ('interested_in', 'Men', 1),
  ('interested_in', 'Women', 2),
  ('interested_in', 'Non-Binary', 3);
