-- Build / Edit Profile changes (design 03 / 03d / 03e / 08d, Oct 2026):
--   * Gender: Woman, Man, plus 30 "More" choices; a "Show gender on my profile" switch.
--   * Sexual orientation: nine choices, pick one; a "Show orientation on my profile" switch.
--   * Interests: up to 5 picks from 278 choices; they replace the old "Shared Interests" hobby list.
--   * Lifestyle tags are removed, along with the Smoking and Drinking filters and the
--     Lifestyle Compatibility ranking signal.

-- ---------------------------------------------------------------------------
-- 1. "Show on my profile" switches. Hidden values still count for matching
--    (Show me, Sexual orientation filter); only other people's profile view changes.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column show_gender boolean not null default true,
  add column show_orientation boolean not null default true;

grant update (show_gender, show_orientation) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Gender choices. Woman and Man are the two chips; the rest sit behind "More".
-- ---------------------------------------------------------------------------
delete from public.profile_options where category = 'gender';
insert into public.profile_options (category, value, sort_order) values
  ('gender', 'Woman', 1),
  ('gender', 'Man', 2),
  ('gender', 'Agender', 3),
  ('gender', 'Androgyne', 4),
  ('gender', 'Androgynous', 5),
  ('gender', 'Bigender', 6),
  ('gender', 'Female to Male', 7),
  ('gender', 'FTM', 8),
  ('gender', 'Gender Fluid', 9),
  ('gender', 'Gender Nonconforming', 10),
  ('gender', 'Gender Questioning', 11),
  ('gender', 'Gender Variant', 12),
  ('gender', 'Male to Female', 13),
  ('gender', 'MTF', 14),
  ('gender', 'Neither', 15),
  ('gender', 'Neutrois', 16),
  ('gender', 'Non-binary', 17),
  ('gender', 'Other', 18),
  ('gender', 'Pangender', 19),
  ('gender', 'Trans', 20),
  ('gender', 'Trans Man', 21),
  ('gender', 'Trans Person', 22),
  ('gender', 'Trans Woman', 23),
  ('gender', 'Transfeminine', 24),
  ('gender', 'Transgender', 25),
  ('gender', 'Transgender Female', 26),
  ('gender', 'Transgender Male', 27),
  ('gender', 'Transgender Man', 28),
  ('gender', 'Transgender Person', 29),
  ('gender', 'Transgender Woman', 30),
  ('gender', 'Transmasculine', 31),
  ('gender', 'Two-Spirit', 32);

-- ---------------------------------------------------------------------------
-- 3. Sexual orientation: one choice from nine.
-- ---------------------------------------------------------------------------
delete from public.profile_options where category = 'sexual_orientation';
insert into public.profile_options (category, value, sort_order) values
  ('sexual_orientation', 'Straight', 1),
  ('sexual_orientation', 'Gay', 2),
  ('sexual_orientation', 'Lesbian', 3),
  ('sexual_orientation', 'Bisexual', 4),
  ('sexual_orientation', 'Asexual', 5),
  ('sexual_orientation', 'Demisexual', 6),
  ('sexual_orientation', 'Pansexual', 7),
  ('sexual_orientation', 'Queer', 8),
  ('sexual_orientation', 'Questioning', 9);

update public.profile_field_defs
set kind = 'multi', max_selected = 1, allow_custom = false
where field = 'sexual_orientation';

-- Existing profiles keep one value ("Bi-Sexual" is now "Bisexual").
update public.profiles
set sexual_orientation = case
  when cardinality(sexual_orientation) = 0 then '{}'
  else array[case sexual_orientation[1] when 'Bi-Sexual' then 'Bisexual' else sexual_orientation[1] end]
end
where cardinality(sexual_orientation) > 0;

update public.profiles
set sexual_orientation = '{}'
where cardinality(sexual_orientation) > 0
  and not exists (
    select 1 from public.profile_options o
    where o.category = 'sexual_orientation' and o.value = sexual_orientation[1] and o.active
  );

-- Saved Feed Settings filters follow the rename.
update public.filter_preferences
set filters = jsonb_set(
  filters, '{sexual_orientation}',
  (select coalesce(jsonb_agg(case when x = 'Bi-Sexual' then 'Bisexual' else x end), '[]'::jsonb)
   from jsonb_array_elements_text(filters -> 'sexual_orientation') as x))
where jsonb_typeof(filters -> 'sexual_orientation') = 'array';

-- ---------------------------------------------------------------------------
-- 4. Interests: up to 5 from the new list (alphabetical). This replaces the old
--    hobby list in the existing `interests` column, which feeds the Interests
--    filter and the Shared Interests ranking signal.
-- ---------------------------------------------------------------------------
delete from public.profile_options where category = 'interest';
insert into public.profile_options (category, value, sort_order) values
  ('interest', '00s Kid', 1),
  ('interest', '10s Kid', 2),
  ('interest', '60s Kid', 3),
  ('interest', '70s Kid', 4),
  ('interest', '80s Kid', 5),
  ('interest', '90s Kid', 6),
  ('interest', 'Açaí', 7),
  ('interest', 'Acapella', 8),
  ('interest', 'Action movies', 9),
  ('interest', 'Active Lifestyle', 10),
  ('interest', 'Activism', 11),
  ('interest', 'Alternative music', 12),
  ('interest', 'Among Us', 13),
  ('interest', 'Animated movies', 14),
  ('interest', 'Anime', 15),
  ('interest', 'Aquarium', 16),
  ('interest', 'Archery', 17),
  ('interest', 'Art', 18),
  ('interest', 'Art galleries', 19),
  ('interest', 'Astrology', 20),
  ('interest', 'Atari', 21),
  ('interest', 'Athletics', 22),
  ('interest', 'Backpacking', 23),
  ('interest', 'Badminton', 24),
  ('interest', 'Baking', 25),
  ('interest', 'Bar Hopping', 26),
  ('interest', 'Bars', 27),
  ('interest', 'Baseball', 28),
  ('interest', 'Basketball', 29),
  ('interest', 'BBQ', 30),
  ('interest', 'Beach Bars', 31),
  ('interest', 'Beach sports', 32),
  ('interest', 'Binge-Watching TV shows', 33),
  ('interest', 'Black Lives Matter', 34),
  ('interest', 'Blogging', 35),
  ('interest', 'Board Games', 36),
  ('interest', 'Boba tea', 37),
  ('interest', 'Bollywood', 38),
  ('interest', 'Bowling', 39),
  ('interest', 'Boxing', 40),
  ('interest', 'Brunch', 41),
  ('interest', 'Cafe hopping', 42),
  ('interest', 'Camping', 43),
  ('interest', 'Canoeing', 44),
  ('interest', 'Car Racing', 45),
  ('interest', 'Cars', 46),
  ('interest', 'Cheerleading', 47),
  ('interest', 'Choir', 48),
  ('interest', 'Climate Change', 49),
  ('interest', 'Climbing', 50),
  ('interest', 'Clubbing', 51),
  ('interest', 'Cocktails', 52),
  ('interest', 'Coffee', 53),
  ('interest', 'Comedy', 54),
  ('interest', 'Comic-con', 55),
  ('interest', 'Concerts', 56),
  ('interest', 'Content Creation', 57),
  ('interest', 'Cooking', 58),
  ('interest', 'Cosplay', 59),
  ('interest', 'Couchsurfing', 60),
  ('interest', 'Country Music', 61),
  ('interest', 'Craft Beer', 62),
  ('interest', 'Cricket', 63),
  ('interest', 'Crime shows', 64),
  ('interest', 'Crossfit', 65),
  ('interest', 'Cycling', 66),
  ('interest', 'Dancing', 67),
  ('interest', 'Disability Rights', 68),
  ('interest', 'Disney', 69),
  ('interest', 'Diving', 70),
  ('interest', 'DIY', 71),
  ('interest', 'Documentaries', 72),
  ('interest', 'Drama shows', 73),
  ('interest', 'Drawing', 74),
  ('interest', 'Drive-in Cinema', 75),
  ('interest', 'Dungeons & Dragons', 76),
  ('interest', 'E-Sports', 77),
  ('interest', 'EDM', 78),
  ('interest', 'Electronic Music', 79),
  ('interest', 'Entrepreneurship', 80),
  ('interest', 'Environmentalism', 81),
  ('interest', 'Equality', 82),
  ('interest', 'Equestrian', 83),
  ('interest', 'Escape Rooms', 84),
  ('interest', 'Exchange Program', 85),
  ('interest', 'Exhibition', 86),
  ('interest', 'Fantasy movies', 87),
  ('interest', 'Fashion', 88),
  ('interest', 'Feminism', 89),
  ('interest', 'Festivals', 90),
  ('interest', 'Film Festival', 91),
  ('interest', 'Fishing', 92),
  ('interest', 'Fitness classes', 93),
  ('interest', 'Folk music', 94),
  ('interest', 'Food tours', 95),
  ('interest', 'Foodie', 96),
  ('interest', 'Football', 97),
  ('interest', 'Fortnite', 98),
  ('interest', 'Free Diving', 99),
  ('interest', 'Freelancing', 100),
  ('interest', 'Funk music', 101),
  ('interest', 'Gardening', 102),
  ('interest', 'Gospel music', 103),
  ('interest', 'Grime', 104),
  ('interest', 'Gym', 105),
  ('interest', 'Gymnastics', 106),
  ('interest', 'Happy hour', 107),
  ('interest', 'Harry Potter', 108),
  ('interest', 'Heavy Metal', 109),
  ('interest', 'Hiking', 110),
  ('interest', 'Hip Hop', 111),
  ('interest', 'Hockey', 112),
  ('interest', 'Home Workout', 113),
  ('interest', 'Horror Movies', 114),
  ('interest', 'Hot Springs', 115),
  ('interest', 'House music', 116),
  ('interest', 'House Parties', 117),
  ('interest', 'Human Rights', 118),
  ('interest', 'Ice Cream', 119),
  ('interest', 'Ice Hockey', 120),
  ('interest', 'Inclusivity', 121),
  ('interest', 'Indie films', 122),
  ('interest', 'Indie music', 123),
  ('interest', 'Instagram', 124),
  ('interest', 'Investing', 125),
  ('interest', 'J-Pop', 126),
  ('interest', 'Jazz', 127),
  ('interest', 'Jetskiing', 128),
  ('interest', 'Jogging', 129),
  ('interest', 'K-drama shows', 130),
  ('interest', 'K-Pop', 131),
  ('interest', 'Karaoke', 132),
  ('interest', 'Korean Food', 133),
  ('interest', 'Language Exchange', 134),
  ('interest', 'Latin music', 135),
  ('interest', 'League of Legends', 136),
  ('interest', 'LGBTQIA+ Rights', 137),
  ('interest', 'Literature', 138),
  ('interest', 'Live Music', 139),
  ('interest', 'Makeup', 140),
  ('interest', 'Manga', 141),
  ('interest', 'Marathon', 142),
  ('interest', 'Martial Arts', 143),
  ('interest', 'Marvel', 144),
  ('interest', 'Meditation', 145),
  ('interest', 'Memes', 146),
  ('interest', 'Mental Health Awareness', 147),
  ('interest', 'Metaverse', 148),
  ('interest', 'Mindfulness', 149),
  ('interest', 'MLB', 150),
  ('interest', 'Mocktails', 151),
  ('interest', 'Motor Sports', 152),
  ('interest', 'Motorcycles', 153),
  ('interest', 'Mountains', 154),
  ('interest', 'Movies', 155),
  ('interest', 'Museums', 156),
  ('interest', 'Music', 157),
  ('interest', 'Music bands', 158),
  ('interest', 'Musical Instrument', 159),
  ('interest', 'Musical theater', 160),
  ('interest', 'Musical Writing', 161),
  ('interest', 'Nature', 162),
  ('interest', 'NBA', 163),
  ('interest', 'Netflix', 164),
  ('interest', 'NFTs', 165),
  ('interest', 'Nightlife', 166),
  ('interest', 'Nintendo', 167),
  ('interest', 'Online Games', 168),
  ('interest', 'Online Shopping', 169),
  ('interest', 'Opera', 170),
  ('interest', 'Outdoors', 171),
  ('interest', 'Paddle Boarding', 172),
  ('interest', 'Padel', 173),
  ('interest', 'Painting', 174),
  ('interest', 'Paragliding', 175),
  ('interest', 'Parties', 176),
  ('interest', 'Pho', 177),
  ('interest', 'Photography', 178),
  ('interest', 'Picnicking', 179),
  ('interest', 'Pilates', 180),
  ('interest', 'Pinterest', 181),
  ('interest', 'Plant-based', 182),
  ('interest', 'PlayStation', 183),
  ('interest', 'Podcasts', 184),
  ('interest', 'Poetry', 185),
  ('interest', 'Pole Dancing', 186),
  ('interest', 'Politics', 187),
  ('interest', 'Pop music', 188),
  ('interest', 'Pride', 189),
  ('interest', 'Pro-Choice', 190),
  ('interest', 'Pub Quiz', 191),
  ('interest', 'Pubs', 192),
  ('interest', 'Punk rock', 193),
  ('interest', 'R&B', 194),
  ('interest', 'Ramen', 195),
  ('interest', 'Rap music', 196),
  ('interest', 'Raves', 197),
  ('interest', 'Reading', 198),
  ('interest', 'Real Estate', 199),
  ('interest', 'Reality TV', 200),
  ('interest', 'Reggaeton', 201),
  ('interest', 'Road Trips', 202),
  ('interest', 'Roblox', 203),
  ('interest', 'Rock Climbing', 204),
  ('interest', 'Rock music', 205),
  ('interest', 'Rollerskating', 206),
  ('interest', 'Rom-coms', 207),
  ('interest', 'Rowing', 208),
  ('interest', 'Rugby', 209),
  ('interest', 'Running', 210),
  ('interest', 'Sailing', 211),
  ('interest', 'Sauna', 212),
  ('interest', 'Sci-Fi', 213),
  ('interest', 'Self Care', 214),
  ('interest', 'Self Development', 215),
  ('interest', 'Self Love', 216),
  ('interest', 'Shisha', 217),
  ('interest', 'Shopping', 218),
  ('interest', 'Singing', 219),
  ('interest', 'Skateboarding', 220),
  ('interest', 'Skating', 221),
  ('interest', 'Skiing', 222),
  ('interest', 'Skincare', 223),
  ('interest', 'Sneakers', 224),
  ('interest', 'Snowboarding', 225),
  ('interest', 'Soccer', 226),
  ('interest', 'Social Development', 227),
  ('interest', 'Social Media', 228),
  ('interest', 'Soul music', 229),
  ('interest', 'SoundCloud', 230),
  ('interest', 'Spa', 231),
  ('interest', 'Sports', 232),
  ('interest', 'Sports Shooting', 233),
  ('interest', 'Sports shows', 234),
  ('interest', 'Spotify', 235),
  ('interest', 'Stand up Comedy', 236),
  ('interest', 'Street Food', 237),
  ('interest', 'Surfing', 238),
  ('interest', 'Sushi', 239),
  ('interest', 'Sweet treats', 240),
  ('interest', 'Swimming', 241),
  ('interest', 'Table Tennis', 242),
  ('interest', 'Tarot', 243),
  ('interest', 'Tattoos', 244),
  ('interest', 'Tea', 245),
  ('interest', 'Techno', 246),
  ('interest', 'Tennis', 247),
  ('interest', 'Theater', 248),
  ('interest', 'Thrifting', 249),
  ('interest', 'Thriller films', 250),
  ('interest', 'TikTok', 251),
  ('interest', 'Town Festivities', 252),
  ('interest', 'Trap Music', 253),
  ('interest', 'Travel', 254),
  ('interest', 'Trivia', 255),
  ('interest', 'Trying New Things', 256),
  ('interest', 'Twitch', 257),
  ('interest', 'Upcycling', 258),
  ('interest', 'Vintage fashion', 259),
  ('interest', 'Virtual Reality', 260),
  ('interest', 'Vlogging', 261),
  ('interest', 'Volleyball', 262),
  ('interest', 'Volunteering', 263),
  ('interest', 'Voter Rights', 264),
  ('interest', 'Walking', 265),
  ('interest', 'Walking My Dog', 266),
  ('interest', 'Walking tours', 267),
  ('interest', 'Weightlifting', 268),
  ('interest', 'Wine', 269),
  ('interest', 'Working out', 270),
  ('interest', 'World Peace', 271),
  ('interest', 'Wrestling', 272),
  ('interest', 'Writing', 273),
  ('interest', 'X', 274),
  ('interest', 'Xbox', 275),
  ('interest', 'Yoga', 276),
  ('interest', 'Youth Empowerment', 277),
  ('interest', 'YouTube', 278);

update public.profile_field_defs
set label = 'Interests', kind = 'multi', option_category = 'interest',
    allow_custom = false, max_selected = 5, sort_order = 7, active = true
where field = 'interests';

-- Old picks that are still on the new list stay (at most 5); the rest are dropped.
update public.profiles p
set interests = coalesce((
  select array_agg(s.v order by s.v)
  from (
    select distinct v from unnest(p.interests) as v
    where exists (
      select 1 from public.profile_options o
      where o.category = 'interest' and o.value = v and o.active)
    order by v limit 5
  ) as s
), '{}')
where cardinality(p.interests) > 0;

-- ---------------------------------------------------------------------------
-- 5. Lifestyle tags, the Smoking and Drinking filters, and the Lifestyle
--    Compatibility signal are removed. The lifestyle_tags column stays for old
--    rows only (like languages and pronouns) and is emptied.
-- ---------------------------------------------------------------------------
update public.filter_preferences
set filters = filters - 'smoking' - 'drinking'
where filters ? 'smoking' or filters ? 'drinking';

update public.filter_definitions set active = false where key in ('smoking', 'drinking');
update public.profile_field_defs set active = false where field = 'lifestyle_tags';
delete from public.profile_options where category = 'lifestyle';
update public.profiles set lifestyle_tags = '{}' where cardinality(lifestyle_tags) > 0;

-- Ranking now has five signals.
alter table public.feed_settings drop column lifestyle_compatibility;

create or replace function public.reset_feed_settings() returns void
language sql security definer set search_path = ''
as $$
  update public.feed_settings
  set shared_interests = 'medium', relationship_goals = 'medium', response_depth = 'medium',
      distance = 'medium', recency = 'medium'
  where user_id = (select auth.uid())
$$;

drop function private.rank_score(
  text[], text, text[], text[], text, text[], text, numeric, timestamptz, date,
  text, text, text, text, text, text);

create function private.rank_score(
  my_interests text[], my_goal text,
  their_interests text[], their_goal text,
  caption text, distance numeric, submitted_at timestamptz, question_date date,
  w_interests text, w_goal text, w_depth text, w_distance text, w_recency text
) returns numeric
language sql immutable set search_path = ''
as $$
  select (
      private.weight_value(w_interests) * private.overlap_ratio(their_interests, my_interests)
    + private.weight_value(w_goal) * (case when my_goal is null or their_goal is null then 0.5
                                           when my_goal = their_goal then 1 else 0 end)
    -- a 14-second answer is about 40 words
    + private.weight_value(w_depth) * least(1, private.word_count(caption) / 40.0)
    + private.weight_value(w_distance) * (case when distance is null then 0.5
                                                else greatest(0, 1 - distance / 100) end)
    -- later in the day scores higher
    + private.weight_value(w_recency) * greatest(0, least(1,
        (extract(epoch from submitted_at) - extract(epoch from (question_date::timestamp at time zone 'utc'))) / 86400))
  ) / (
      private.weight_value(w_interests) + private.weight_value(w_goal) + private.weight_value(w_depth)
    + private.weight_value(w_distance) + private.weight_value(w_recency)
  )
$$;

drop function if exists public.get_feed(int, int, date);

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
  w_interests text := 'medium'; w_goal text := 'medium'; w_depth text := 'medium';
  w_distance text := 'medium'; w_recency text := 'medium';
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
  select f.shared_interests, f.relationship_goals, f.response_depth, f.distance, f.recency
    into w_interests, w_goal, w_depth, w_distance, w_recency
    from public.feed_settings f where f.user_id = me;
  w_interests := coalesce(w_interests, 'medium'); w_goal := coalesce(w_goal, 'medium');
  w_depth := coalesce(w_depth, 'medium');
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
           private.rank_score(my.interests, my.relationship_goal,
                              e.interests, e.relationship_goal,
                              e.ctext, e.dist, e.sub_at, e.qdate,
                              w_interests, w_goal, w_depth, w_distance, w_recency) as score
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

-- ---------------------------------------------------------------------------
-- 6. Profile card: lifestyle_tags leaves the result; the "show" switches decide
--    whether other people see gender and orientation. Matching still uses them.
-- ---------------------------------------------------------------------------
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
    case when target = me or p.show_orientation then p.sexual_orientation else '{}'::text[] end,
    case when target = me then p.show_orientation else null end,
    p.job_title,
    p.company,
    p.school,
    p.about_me,
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
