-- Sexual orientation choices: Straight, Gay, Bi-Sexual, Questioning.

update public.profiles
set sexual_orientation = (
  select coalesce(array_agg(
    case
      when v = 'Bisexual' then 'Bi-Sexual'
      else v
    end
  ), '{}')
  from unnest(sexual_orientation) as v
);

delete from public.profile_options
where category = 'sexual_orientation';

insert into public.profile_options (category, value, sort_order) values
  ('sexual_orientation', 'Straight', 1),
  ('sexual_orientation', 'Gay', 2),
  ('sexual_orientation', 'Bi-Sexual', 3),
  ('sexual_orientation', 'Questioning', 4);

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
