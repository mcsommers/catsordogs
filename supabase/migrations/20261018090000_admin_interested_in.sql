-- Admin moderation views: expose interested_in on people list and profile queue items.

drop function if exists public.admin_list_people();

create function public.admin_list_people()
returns table (
  id uuid, email text, first_name text, birthday date, age int, gender text,
  pronouns text[], sexual_orientation text[], height_inches smallint, city text,
  latitude double precision, longitude double precision, job_title text, company text,
  school text, about_me text, lifestyle_tags text[], languages text[], interests text[],
  interested_in text[], relationship_goal text, allow_followers boolean, profile_completed_at timestamptz,
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
           p.gender, p.pronouns, p.sexual_orientation, p.height_inches, p.city,
           p.latitude, p.longitude, p.job_title, p.company, p.school, p.about_me,
           p.lifestyle_tags, p.languages, p.interests, p.interested_in, p.relationship_goal,
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

revoke all on function public.admin_list_people() from public;
grant execute on function public.admin_list_people() to authenticated;

create or replace function public.admin_queue_item_content(p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  item public.moderation_actions;
  result jsonb;
begin
  perform private.require_admin();
  if p_id is null then
    raise exception 'Item not found.' using errcode = 'no_data_found';
  end if;
  select * into item from public.moderation_actions where id = p_id and status = 'open';
  if item.id is null then
    raise exception 'Item not found.' using errcode = 'no_data_found';
  end if;

  if item.kind = 'answer' then
    select jsonb_build_object(
      'kind', 'answer',
      'answer_id', a.id,
      'video_id', v.id,
      'video_status', v.status,
      'caption_text', a.caption_text,
      'duration_seconds', a.duration_seconds,
      'question_text', q.text,
      'question_date', q.question_date,
      'first_name', p.first_name,
      'email', u.email
    )
    into result
    from public.answers a
    join public.videos v on v.id = a.video_id
    join public.questions q on q.id = a.question_id
    join public.profiles p on p.id = a.user_id
    join auth.users u on u.id = p.id
    where a.id = item.answer_id;
  elsif item.kind = 'profile' then
    select jsonb_build_object(
      'kind', 'profile',
      'id', p.id,
      'email', u.email,
      'first_name', p.first_name,
      'birthday', p.birthday,
      'age', case when p.birthday is null then null else private.age_in_years(p.birthday) end,
      'gender', p.gender,
      'pronouns', p.pronouns,
      'sexual_orientation', p.sexual_orientation,
      'height_inches', p.height_inches,
      'city', p.city,
      'job_title', p.job_title,
      'company', p.company,
      'school', p.school,
      'about_me', p.about_me,
      'lifestyle_tags', p.lifestyle_tags,
      'languages', p.languages,
      'interests', p.interests,
      'interested_in', p.interested_in,
      'relationship_goal', p.relationship_goal,
      'allow_followers', p.allow_followers,
      'photos', coalesce((
        select jsonb_agg(jsonb_build_object('position', ph.position, 'storage_path', ph.storage_path) order by ph.position)
        from public.profile_photos ph where ph.user_id = p.id
      ), '[]'::jsonb)
    )
    into result
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = item.target_user_id;
  else
    select jsonb_build_object(
      'kind', 'message',
      'match_id', msg.match_id,
      'reported_message_id', msg.id,
      'sender_name', sender.first_name,
      'other_name', other.first_name,
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', m.id,
          'sender_id', m.sender_id,
          'sender_name', sp.first_name,
          'body', m.body,
          'created_at', m.created_at,
          'reported', m.id = msg.id
        ) order by m.created_at)
        from public.messages m
        join public.profiles sp on sp.id = m.sender_id
        where m.match_id = msg.match_id
      ), '[]'::jsonb)
    )
    into result
    from public.messages msg
    join public.matches mt on mt.id = msg.match_id
    join public.profiles sender on sender.id = msg.sender_id
    join public.profiles other on other.id = case
      when mt.user_a = msg.sender_id then mt.user_b else mt.user_a
    end
    where msg.id = item.message_id;
  end if;

  if result is null then
    return jsonb_build_object('kind', item.kind, 'gone', true);
  end if;
  return result;
end;
$$;
