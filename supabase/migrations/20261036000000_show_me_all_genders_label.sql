-- Feed Settings Show me: rename chip value "Everyone" → "All Genders" (UI label and stored value).

update public.profile_options
set value = 'All Genders'
where category = 'show_me' and value = 'Everyone';

update public.filter_preferences
set filters = jsonb_set(filters, '{show_me}', '"All Genders"')
where filters ->> 'show_me' = 'Everyone';

create or replace function private.default_feed_show_me(p_gender text, p_orientation text) returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_gender is null or btrim(p_gender) = '' then null
    when p_gender not in ('Man', 'Woman') then 'All Genders'
    when p_orientation is null or btrim(p_orientation) = '' then null
    when btrim(p_orientation) in (
      'Bisexual', 'Asexual', 'Demisexual', 'Pansexual', 'Queer', 'Questioning'
    ) then 'All Genders'
    when btrim(p_orientation) = 'Straight' then
      case p_gender when 'Man' then 'Women' when 'Woman' then 'Men' else 'All Genders' end
    when btrim(p_orientation) = 'Gay' then
      case p_gender when 'Man' then 'Men' when 'Woman' then 'Women' else 'All Genders' end
    when btrim(p_orientation) = 'Lesbian' then
      case p_gender when 'Woman' then 'Women' when 'Man' then 'All Genders' else 'All Genders' end
    else null
  end;
$$;
