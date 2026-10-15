-- Honor show_gender / show_orientation on get_user_profile so other people
-- only see those fields when the owner turned the switches on. The owner
-- still receives the values and the switch settings (Edit Profile + 08).

drop function if exists public.get_user_profile(uuid);

create function public.get_user_profile(p_user_id uuid default null)
returns table (
  user_id uuid,
  is_self boolean,
  first_name text,
  age int,
  city text,
  distance_miles int,
  height_inches smallint,
  gender text,
  show_gender boolean,
  pronouns text[],
  sexual_orientation text[],
  show_orientation boolean,
  job_title text,
  company text,
  school text,
  about_me text,
  lifestyle_tags text[],
  languages text[],
  interested_in text[],
  interests text[],
  relationship_goal text,
  joined_at timestamptz,
  streak_days int,
  follower_count bigint,
  match_count bigint,
  profile_view_count bigint,
  match_state text,
  photos jsonb
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target uuid;
  dist int;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  target := coalesce(p_user_id, me);
  if not private.profile_view_allowed(me, target) then
    return;
  end if;

  if target <> me then
    select private.distance_miles(my.latitude, my.longitude, p.latitude, p.longitude)::int
    into dist
    from public.profiles my, public.profiles p
    where my.id = me and p.id = target;
  end if;

  return query
  select
    p.id,
    target = me,
    p.first_name,
    private.age_in_years(p.birthday),
    p.city,
    case when target = me then null else dist end,
    p.height_inches,
    case when target = me or p.show_gender then p.gender else null end,
    case when target = me then p.show_gender else null end,
    p.pronouns,
    case
      when target = me or p.show_orientation then p.sexual_orientation
      else '{}'::text[]
    end,
    case when target = me then p.show_orientation else null end,
    p.job_title,
    p.company,
    p.school,
    p.about_me,
    p.lifestyle_tags,
    p.languages,
    p.interested_in,
    p.interests,
    p.relationship_goal,
    p.created_at,
    public.get_streak(target),
    case when target = me then public.get_follower_count() else null end,
    case when target = me then public.get_my_match_count() else null end,
    case when target = me then public.get_my_profile_view_count() else null end,
    coalesce((select ms.state from public.get_match_state(target) ms limit 1), 'none'),
    coalesce((
      select jsonb_agg(jsonb_build_object('position', ph.position, 'storage_path', ph.storage_path) order by ph.position)
      from public.profile_photos ph where ph.user_id = p.id
    ), '[]'::jsonb)
  from public.profiles p
  where p.id = target;
end;
$$;

revoke all on function public.get_user_profile(uuid) from public;
grant execute on function public.get_user_profile(uuid) to authenticated;
