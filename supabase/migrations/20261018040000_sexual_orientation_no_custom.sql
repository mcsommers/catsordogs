-- Sexual orientation: fixed list only (no "+ Add" custom entries).

update public.profile_field_defs
set allow_custom = false
where field = 'sexual_orientation';

update public.profiles p
set sexual_orientation = coalesce(
  (
    select array_agg(v order by v)
    from unnest(p.sexual_orientation) as v
    where exists (
      select 1
      from public.profile_options o
      where o.category = 'sexual_orientation'
        and o.value = v
        and o.active
    )
  ),
  '{}'
);
