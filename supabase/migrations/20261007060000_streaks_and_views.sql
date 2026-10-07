-- Phase 4 (continued): streaks, answer view counts, profile view counts.
--
-- Streaks are worked out from the answers table whenever they are asked for
-- (there is no separate table to keep in step). View records are server-only:
-- the app can read counts, never who viewed.

-- ---------------------------------------------------------------------------
-- Streaks
-- ---------------------------------------------------------------------------
-- The number of consecutive UTC days, ending today, on which the person
-- answered. Until they answer today, the streak still counts the days up to
-- yesterday (answering later the same day keeps it); once a day ends with no
-- answer it falls back to 0. Skipping a day resets it.
create function private.streak_days(p_user uuid) returns int
language sql stable security definer set search_path = ''
as $$
  with days as (
    select distinct q.question_date as d
    from public.answers a join public.questions q on q.id = a.question_id
    where a.user_id = p_user and q.question_date <= public.utc_today()
  ),
  anchor as (
    select case when exists (select 1 from days where d = public.utc_today()) then public.utc_today()
                when exists (select 1 from days where d = public.utc_today() - 1) then public.utc_today() - 1 end as d
  ),
  runs as (select d, d - (row_number() over (order by d))::int as grp from days)
  select coalesce((select count(*)::int from runs
                   where grp = (select r.grp from runs r where r.d = (select d from anchor))), 0)
$$;

-- Public count. For someone else it returns nothing (null) if either of you
-- has blocked the other or their profile is unfinished, so it never reveals a block.
create function public.get_streak(p_user_id uuid default null) returns int
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  target uuid;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  target := coalesce(p_user_id, me);
  if target <> me and (
       private.is_blocked_between(me, target)
       or not exists (select 1 from public.profiles p where p.id = target and p.profile_completed_at is not null)
     ) then
    return null;
  end if;
  return private.streak_days(target);
end;
$$;
revoke execute on function public.get_streak(uuid) from public, anon;
grant execute on function public.get_streak(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Answer views: who watched an answer (never readable by the app)
-- ---------------------------------------------------------------------------
create table public.answer_views (
  answer_id uuid not null references public.answers (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (answer_id, viewer_id)
);
alter table public.answer_views enable row level security;
revoke all on public.answer_views from anon, authenticated;

-- Profile views: who opened a profile (never readable by the app)
create table public.profile_views (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  viewer_id uuid not null references public.profiles (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (profile_id, viewer_id),
  check (profile_id <> viewer_id)
);
alter table public.profile_views enable row level security;
revoke all on public.profile_views from anon, authenticated;

-- Watching someone else's answer counts as one view from that person (once,
-- however many times they watch). It is recorded when the server hands out the
-- playback link, which is behind the gate and the block rules. Your own
-- answers never count.
create or replace function public.get_answer_for_playback(p_answer_id uuid)
returns table (mux_playback_id text)
language plpgsql volatile security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  owner uuid;
  playback text;
begin
  select a.user_id, v.mux_playback_id into owner, playback
  from public.answers a
  join public.videos v on v.id = a.video_id
  where a.id = p_answer_id
    and v.status = 'ready' and v.mux_playback_id is not null
    and (
      a.user_id = me
      or (
        a.status = 'live'
        and private.gate_state(me) = 'open'
        and not private.is_blocked_between(me, a.user_id)
        and exists (select 1 from public.profiles p where p.id = a.user_id and p.profile_completed_at is not null)
      )
    );
  if not found then
    return;
  end if;
  if owner <> me then
    insert into public.answer_views (answer_id, viewer_id) values (p_answer_id, me) on conflict do nothing;
  end if;
  return query select playback;
end;
$$;

-- The caller's own answers with their view counts ("Your Answers" on Profile).
-- Counts only; never who viewed.
create function public.get_my_answers()
returns table (
  answer_id uuid, question_id uuid, question_date date, question_text text, caption_text text,
  duration_seconds numeric, status text, submitted_at timestamptz, view_count bigint
)
language sql stable security definer set search_path = ''
as $$
  select a.id, q.id, q.question_date, q.text, a.caption_text, a.duration_seconds, a.status, a.submitted_at,
         (select count(*) from public.answer_views av where av.answer_id = a.id)
  from public.answers a
  join public.questions q on q.id = a.question_id
  where a.user_id = (select auth.uid())
  order by q.question_date desc
$$;
revoke execute on function public.get_my_answers() from public, anon;
grant execute on function public.get_my_answers() to authenticated;

-- ---------------------------------------------------------------------------
-- Profile views
-- ---------------------------------------------------------------------------
-- Called when someone opens another person's profile. Counted once per
-- viewer. Ignored (silently) for yourself, unfinished profiles, and when
-- either of you has blocked the other, so it can never reveal a block.
create function public.record_profile_view(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if p_user_id is null or p_user_id = me
     or private.is_blocked_between(me, p_user_id)
     or not exists (select 1 from public.profiles p where p.id = p_user_id and p.profile_completed_at is not null) then
    return;
  end if;
  insert into public.profile_views (profile_id, viewer_id) values (p_user_id, me) on conflict do nothing;
end;
$$;

-- "186 profile views" on the caller's own profile: a count of different people.
create function public.get_my_profile_view_count() returns bigint
language sql stable security definer set search_path = ''
as $$
  select count(*) from public.profile_views where profile_id = (select auth.uid())
$$;

revoke execute on function public.record_profile_view(uuid), public.get_my_profile_view_count() from public, anon;
grant execute on function public.record_profile_view(uuid), public.get_my_profile_view_count() to authenticated;

-- ---------------------------------------------------------------------------
-- The feed now also returns each person's streak (a badge on each video)
-- ---------------------------------------------------------------------------
drop function public.get_feed(int, int, date);

create function public.get_feed(p_limit int default 20, p_offset int default 0, p_date date default null)
returns table (
  answer_id uuid, user_id uuid, question_id uuid, question_date date, question_text text,
  first_name text, age int, distance_miles int, caption_text text, caption_segments jsonb,
  duration_seconds numeric, is_followed boolean, submitted_at timestamptz, total_count bigint, streak_days int
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
  w_interests text := 'medium'; w_goal text := 'medium'; w_depth text := 'medium';
  w_lifestyle text := 'medium'; w_distance text := 'medium'; w_recency text := 'medium';
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
  select f.shared_interests, f.relationship_goals, f.response_depth, f.lifestyle_compatibility, f.distance, f.recency
    into w_interests, w_goal, w_depth, w_lifestyle, w_distance, w_recency
    from public.feed_settings f where f.user_id = me;
  w_interests := coalesce(w_interests, 'medium'); w_goal := coalesce(w_goal, 'medium');
  w_depth := coalesce(w_depth, 'medium'); w_lifestyle := coalesce(w_lifestyle, 'medium');
  w_distance := coalesce(w_distance, 'medium'); w_recency := coalesce(w_recency, 'medium');

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
           p.first_name as fname, p.interests, p.relationship_goal, p.lifestyle_tags,
           private.age_in_years(p.birthday) as age_years,
           (f.follower_id is not null) as followed,
           private.distance_miles(my.latitude, my.longitude, p.latitude, p.longitude) as dist,
           to_jsonb(p) as pj
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
           private.rank_score(my.interests, my.relationship_goal, my.lifestyle_tags,
                              e.interests, e.relationship_goal, e.lifestyle_tags,
                              e.ctext, e.dist, e.sub_at, e.qdate,
                              w_interests, w_goal, w_depth, w_lifestyle, w_distance, w_recency) as score
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
           count(*) over () as total, sl.top_slot, sl.score
    from slotted sl
    -- a followed answer beyond the cap competes like anyone else, so it must pass the filters
    where sl.top_slot or sl.passes
    order by sl.qdate desc, sl.top_slot desc, sl.score desc, sl.aid
    offset off limit lim
  )
  select p.aid, p.uid, p.qid, p.qdate, p.qtext, p.fname, p.age_years, p.dist_mi, p.ctext, p.segs, p.dur,
         p.followed, p.sub_at, p.total, private.streak_days(p.uid)
  from page p
  order by p.qdate desc, p.top_slot desc, p.score desc, p.aid;
end;
$$;

revoke execute on function public.get_feed(int, int, date) from public, anon;
grant execute on function public.get_feed(int, int, date) to authenticated;
