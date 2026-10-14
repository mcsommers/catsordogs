-- Feed Settings (06i):
--   * The "Relationship goals" filter (pick-list) is removed. Relationship goals still
--     affect the order through the Relationship Goals ranking signal.
--   * Age range and Height are two-handle sliders. Age runs 18 to 70+, height runs
--     2'0" (24 in) to 7'0"+ (84 in). A handle resting on the far end means "no limit":
--     a saved max equal to the top of the range has no upper bound, and a saved min equal
--     to the bottom has no lower bound. Both handles at the ends is the same as Any.

--   * The "Occupation" filter is removed too.
--   * Sexual orientation moves above Age range.

-- Saved values first: validate_filters rejects keys that are no longer active.
update public.filter_preferences set filters = filters - 'relationship_goals' - 'occupation'
where filters ? 'relationship_goals' or filters ? 'occupation';
update public.filter_definitions set active = false where key in ('relationship_goals', 'occupation');

-- Order on the screen: Show me, Sexual orientation, Age range, Height.
update public.filter_definitions set sort_order = 2 where key = 'sexual_orientation';
update public.filter_definitions set sort_order = 3 where key = 'age_range';

update public.filter_definitions set min_value = 18, max_value = 70 where key = 'age_range';
update public.filter_definitions set min_value = 24, max_value = 84 where key = 'height_range';

-- Clamp anything already saved into the new ranges so the check still passes.
update public.filter_preferences
set filters = jsonb_set(filters, '{age_range}', jsonb_build_object(
      'min', least(greatest((filters #>> '{age_range,min}')::numeric, 18), 70),
      'max', least(greatest((filters #>> '{age_range,max}')::numeric, 18), 70)))
where filters ? 'age_range';
update public.filter_preferences
set filters = jsonb_set(filters, '{height_range}', jsonb_build_object(
      'min', least(greatest((filters #>> '{height_range,min}')::numeric, 24), 84),
      'max', least(greatest((filters #>> '{height_range,max}')::numeric, 24), 84)))
where filters ? 'height_range';

create or replace function private.passes_filters(
  p_filters jsonb, p_person jsonb, p_age int, p_distance numeric, p_viewer_has_location boolean
) returns boolean
language plpgsql stable set search_path = ''
as $$
declare
  d record;
  val jsonb;
  pv jsonb;
  num numeric;
  chosen text[];
  have text[];
begin
  for d in select * from public.filter_definitions where active loop
    val := p_filters -> d.key;
    continue when val is null or jsonb_typeof(val) = 'null';

    if d.key = 'show_me' then
      if val #>> '{}' = 'Women' and p_person ->> 'gender' is distinct from 'Woman' then return false; end if;
      if val #>> '{}' = 'Men' and p_person ->> 'gender' is distinct from 'Man' then return false; end if;

    elsif d.control = 'range' then
      -- Both handles on the ends: no limit at all (people with no value are not dropped).
      continue when (val ->> 'min')::numeric <= d.min_value and (val ->> 'max')::numeric >= d.max_value;
      num := case when d.profile_field = 'birthday' then p_age::numeric
                  else (p_person ->> d.profile_field)::numeric end;
      if num is null then return false; end if;
      -- A handle on its end has no limit on that side (70+ and 7'0"+).
      if (val ->> 'min')::numeric > d.min_value and num < (val ->> 'min')::numeric then return false; end if;
      if (val ->> 'max')::numeric < d.max_value and num > (val ->> 'max')::numeric then return false; end if;

    elsif d.control = 'multi' and d.profile_field is not null then
      chosen := array(select lower(x) from jsonb_array_elements_text(val) as x);
      continue when cardinality(chosen) = 0;
      pv := p_person -> d.profile_field;
      have := case jsonb_typeof(pv)
        when 'array' then array(select lower(x) from jsonb_array_elements_text(pv) as x)
        when 'string' then array[lower(pv #>> '{}')]
        else '{}'::text[] end;
      if not (have && chosen) then return false; end if;
    end if;
  end loop;
  return true;
end;
$$;
