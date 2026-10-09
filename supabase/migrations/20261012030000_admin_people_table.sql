-- People list for the admin table: counts only (never follower identities),
-- plus last sign-in from auth. Last name is not collected, so it is not here.
drop function if exists public.admin_list_people();

create function public.admin_list_people()
returns table (
  id uuid, email text, first_name text, birthday date, age int, gender text,
  pronouns text[], sexual_orientation text[], height_cm smallint, city text,
  latitude double precision, longitude double precision, job_title text, company text,
  school text, about_me text, lifestyle_tags text[], languages text[], interests text[],
  relationship_goal text, allow_followers boolean, profile_completed_at timestamptz,
  time_zone text, created_at timestamptz, last_sign_in_at timestamptz,
  follower_count bigint, following_count bigint, match_count bigint, answer_count bigint,
  photos jsonb
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select p.id, u.email::text, p.first_name, p.birthday,
           case when p.birthday is null then null else private.age_in_years(p.birthday) end,
           p.gender, p.pronouns, p.sexual_orientation, p.height_cm, p.city,
           p.latitude, p.longitude, p.job_title, p.company, p.school, p.about_me,
           p.lifestyle_tags, p.languages, p.interests, p.relationship_goal,
           p.allow_followers, p.profile_completed_at, p.time_zone, p.created_at,
           u.last_sign_in_at,
           (select count(*) from public.follows f where f.followed_id = p.id),
           (select count(*) from public.follows f where f.follower_id = p.id),
           (select count(*) from public.matches m
             where m.ended_at is null and (m.user_a = p.id or m.user_b = p.id)),
           (select count(*) from public.answers a where a.user_id = p.id),
           coalesce((
             select jsonb_agg(jsonb_build_object('position', ph.position, 'storage_path', ph.storage_path) order by ph.position)
             from public.profile_photos ph where ph.user_id = p.id
           ), '[]'::jsonb)
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

revoke execute on function public.admin_list_people() from public, anon;
grant execute on function public.admin_list_people() to authenticated;
