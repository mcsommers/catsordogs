-- Feed Settings (06i): Shared Interests gets a fourth option, "Specific".
--   * Low / Medium / High still score by overlap with the viewer's own profile Interests.
--   * Specific lets the viewer pick any number of interests (no limit). People who share
--     those interests score much higher: the signal's weight is 6 (High is 3), and the
--     score is the number of matches divided by the smaller of 3 and the number picked
--     (3 or more matches, or all of them if fewer than 3 were picked, gives the full score).
--   * With Specific on but nothing picked, the signal behaves like Medium.
--   * The old "Interests" filter (hide people) is removed; Specific only changes the order.

-- Interests filter: remove it, and clear it from saved filters first.
update public.filter_preferences set filters = filters - 'interests' where filters ? 'interests';
update public.filter_definitions set active = false where key = 'interests';

-- Fourth option and the viewer's own list of specific interests.
alter table public.feed_settings drop constraint feed_settings_shared_interests_check;
alter table public.feed_settings
  add constraint feed_settings_shared_interests_check
  check (shared_interests in ('low', 'medium', 'high', 'specific')),
  add column specific_interests text[] not null default '{}';

grant update (specific_interests) on public.feed_settings to authenticated;

-- Each pick must be an active choice from the Interests list; no duplicates; no maximum.
create function private.validate_specific_interests() returns trigger
language plpgsql set search_path = ''
as $$
declare
  v text;
begin
  if new.specific_interests is not distinct from old.specific_interests then
    return new;
  end if;
  if (select count(distinct x) from unnest(new.specific_interests) as x) <> cardinality(new.specific_interests) then
    raise exception 'Specific interests contains duplicates.' using errcode = 'check_violation';
  end if;
  foreach v in array new.specific_interests loop
    if not exists (
      select 1 from public.profile_options o
      where o.category = 'interest' and o.value = v and o.active
    ) then
      raise exception '"%" is not an allowed choice for Interests.', v using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end;
$$;

create trigger feed_settings_validate_specific
  before update on public.feed_settings
  for each row execute function private.validate_specific_interests();

create or replace function public.reset_feed_settings() returns void
language sql security definer set search_path = ''
as $$
  update public.feed_settings
  set shared_interests = 'medium', relationship_goals = 'medium', distance = 'medium',
      specific_interests = '{}'
  where user_id = (select auth.uid())
$$;

drop function public.get_feed(int, int, date);
drop function private.rank_score(text[], text, text[], text, numeric, text, text, text);

create function private.rank_score(
  my_interests text[], my_specific text[], my_goal text,
  their_interests text[], their_goal text,
  distance numeric,
  w_interests text, w_goal text, w_distance text
) returns numeric
language sql immutable set search_path = ''
as $$
  select (
      i.w * i.s
    + private.weight_value(w_goal) * (case when my_goal is null or their_goal is null then 0.5
                                           when my_goal = their_goal then 1 else 0 end)
    + private.weight_value(w_distance) * (case when distance is null then 0.5
                                                else greatest(0, 1 - distance / 100) end)
  ) / (
      i.w + private.weight_value(w_goal) + private.weight_value(w_distance)
  )
  from (
    select
      case when w_interests = 'specific' and cardinality(my_specific) > 0 then 6::numeric
           when w_interests = 'specific' then 2::numeric
           else private.weight_value(w_interests) end as w,
      case when w_interests = 'specific' and cardinality(my_specific) > 0
             then least(1, (select count(*) from unnest(my_specific) m where m = any (their_interests))::numeric
                           / least(cardinality(my_specific), 3))
           else private.overlap_ratio(their_interests, my_interests) end as s
  ) as i
$$;

create function public.get_feed(p_limit int default 20, p_offset int default 0, p_date date default null)
returns table (
  answer_id uuid, user_id uuid, question_id uuid, question_date date, question_text text,
  first_name text, age int, distance_miles int, caption_text text, caption_segments jsonb,
  duration_seconds numeric, is_followed boolean, submitted_at timestamptz, total_count bigint,
  streak_days int, match_state text, profile_photo_path text
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  my public.profiles;
  prefs jsonb;
  s public.app_settings;
  today date := public.utc_today();
  lim int := least(greatest(coalesce(p_limit, 20), 1), 50);
  off int := greatest(coalesce(p_offset, 0), 0);
  w_interests text := 'medium'; w_goal text := 'medium'; w_distance text := 'medium';
  my_specific text[] := '{}';
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if private.gate_state(me) <> 'open' then
    return;
  end if;

  select * into my from public.profiles where id = me;
  select coalesce(fp.filters, '{}'::jsonb) into prefs from public.filter_preferences fp where fp.user_id = me;
  prefs := coalesce(prefs, '{}'::jsonb);
  select * into s from public.app_settings;
  select f.shared_interests, f.specific_interests, f.relationship_goals, f.distance
    into w_interests, my_specific, w_goal, w_distance
    from public.feed_settings f where f.user_id = me;
  my_specific := coalesce(my_specific, '{}');
  w_interests := coalesce(w_interests, 'medium'); w_goal := coalesce(w_goal, 'medium');
  w_distance := coalesce(w_distance, 'medium');

  return query
  with days as (
    select q.id as qid, q.question_date as qdate, q.text as qtext
    from public.questions q
    where case when p_date is not null then q.question_date = p_date and q.question_date <= today
               else q.question_date between today - s.feed_lookback_days and today end
  ),
  cand as (
    select a.id as aid, a.user_id as uid, d.qid, d.qdate, d.qtext,
           a.caption_text as ctext, a.duration_seconds as dur, a.submitted_at as sub_at, v.caption_segments as segs,
           p.first_name as fname, p.interests, p.relationship_goal,
           private.age_in_years(p.birthday) as age_years,
           (f.follower_id is not null) as followed,
           private.distance_miles(my.latitude, my.longitude, p.latitude, p.longitude) as dist,
           to_jsonb(p) as pj,
           (select pp.storage_path from public.profile_photos pp where pp.user_id = a.user_id and pp.position = 1 limit 1) as photo_path
    from public.answers a
    join days d on d.qid = a.question_id
    join public.profiles p on p.id = a.user_id and p.profile_completed_at is not null
    join public.videos v on v.id = a.video_id
    left join public.follows f on f.follower_id = me and f.followed_id = a.user_id
    where a.status = 'live'
      and a.user_id <> me
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = me and b.blocked_id = a.user_id) or (b.blocker_id = a.user_id and b.blocked_id = me))
      and not exists (select 1 from public.not_interested n where n.user_id = me and n.target_id = a.user_id)
  ),
  elig as (
    select c.*,
           private.passes_filters(prefs, c.pj, c.age_years, c.dist, my.latitude is not null) as passes
    from cand c
  ),
  visible as (
    select e.*,
           private.rank_score(my.interests, my_specific, my.relationship_goal,
                              e.interests, e.relationship_goal,
                              e.dist,
                              w_interests, w_goal, w_distance) as score
    from elig e
    where e.followed or e.passes
  ),
  numbered as (
    select v.*,
           count(*) over (partition by v.qdate) as day_total,
           row_number() over (partition by v.qdate, v.followed order by v.score desc, v.aid) as rn
    from visible v
  ),
  slotted as (
    select n.*,
           (n.followed and n.rn <= ceil(n.day_total * s.followed_content_cap_percent / 100.0)) as top_slot
    from numbered n
  )
  , page as (
    select sl.aid, sl.uid, sl.qid, sl.qdate, sl.qtext, sl.fname, sl.age_years,
           round(sl.dist)::int as dist_mi, sl.ctext, sl.segs, sl.dur, sl.followed, sl.sub_at,
           count(*) over () as total, sl.top_slot, sl.score, sl.photo_path
    from slotted sl
    where sl.top_slot or sl.passes
    order by sl.qdate desc, sl.top_slot desc, sl.score desc, sl.aid
    offset off limit lim
  )
  select p.aid, p.uid, p.qid, p.qdate, p.qtext, p.fname, p.age_years, p.dist_mi, p.ctext, p.segs, p.dur,
         p.followed, p.sub_at, p.total, private.streak_days(p.uid),
         private.match_state_between(me, p.uid), p.photo_path
  from page p
  order by p.qdate desc, p.top_slot desc, p.score desc, p.aid;
end;
$$;

revoke execute on function public.get_feed(int, int, date) from public, anon;
grant execute on function public.get_feed(int, int, date) to authenticated;

