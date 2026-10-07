-- Phase 4: answer submission, the daily gate, the feed, blocks, Not Interested,
-- feed ranking settings, and the profile location that distance needs.
--
-- Everything here is enforced in the database. The app can only call the
-- functions at the bottom of each section; it can never read other people's
-- answers, follows, or blocks directly.

-- ---------------------------------------------------------------------------
-- Location (so "Maximum distance" and "distance" on answers can work)
-- ---------------------------------------------------------------------------
-- Decided: the app looks up coordinates from the typed city name (the
-- update-location Edge Function does the lookup). Users cannot write these
-- columns themselves; only the server does, and only for the city that is
-- currently on the profile. The coordinates are never sent to other people:
-- the feed returns only a rounded distance.
alter table public.profiles
  add column latitude double precision check (latitude between -90 and 90),
  add column longitude double precision check (longitude between -180 and 180);

-- If the city changes, the old coordinates no longer describe it, so clear
-- them. (The server sets city-matching coordinates afterwards.)
create function private.clear_location_on_city_change() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.city is distinct from old.city
     and new.latitude is not distinct from old.latitude
     and new.longitude is not distinct from old.longitude then
    new.latitude := null;
    new.longitude := null;
  end if;
  return new;
end;
$$;
create trigger profiles_clear_location
  before update of city on public.profiles
  for each row execute function private.clear_location_on_city_change();

-- Called only by the update-location Edge Function (server key). Ignored if the
-- city on the profile is no longer the one that was looked up.
create function public.set_profile_location(
  p_user_id uuid, p_city text, p_latitude double precision, p_longitude double precision
) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  changed int;
begin
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Send both a latitude and a longitude, or neither.' using errcode = 'check_violation';
  end if;
  update public.profiles
    set latitude = p_latitude, longitude = p_longitude
    where id = p_user_id and city is not distinct from p_city;
  get diagnostics changed = row_count;
  return changed > 0;
end;
$$;
revoke execute on function public.set_profile_location(uuid, text, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.set_profile_location(uuid, text, double precision, double precision) to service_role;

-- Straight-line distance in miles (haversine).
create function private.distance_miles(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns numeric
language sql immutable set search_path = ''
as $$
  select case when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
    else (2 * 3958.8 * asin(least(1, sqrt(
      power(sin(radians(lat2 - lat1) / 2), 2) +
      cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)
    ))))::numeric end
$$;

-- ---------------------------------------------------------------------------
-- follows (no app access at all; filled in by Phase 5's server functions)
-- ---------------------------------------------------------------------------
-- Created now because the feed puts followed people first. Phase 5 adds the
-- functions to follow, unfollow and nudge. Nobody using the app can read it.
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followed_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);
create index follows_followed_idx on public.follows (followed_id);
alter table public.follows enable row level security;
revoke all on public.follows from anon, authenticated;

-- ---------------------------------------------------------------------------
-- blocks and not_interested
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);
alter table public.blocks enable row level security;
-- The blocker can read their own rows. The blocked person can never read
-- anything about it. Nobody can write directly.
revoke all on public.blocks from anon, authenticated;
grant select on public.blocks to authenticated;
create policy "blockers read their own blocks" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));

create table public.not_interested (
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, target_id),
  check (user_id <> target_id)
);
alter table public.not_interested enable row level security;
revoke all on public.not_interested from anon, authenticated;
grant select on public.not_interested to authenticated;
create policy "users read their own not-interested list" on public.not_interested
  for select to authenticated using (user_id = (select auth.uid()));

-- Is there a block between these two people, in either direction?
create function private.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  )
$$;

-- Block, unblock, Not Interested and undo. All silent: the other person is
-- never told and no response ever depends on whether they blocked the caller.
-- (Phase 6 extends block_user to remove any match and end the chat.)
create function private.require_other_person(p_user_id uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if p_user_id is null or p_user_id = me then
    raise exception 'Choose someone else.' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'Person not found.' using errcode = 'no_data_found';
  end if;
  return me;
end;
$$;

create function public.block_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_other_person(p_user_id);
begin
  insert into public.blocks (blocker_id, blocked_id) values (me, p_user_id)
    on conflict do nothing;
end;
$$;

create function public.unblock_user(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_other_person(p_user_id);
begin
  delete from public.blocks where blocker_id = me and blocked_id = p_user_id;
end;
$$;

create function public.mark_not_interested(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_other_person(p_user_id);
begin
  -- Phase 5 also removes the follow here, silently, when the user follows them.
  insert into public.not_interested (user_id, target_id) values (me, p_user_id)
    on conflict do nothing;
end;
$$;

create function public.undo_not_interested(p_user_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := private.require_other_person(p_user_id);
begin
  delete from public.not_interested where user_id = me and target_id = p_user_id;
end;
$$;

-- The Blocked and Not Interested screen (08e): only the caller's own lists.
create function public.list_blocked_and_not_interested()
returns table (kind text, user_id uuid, first_name text, age int, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select 'blocked', p.id, p.first_name, private.age_in_years(p.birthday), b.created_at
  from public.blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = (select auth.uid())
  union all
  select 'not_interested', p.id, p.first_name, private.age_in_years(p.birthday), n.created_at
  from public.not_interested n join public.profiles p on p.id = n.target_id
  where n.user_id = (select auth.uid())
  order by 5 desc
$$;

revoke execute on function
  public.block_user(uuid), public.unblock_user(uuid),
  public.mark_not_interested(uuid), public.undo_not_interested(uuid),
  public.list_blocked_and_not_interested()
from public, anon;
grant execute on function
  public.block_user(uuid), public.unblock_user(uuid),
  public.mark_not_interested(uuid), public.undo_not_interested(uuid),
  public.list_blocked_and_not_interested()
to authenticated;

-- ---------------------------------------------------------------------------
-- feed_settings: each user's ranking weights (Feed Settings > Ranking)
-- ---------------------------------------------------------------------------
create table public.feed_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  shared_interests text not null default 'medium' check (shared_interests in ('low', 'medium', 'high')),
  relationship_goals text not null default 'medium' check (relationship_goals in ('low', 'medium', 'high')),
  response_depth text not null default 'medium' check (response_depth in ('low', 'medium', 'high')),
  lifestyle_compatibility text not null default 'medium' check (lifestyle_compatibility in ('low', 'medium', 'high')),
  distance text not null default 'medium' check (distance in ('low', 'medium', 'high')),
  recency text not null default 'medium' check (recency in ('low', 'medium', 'high')),
  updated_at timestamptz not null default now()
);
alter table public.feed_settings enable row level security;
revoke all on public.feed_settings from anon, authenticated;
grant select on public.feed_settings to authenticated;
grant update (shared_interests, relationship_goals, response_depth, lifestyle_compatibility, distance, recency)
  on public.feed_settings to authenticated;
create policy "users read their own ranking settings" on public.feed_settings
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users edit their own ranking settings" on public.feed_settings
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create trigger feed_settings_touch_updated_at
  before update on public.feed_settings
  for each row execute function private.touch_updated_at();

insert into public.feed_settings (user_id) select id from public.profiles;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.filter_preferences (user_id) values (new.id);
  insert into public.feed_settings (user_id) values (new.id);
  return new;
end;
$$;

-- "Reset to recommended": every signal back to Medium.
create function public.reset_feed_settings() returns void
language sql security definer set search_path = ''
as $$
  update public.feed_settings
  set shared_interests = 'medium', relationship_goals = 'medium', response_depth = 'medium',
      lifestyle_compatibility = 'medium', distance = 'medium', recency = 'medium'
  where user_id = (select auth.uid())
$$;
revoke execute on function public.reset_feed_settings() from public, anon;
grant execute on function public.reset_feed_settings() to authenticated;

-- ---------------------------------------------------------------------------
-- answers: one per user per question, never changed after submitting
-- ---------------------------------------------------------------------------
create table public.answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  video_id uuid not null unique references public.videos (id) on delete cascade,
  duration_seconds numeric(7, 3) not null,
  -- The caption words, joined, for text-based ranking. Fixed at submit time
  -- (captions lock then). The timed captions viewers see stay on the video.
  caption_text text not null default '',
  status text not null default 'live' check (status in ('live', 'disabled', 'removed')),
  submitted_at timestamptz not null default now(),
  unique (user_id, question_id)
);
create index answers_question_status_idx on public.answers (question_id, status);

alter table public.answers enable row level security;
revoke all on public.answers from anon, authenticated;
grant select on public.answers to authenticated;
-- A user reads only their own answers. Everyone else's are reached through
-- get_feed and get_answer_for_playback, behind the gate.
create policy "users read their own answers" on public.answers
  for select to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- The daily gate
-- ---------------------------------------------------------------------------
-- 'open' once the user has submitted an answer to today's question. An answer
-- that flags have disabled still counts as answered: a flag disables one
-- video, never the person's access.
create function private.gate_state(p_user uuid) returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  q uuid;
begin
  if not exists (select 1 from public.profiles p where p.id = p_user and p.profile_completed_at is not null) then
    return 'profile_incomplete';
  end if;
  select id into q from public.questions where question_date = public.utc_today();
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

-- What the Feed tab asks first: is the feed open, and what is today's question?
create function public.get_gate_status()
returns table (state text, question_id uuid, question_date date, question_text text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  return query
    select private.gate_state(auth.uid()), q.id, q.question_date, q.text
    from (select 1) one
    left join public.questions q on q.question_date = public.utc_today();
end;
$$;
revoke execute on function public.get_gate_status() from public, anon;
grant execute on function public.get_gate_status() to authenticated;

-- ---------------------------------------------------------------------------
-- Submitting an answer
-- ---------------------------------------------------------------------------
-- Turns one of the user's own finished recordings for today's question into
-- their answer. After this the answer cannot be replaced and the captions are
-- locked. If the captions are still being prepared the user is asked to try
-- again in a moment (the app retries).
create function public.submit_answer(p_video_id uuid) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  v public.videos;
  q_id uuid;
  new_id uuid;
  words text;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  -- One submit at a time per user, so two taps cannot create two answers.
  perform pg_advisory_xact_lock(hashtextextended(me::text, 1));

  if not exists (select 1 from public.profiles p where p.id = me and p.profile_completed_at is not null) then
    raise exception 'Finish your profile before answering.' using errcode = 'check_violation';
  end if;

  select * into v from public.videos where id = p_video_id and user_id = me for update;
  if not found then
    raise exception 'Video not found.' using errcode = 'no_data_found';
  end if;

  select q.id into q_id from public.questions q where q.question_date = public.utc_today();
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
revoke execute on function public.submit_answer(uuid) from public, anon;
grant execute on function public.submit_answer(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Feed: filters and ranking
-- ---------------------------------------------------------------------------
-- Does a person pass the viewer's filters? Driven by filter_definitions, so a
-- new filter on an existing profile column needs no code change. "Any" is a
-- filter that is simply absent.
--   * show_me and max_distance are the two filters that are not a plain column
--     comparison, so they are handled by key.
--   * Distance: if the viewer has no location it cannot be applied and is
--     skipped; a person with no location fails an active distance filter.
create function private.passes_filters(
  p_filters jsonb, p_person jsonb, p_age int, p_distance numeric, p_viewer_has_location boolean
) returns boolean
language plpgsql stable set search_path = ''
as $$
declare
  d record;
  val jsonb;
  pv jsonb;
  num numeric;
  chosen text[];
  have text[];
begin
  for d in select * from public.filter_definitions where active loop
    val := p_filters -> d.key;
    continue when val is null or jsonb_typeof(val) = 'null';

    if d.key = 'show_me' then
      if val #>> '{}' = 'Women' and p_person ->> 'gender' is distinct from 'Woman' then return false; end if;
      if val #>> '{}' = 'Men' and p_person ->> 'gender' is distinct from 'Man' then return false; end if;

    elsif d.key = 'max_distance' then
      continue when not p_viewer_has_location;
      if p_distance is null or p_distance > (val #>> '{}')::numeric then return false; end if;

    elsif d.control = 'range' then
      num := case when d.profile_field = 'birthday' then p_age::numeric
                  else (p_person ->> d.profile_field)::numeric end;
      if num is null or num < (val ->> 'min')::numeric or num > (val ->> 'max')::numeric then return false; end if;

    elsif d.control = 'multi' and d.profile_field is not null then
      chosen := array(select lower(x) from jsonb_array_elements_text(val) as x);
      continue when cardinality(chosen) = 0;
      pv := p_person -> d.profile_field;
      have := case jsonb_typeof(pv)
        when 'array' then array(select lower(x) from jsonb_array_elements_text(pv) as x)
        when 'string' then array[lower(pv #>> '{}')]
        else '{}'::text[] end;
      if not (have && chosen) then return false; end if;
    end if;
  end loop;
  return true;
end;
$$;

create function private.weight_value(w text) returns numeric
language sql immutable
as $$ select case w when 'low' then 1 when 'high' then 3 else 2 end::numeric $$;

-- Share of the viewer's own choices that the other person also has (0 to 1).
create function private.overlap_ratio(theirs text[], mine text[]) returns numeric
language sql immutable set search_path = ''
as $$
  select case when cardinality(mine) = 0 then 0::numeric
    else least(1, (select count(*) from unnest(mine) m where m = any (theirs))::numeric / cardinality(mine)) end
$$;

create function private.word_count(t text) returns int
language sql immutable set search_path = ''
as $$ select case when btrim(coalesce(t, '')) = '' then 0
  else array_length(regexp_split_to_array(btrim(t), '\s+'), 1) end $$;

-- Text-based ranking (no video or audio analysis): a weighted average of six
-- signals, each scaled 0 to 1, using the viewer's Low / Medium / High weights.
create function private.rank_score(
  my_interests text[], my_goal text, my_lifestyle text[],
  their_interests text[], their_goal text, their_lifestyle text[],
  caption text, distance numeric, submitted_at timestamptz, question_date date,
  w_interests text, w_goal text, w_depth text, w_lifestyle text, w_distance text, w_recency text
) returns numeric
language sql immutable set search_path = ''
as $$
  select (
      private.weight_value(w_interests) * private.overlap_ratio(their_interests, my_interests)
    + private.weight_value(w_goal) * (case when my_goal is null or their_goal is null then 0.5
                                           when my_goal = their_goal then 1 else 0 end)
    -- a 14-second answer is about 40 words
    + private.weight_value(w_depth) * least(1, private.word_count(caption) / 40.0)
    + private.weight_value(w_lifestyle) * private.overlap_ratio(their_lifestyle, my_lifestyle)
    + private.weight_value(w_distance) * (case when distance is null then 0.5
                                                else greatest(0, 1 - distance / 100) end)
    -- later in the day scores higher
    + private.weight_value(w_recency) * greatest(0, least(1,
        (extract(epoch from submitted_at) - extract(epoch from (question_date::timestamp at time zone 'utc'))) / 86400))
  ) / (
      private.weight_value(w_interests) + private.weight_value(w_goal) + private.weight_value(w_depth)
    + private.weight_value(w_lifestyle) + private.weight_value(w_distance) + private.weight_value(w_recency)
  )
$$;

-- ---------------------------------------------------------------------------
-- The feed
-- ---------------------------------------------------------------------------
-- Returns nothing until the daily gate is open. After that, for today and then
-- (rolling over automatically) each earlier day up to the admin-set look-back
-- days, newest day first. Within each day:
--   1. Followed people's answers come first, up to the admin-set share of that
--      day's visible feed, even outside the viewer's filters. Overflow
--      followed answers that do pass the filters rejoin the ranked list.
--   2. Everyone else who passes the filters, ranked by text-based score.
-- Never included: the viewer's own answers, blocked people (either direction),
-- people marked Not Interested (even if followed), disabled or removed
-- answers, unfinished profiles.
-- p_date shows just that one day (the day switcher); p_limit/p_offset page
-- through the list.
create function public.get_feed(p_limit int default 20, p_offset int default 0, p_date date default null)
returns table (
  answer_id uuid, user_id uuid, question_id uuid, question_date date, question_text text,
  first_name text, age int, distance_miles int, caption_text text, caption_segments jsonb,
  duration_seconds numeric, is_followed boolean, submitted_at timestamptz, total_count bigint
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
  select sl.aid, sl.uid, sl.qid, sl.qdate, sl.qtext, sl.fname, sl.age_years,
         round(sl.dist)::int, sl.ctext, sl.segs, sl.dur, sl.followed, sl.sub_at,
         count(*) over ()
  from slotted sl
  -- a followed answer beyond the cap competes like anyone else, so it must pass the filters
  where sl.top_slot or sl.passes
  order by sl.qdate desc, sl.top_slot desc, sl.score desc, sl.aid
  offset off limit lim;
end;
$$;
revoke execute on function public.get_feed(int, int, date) from public, anon;
grant execute on function public.get_feed(int, int, date) to authenticated;

-- ---------------------------------------------------------------------------
-- Watching someone's answer
-- ---------------------------------------------------------------------------
-- The playback id for an answer, if the caller may watch it: their own answers
-- always (the archive is not behind the gate); other people's only when the
-- gate is open, the answer is live, and neither of them has blocked the other.
-- The get-playback-url Edge Function turns the id into a short-lived link.
create function public.get_answer_for_playback(p_answer_id uuid)
returns table (mux_playback_id text)
language sql stable security definer set search_path = ''
as $$
  select v.mux_playback_id
  from public.answers a
  join public.videos v on v.id = a.video_id
  where a.id = p_answer_id
    and v.status = 'ready' and v.mux_playback_id is not null
    and (
      a.user_id = (select auth.uid())
      or (
        a.status = 'live'
        and private.gate_state((select auth.uid())) = 'open'
        and not private.is_blocked_between((select auth.uid()), a.user_id)
        and exists (select 1 from public.profiles p where p.id = a.user_id and p.profile_completed_at is not null)
      )
    )
$$;
revoke execute on function public.get_answer_for_playback(uuid) from public, anon;
grant execute on function public.get_answer_for_playback(uuid) to authenticated;
