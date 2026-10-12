-- Phase C: profile screens — view other users' profiles, photo access, answer archives.

-- ---------------------------------------------------------------------------
-- Who may view a finished profile (and their photos / answer list metadata)
-- ---------------------------------------------------------------------------
create function private.profile_view_allowed(me uuid, target uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select me is not null and (
    target = me
    or (
      not private.is_blocked_between(me, target)
      and exists (
        select 1 from public.profiles p
        where p.id = target and p.profile_completed_at is not null
      )
    )
  );
$$;

-- All profile photos (not only the avatar) when the viewer may open the profile.
-- profile_photos is owner-readable only, so the check runs in a security definer function.
create function private.profile_photo_path_visible(p_path text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profile_photos ph
    where ph.storage_path = p_path
      and private.profile_view_allowed((select auth.uid()), ph.user_id)
  );
$$;

grant execute on function private.profile_photo_path_visible(text) to authenticated;

drop policy if exists "signed-in users read avatars" on storage.objects;

create policy "signed-in users read allowed profile photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-photos' and private.profile_photo_path_visible(name));

-- ---------------------------------------------------------------------------
-- Profile card for 08 (self) and 06j / 06n (others)
-- ---------------------------------------------------------------------------
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
  pronouns text[],
  sexual_orientation text[],
  job_title text,
  company text,
  school text,
  about_me text,
  lifestyle_tags text[],
  languages text[],
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
    p.gender,
    p.pronouns,
    p.sexual_orientation,
    p.job_title,
    p.company,
    p.school,
    p.about_me,
    p.lifestyle_tags,
    p.languages,
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

revoke execute on function public.get_user_profile(uuid) from public, anon;
grant execute on function public.get_user_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Answer archive rows (lazy-loaded). Listing is not behind the daily gate;
-- playback still is (get_answer_for_playback).
-- ---------------------------------------------------------------------------
create function public.list_user_answers(
  p_user_id uuid default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  answer_id uuid,
  question_id uuid,
  question_date date,
  question_text text,
  caption_text text,
  duration_seconds numeric,
  status text,
  submitted_at timestamptz,
  view_count bigint,
  total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target uuid;
  lim int := greatest(1, least(coalesce(p_limit, 20), 50));
  off int := greatest(coalesce(p_offset, 0), 0);
  total bigint;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  target := coalesce(p_user_id, me);
  if not private.profile_view_allowed(me, target) then
    return;
  end if;

  select count(*) into total
  from public.answers a
  join public.questions q on q.id = a.question_id
  where a.user_id = target
    and (target = me or a.status = 'live');

  return query
  select
    a.id,
    q.id,
    q.question_date,
    q.text,
    a.caption_text,
    a.duration_seconds,
    a.status,
    a.submitted_at,
    case when target = me then (
      select count(*) from public.answer_views av
      where av.answer_id = a.id and av.counted_at is not null
    ) else null end,
    total
  from public.answers a
  join public.questions q on q.id = a.question_id
  where a.user_id = target
    and (target = me or a.status = 'live')
  order by q.question_date desc, a.submitted_at desc
  limit lim offset off;
end;
$$;

revoke execute on function public.list_user_answers(uuid, int, int) from public, anon;
grant execute on function public.list_user_answers(uuid, int, int) to authenticated;
