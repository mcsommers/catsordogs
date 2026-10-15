-- People I follow (08i): the signed-in user can list people they follow
-- (name, age, photo). The follows table stays closed to the app. This does
-- not reveal who follows them.

create function public.get_people_i_follow()
returns table (
  user_id uuid,
  first_name text,
  age int,
  gender text,
  photo_path text,
  followed_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  return query
  select p.id, p.first_name, private.age_in_years(p.birthday), p.gender,
         private.avatar_path(p.id), f.created_at
  from public.follows f
  join public.profiles p on p.id = f.followed_id
  where f.follower_id = me
  order by f.created_at desc, p.id;
end;
$$;

revoke execute on function public.get_people_i_follow() from public, anon;
grant execute on function public.get_people_i_follow() to authenticated;
