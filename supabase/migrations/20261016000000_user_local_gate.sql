-- The daily gate (and "today's question" for recording) use each person's local
-- calendar day (midnight in their IANA time zone), not UTC. Questions stay one
-- row per calendar date; which date is "today" is per user. No time zone yet
-- means UTC (same as notifications).

create function public.user_local_today(p_user uuid, p_now timestamptz default now())
returns date
language sql stable security definer set search_path = ''
as $$
  select (p_now at time zone coalesce(
    (select p.time_zone from public.profiles p where p.id = p_user),
    'UTC'
  ))::date;
$$;
revoke execute on function public.user_local_today(uuid, timestamptz) from public, anon;
grant execute on function public.user_local_today(uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Gate
-- ---------------------------------------------------------------------------
create or replace function private.gate_state(p_user uuid) returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  q uuid;
  local_today date := public.user_local_today(p_user);
begin
  if not exists (select 1 from public.profiles p where p.id = p_user and p.profile_completed_at is not null) then
    return 'profile_incomplete';
  end if;
  select id into q from public.questions where question_date = local_today;
  if q is null then
    return 'no_question_today';
  end if;
  if exists (
    select 1 from public.answers a
    where a.user_id = p_user and a.question_id = q and a.status in ('live', 'disabled')
  ) then
    return 'open';
  end if;
  return 'not_answered';
end;
$$;

create or replace function public.get_gate_status()
returns table (state text, question_id uuid, question_date date, question_text text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  local_today date;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  local_today := public.user_local_today(me);
  return query
    select private.gate_state(me), q.id, q.question_date, q.text
    from (select 1) one
    left join public.questions q on q.question_date = local_today;
end;
$$;

drop policy if exists "everyone reads today's and past questions" on public.questions;
create policy "everyone reads today's and past questions" on public.questions
  for select to authenticated
  using (question_date <= public.user_local_today(auth.uid()) or public.is_admin());

create or replace function public.get_todays_question()
returns table (question_id uuid, question_date date, text text, is_override boolean)
language sql stable security definer set search_path = ''
as $$
  select q.id, q.question_date, q.text, q.is_override
  from public.questions q
  where q.question_date = public.user_local_today(auth.uid())
$$;

create or replace function public.get_onboarding_question()
returns table (question_id uuid, question_date date, prompt_text text, prompt_source text)
language sql stable security definer set search_path = ''
as $$
  select q.id,
         q.question_date,
         case when s.onboarding_mode = 'fixed_question' then s.onboarding_fixed_question else q.text end,
         case when s.onboarding_mode = 'fixed_question' then 'fixed' else 'today' end
  from public.questions q
  cross join public.app_settings s
  where q.question_date = public.user_local_today(auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- Recording and submit
-- ---------------------------------------------------------------------------
create or replace function public.request_video_upload()
returns table (video_id uuid, recording_length_seconds int)
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  q_id uuid;
  max_per_day int;
  length_seconds int;
  new_id uuid;
  local_today date;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(me::text, 0));

  if not exists (select 1 from public.profiles p where p.id = me and p.profile_completed_at is not null) then
    raise exception 'Finish your profile before recording.'
      using errcode = 'check_violation', hint = 'profile_incomplete';
  end if;

  local_today := public.user_local_today(me);
  select q.id into q_id from public.questions q where q.question_date = local_today;
  if q_id is null then
    raise exception 'There is no question scheduled for today.'
      using errcode = 'no_data_found', hint = 'no_question_today';
  end if;

  if exists (select 1 from public.videos v where v.user_id = me and v.question_id = q_id and v.submitted_at is not null) then
    raise exception 'You have already answered today''s question.'
      using errcode = 'check_violation', hint = 'already_answered';
  end if;

  select s.max_recordings_per_day, s.recording_length_seconds into max_per_day, length_seconds
  from public.app_settings s;

  if (select count(*) from public.videos v where v.user_id = me and v.question_id = q_id) >= max_per_day then
    raise exception 'You have reached today''s limit of % recordings.', max_per_day
      using errcode = 'check_violation', hint = 'daily_limit', detail = max_per_day::text;
  end if;

  insert into public.videos (user_id, question_id) values (me, q_id) returning id into new_id;
  return query select new_id, length_seconds;
end;
$$;

create or replace function public.submit_answer(p_video_id uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  v public.videos;
  q_id uuid;
  new_id uuid;
  words text;
  local_today date;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(me::text, 1));

  if not exists (select 1 from public.profiles p where p.id = me and p.profile_completed_at is not null) then
    raise exception 'Finish your profile before answering.' using errcode = 'check_violation';
  end if;

  select * into v from public.videos where id = p_video_id and user_id = me for update;
  if not found then
    raise exception 'Video not found.' using errcode = 'no_data_found';
  end if;

  local_today := public.user_local_today(me);
  select q.id into q_id from public.questions q where q.question_date = local_today;
  if q_id is null or v.question_id <> q_id then
    raise exception 'That recording is not for today''s question.' using errcode = 'check_violation';
  end if;

  if exists (select 1 from public.answers a where a.user_id = me and a.question_id = q_id) then
    raise exception 'You have already answered today''s question.' using errcode = 'check_violation';
  end if;

  if v.status <> 'ready' then
    raise exception 'That recording is not ready yet.' using errcode = 'check_violation';
  end if;
  if v.captions_status = 'pending' then
    raise exception 'Your captions are still being prepared. Try again in a moment.' using errcode = 'check_violation';
  end if;

  select coalesce(string_agg(btrim(seg.value ->> 'text'), ' ' order by seg.ordinality), '')
    into words
  from jsonb_array_elements(coalesce(v.caption_segments, '[]'::jsonb)) with ordinality as seg(value, ordinality);

  update public.videos set submitted_at = now() where id = v.id;
  insert into public.answers (user_id, question_id, video_id, duration_seconds, caption_text)
    values (me, q_id, v.id, v.duration_seconds, words)
    returning id into new_id;
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Feed, browse, streaks (viewer's local calendar)
-- ---------------------------------------------------------------------------
create or replace function private.streak_days(p_user uuid) returns int
language sql stable security definer set search_path = ''
as $$
  with local_today as (select public.user_local_today(p_user) as today),
  days as (
    select distinct q.question_date as answer_day
    from public.answers a join public.questions q on q.id = a.question_id
    cross join local_today lt
    where a.user_id = p_user and q.question_date <= lt.today
  ),
  anchor as (
    select case when exists (select 1 from days where answer_day = (select today from local_today))
                then (select today from local_today)
                when exists (select 1 from days where answer_day = (select today - 1 from local_today))
                then (select today - 1 from local_today) end as anchor_day
  ),
  runs as (select answer_day, answer_day - (row_number() over (order by answer_day))::int as grp from days)
  select coalesce((select count(*)::int from runs
                   where grp = (select r.grp from runs r where r.answer_day = (select anchor_day from anchor))), 0)
$$;

drop function if exists public.get_feed(int, int, date);

create function public.get_feed(p_limit int default 20, p_offset int default 0, p_date date default null)
returns table (
  answer_id uuid, user_id uuid, question_id uuid, question_date date, question_text text,
  first_name text, age int, distance_miles int, caption_text text, caption_segments jsonb,
  duration_seconds numeric, is_followed boolean, submitted_at timestamptz, total_count bigint,
  streak_days int, match_state text
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  my public.profiles;
  prefs jsonb;
  s public.app_settings;
  today date := public.user_local_today(me);
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
    where sl.top_slot or sl.passes
    order by sl.qdate desc, sl.top_slot desc, sl.score desc, sl.aid
    offset off limit lim
  )
  select p.aid, p.uid, p.qid, p.qdate, p.qtext, p.fname, p.age_years, p.dist_mi, p.ctext, p.segs, p.dur,
         p.followed, p.sub_at, p.total, private.streak_days(p.uid),
         private.match_state_between(me, p.uid)
  from page p
  order by p.qdate desc, p.top_slot desc, p.score desc, p.aid;
end;
$$;
revoke execute on function public.get_feed(int, int, date) from public, anon;
grant execute on function public.get_feed(int, int, date) to authenticated;

create or replace function public.browse_questions(p_query text default null, p_limit int default 30, p_offset int default 0)
returns table (question_id uuid, question_date date, question_text text, response_count bigint, is_today boolean, total_count bigint)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  lim int := least(greatest(coalesce(p_limit, 30), 1), 100);
  off int := greatest(coalesce(p_offset, 0), 0);
  terms text[];
  local_today date;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if private.gate_state(me) <> 'open' then
    return;
  end if;

  local_today := public.user_local_today(me);
  terms := array(
    select '%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    from regexp_split_to_table(left(btrim(coalesce(p_query, '')), 100), '\s+') as w
    where w <> ''
    limit 5
  );

  return query
  select q.id, q.question_date, q.text,
         (select count(*) from public.answers a where a.question_id = q.id and a.status = 'live'),
         q.question_date = local_today,
         count(*) over ()
  from public.questions q
  where q.question_date <= local_today
    and not exists (select 1 from unnest(terms) t where q.text not ilike t)
  order by q.question_date desc
  offset off limit lim;
end;
$$;

-- Nudges: "today" is the followed person's local day
create or replace function public.get_follow_state(p_user_id uuid)
returns table (following boolean, can_nudge boolean, already_nudged boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  q uuid;
  follows_them boolean;
  nudged boolean;
  their_today date;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  their_today := public.user_local_today(p_user_id);
  select id into q from public.questions where question_date = their_today;
  follows_them := exists (select 1 from public.follows f where f.follower_id = me and f.followed_id = p_user_id)
                  and not private.is_blocked_between(me, p_user_id);
  nudged := q is not null and exists (
    select 1 from public.nudges n where n.sender_id = me and n.target_id = p_user_id and n.question_id = q);
  return query select
    follows_them,
    follows_them and q is not null and not nudged
      and exists (select 1 from public.profiles p where p.id = p_user_id and p.allow_followers)
      and not exists (select 1 from public.answers a where a.user_id = p_user_id and a.question_id = q),
    nudged;
end;
$$;

create or replace function public.nudge_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_other_person(p_user_id);
  q uuid;
  added int;
  their_today date;
begin
  their_today := public.user_local_today(p_user_id);
  select id into q from public.questions where question_date = their_today;
  if q is null then
    raise exception 'There is no question today.' using errcode = 'no_data_found';
  end if;
  if private.is_blocked_between(me, p_user_id) then
    raise exception 'Person not found.' using errcode = 'no_data_found';
  end if;
  if not exists (select 1 from public.follows f where f.follower_id = me and f.followed_id = p_user_id) then
    raise exception 'You can only nudge people you follow.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.allow_followers) then
    raise exception 'This person is not accepting followers.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from public.answers a where a.user_id = p_user_id and a.question_id = q) then
    raise exception 'They have already answered today.' using errcode = 'check_violation';
  end if;

  insert into public.nudges (sender_id, target_id, question_id) values (me, p_user_id, q)
    on conflict do nothing;
  get diagnostics added = row_count;
  if added = 0 then
    raise exception 'You have already nudged this person today.' using errcode = 'check_violation';
  end if;

  perform private.enqueue_notification(p_user_id, 'nudges', 'nudge', null, null,
    jsonb_build_object('question_id', q), now() + interval '15 minutes', 'nudge:' || q);
end;
$$;
