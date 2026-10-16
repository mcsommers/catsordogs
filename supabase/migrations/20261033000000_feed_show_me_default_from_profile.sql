-- Default Show me on first profile finish from gender + sexual orientation (product table Oct 2026).

create function private.default_feed_show_me(p_gender text, p_orientation text) returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_gender is null or btrim(p_gender) = '' then null
    when p_gender not in ('Man', 'Woman') then 'Everyone'
    when p_orientation is null or btrim(p_orientation) = '' then null
    when btrim(p_orientation) in (
      'Bisexual', 'Asexual', 'Demisexual', 'Pansexual', 'Queer', 'Questioning'
    ) then 'Everyone'
    when btrim(p_orientation) = 'Straight' then
      case p_gender when 'Man' then 'Women' when 'Woman' then 'Men' else 'Everyone' end
    when btrim(p_orientation) = 'Gay' then
      case p_gender when 'Man' then 'Men' when 'Woman' then 'Women' else 'Everyone' end
    when btrim(p_orientation) = 'Lesbian' then
      case p_gender when 'Woman' then 'Women' when 'Man' then 'Everyone' else 'Everyone' end
    else null
  end;
$$;

create or replace function public.complete_profile() returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  p public.profiles;
  missing text[] := '{}';
  orient text;
  fp jsonb;
  patch jsonb := '{}'::jsonb;
  show_me_val text;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  select * into p from public.profiles where id = me;
  if not found then
    raise exception 'No profile found.' using errcode = 'no_data_found';
  end if;
  if p.profile_completed_at is not null then
    return p.profile_completed_at;
  end if;
  if p.first_name is null then missing := array_append(missing, 'first name'); end if;
  if p.birthday is null then missing := array_append(missing, 'birthday'); end if;
  if p.gender is null then missing := array_append(missing, 'gender'); end if;
  if not exists (select 1 from public.profile_photos where user_id = me) then
    missing := array_append(missing, 'at least 1 photo');
  end if;
  if cardinality(missing) > 0 then
    raise exception 'Profile is not finished. Still needed: %.', array_to_string(missing, ', ')
      using errcode = 'check_violation';
  end if;
  update public.profiles set profile_completed_at = now() where id = me
    returning profile_completed_at into p.profile_completed_at;

  orient := null;
  if cardinality(p.sexual_orientation) > 0 then
    orient := btrim(p.sexual_orientation[1]);
    if orient = '' then orient := null; end if;
  end if;

  select fp.filters into fp from public.filter_preferences fp where fp.user_id = me;
  if found then
    show_me_val := private.default_feed_show_me(p.gender, orient);
    if show_me_val is not null and not (fp ? 'show_me') then
      patch := patch || jsonb_build_object('show_me', show_me_val);
    end if;

    if patch <> '{}'::jsonb then
      update public.filter_preferences
      set filters = fp || patch
      where user_id = me;
    end if;
  end if;

  return p.profile_completed_at;
end;
$$;
