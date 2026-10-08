-- Phase 6 follow-up: the heart on the feed needs to know whether a request
-- is already out, and a matched pair can unmatch from the chat without blocking.

-- ---------------------------------------------------------------------------
-- Unmatch
-- ---------------------------------------------------------------------------
-- Ends the match and the chat. Does not hide anyone from the feed, does not
-- end a follow, and does not tell the other person. They can match again.
alter table public.matches drop constraint matches_ended_reason_check;
alter table public.matches add constraint matches_ended_reason_check
  check (ended_reason in ('blocked', 'unmatched'));

create function public.unmatch_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_finished_caller();
  mid uuid;
begin
  perform private.require_matchable_person(me, p_user_id);
  perform private.lock_pair(me, p_user_id);
  mid := private.active_match_id(me, p_user_id);
  if mid is null then
    raise exception 'Conversation not found.' using errcode = 'no_data_found';
  end if;
  update public.matches set ended_at = now(), ended_reason = 'unmatched'
    where id = mid and ended_at is null;
end;
$$;

revoke execute on function public.unmatch_user(uuid) from public, anon;
grant execute on function public.unmatch_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Heart state on the feed (and a helper the profile already uses)
-- ---------------------------------------------------------------------------
-- 'none' | 'sent' (I requested them) | 'incoming' (they requested me) | 'matched'
create function private.match_state_between(me uuid, other uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when private.active_match_id(me, other) is not null then 'matched'
    when exists (
      select 1 from public.match_interests
      where sender_id = me and recipient_id = other
    ) then 'sent'
    when exists (
      select 1 from public.match_interests
      where sender_id = other and recipient_id = me and status = 'pending'
    ) then 'incoming'
    else 'none'
  end
$$;

drop function public.get_feed(int, int, date);

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
