-- Phase 1: accounts, profiles, profile photos, filter preferences, access rules.
--
-- Security stance: tables start with NO access for the app's roles (anon,
-- authenticated). Each table below is then opened up deliberately, one
-- grant and one row-level-security policy at a time. Future tables (follows,
-- nudges, ...) inherit "no access" automatically.

-- ---------------------------------------------------------------------------
-- Default privileges: new objects in public are closed to app roles
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Server-side constants
-- ---------------------------------------------------------------------------
-- Minimum age to use the app. Self-attested birthday, checked on the server.
create function private.min_signup_age() returns int
language sql immutable
as $$ select 18 $$;

create function private.age_in_years(birthday date) returns int
language sql stable set search_path = ''
as $$ select extract(year from age(current_date, birthday))::int $$;

-- ---------------------------------------------------------------------------
-- Configuration: which profile questions exist and what answers are allowed
-- ---------------------------------------------------------------------------
-- Adding or removing a profile question means: add/remove a column on
-- profiles, a row here, and (if it should be filterable) a row in
-- filter_definitions. Screens read these tables instead of hard-coding lists.
create table public.profile_options (
  category text not null,
  value text not null,
  description text,                      -- optional second line shown under the choice (e.g. relationship goals)
  sort_order int not null default 0,
  active boolean not null default true,
  primary key (category, value)
);

create table public.profile_field_defs (
  field text primary key,                -- column name on public.profiles
  label text not null,
  kind text not null check (kind in ('single', 'multi')),
  option_category text not null,         -- category in profile_options
  allow_custom boolean not null default false,
  max_selected int check (max_selected is null or max_selected > 0),
  sort_order int not null default 0,
  active boolean not null default true
);

create table public.filter_definitions (
  key text primary key,
  label text not null,
  control text not null check (control in ('segmented', 'range', 'number', 'multi')),
  profile_field text,                    -- which profile column it filters on (null = not a profile column yet)
  option_category text,                  -- category in profile_options (segmented: the allowed values)
  min_value numeric,
  max_value numeric,
  unit text,
  sort_order int not null default 0,
  active boolean not null default true
);

alter table public.profile_options enable row level security;
alter table public.profile_field_defs enable row level security;
alter table public.filter_definitions enable row level security;

grant select on public.profile_options, public.profile_field_defs, public.filter_definitions to authenticated;
create policy "signed-in users can read profile options" on public.profile_options
  for select to authenticated using (true);
create policy "signed-in users can read profile field definitions" on public.profile_field_defs
  for select to authenticated using (true);
create policy "signed-in users can read filter definitions" on public.filter_definitions
  for select to authenticated using (true);

-- Seed data. Values come from the Build Profile (03) and Feed Settings (06i) designs.
insert into public.profile_options (category, value, sort_order) values
  ('gender', 'Woman', 1), ('gender', 'Man', 2), ('gender', 'Non-binary', 3), ('gender', 'More', 4),
  ('pronoun', 'She/her', 1), ('pronoun', 'He/him', 2), ('pronoun', 'They/them', 3),
  ('sexual_orientation', 'Straight', 1), ('sexual_orientation', 'Gay', 2), ('sexual_orientation', 'Lesbian', 3),
  ('sexual_orientation', 'Bisexual', 4), ('sexual_orientation', 'Asexual', 5),
  ('lifestyle', 'Social drinker', 1), ('lifestyle', 'Non-smoker', 2), ('lifestyle', 'Dog lover', 3),
  ('lifestyle', 'Cat lover', 4), ('lifestyle', 'Vegetarian', 5), ('lifestyle', 'Gym regular', 6),
  ('lifestyle', 'Night owl', 7), ('lifestyle', 'Aries', 8),
  ('language', 'English', 1), ('language', 'Spanish', 2), ('language', 'French', 3),
  ('interest', 'Hiking', 1), ('interest', 'Coffee', 2), ('interest', 'Movies', 3), ('interest', 'Travel', 4),
  ('interest', 'Cooking', 5), ('interest', 'Yoga', 6), ('interest', 'Live Music', 7), ('interest', 'Gaming', 8),
  ('relationship_goal', 'Long-term relationship', 1),
  ('relationship_goal', 'Long-term, open to short', 2),
  ('relationship_goal', 'Short-term, open to long', 3),
  ('relationship_goal', 'Short-term fun', 4),
  ('relationship_goal', 'New friends', 5),
  ('relationship_goal', 'Still figuring it out', 6),
  ('show_me', 'Women', 1), ('show_me', 'Men', 2), ('show_me', 'Everyone', 3);

update public.profile_options set description = d.description
from (values
  ('Long-term relationship', 'Looking for something serious'),
  ('Long-term, open to short', 'Open to where it goes'),
  ('Short-term, open to long', 'Keeping things casual for now'),
  ('Short-term fun', 'Just here for a good time'),
  ('New friends', 'Not looking for romance right now'),
  ('Still figuring it out', 'No labels yet, let''s see')
) as d(value, description)
where category = 'relationship_goal' and profile_options.value = d.value;

insert into public.profile_field_defs (field, label, kind, option_category, allow_custom, max_selected, sort_order) values
  ('gender', 'Gender', 'single', 'gender', false, null, 1),
  ('pronouns', 'Pronouns', 'multi', 'pronoun', true, 3, 2),
  ('sexual_orientation', 'Sexual orientation', 'multi', 'sexual_orientation', true, 5, 3),
  ('lifestyle_tags', 'Lifestyle', 'multi', 'lifestyle', false, 10, 4),
  ('languages', 'Languages', 'multi', 'language', true, 10, 5),
  ('interests', 'Interests', 'multi', 'interest', false, 5, 6),
  ('relationship_goal', 'Relationship goals', 'single', 'relationship_goal', false, null, 7);

-- Filters from Feed Settings (06i). "Any" is stored as the filter being absent.
-- Smoking and drinking filter on the lifestyle tags. Distance has no profile
-- column yet (the profile only stores a city name); see the open question in
-- the Build Plan.
insert into public.filter_definitions (key, label, control, profile_field, option_category, min_value, max_value, unit, sort_order) values
  ('show_me', 'Show me', 'segmented', 'gender', 'show_me', null, null, null, 1),
  ('age_range', 'Age range', 'range', 'birthday', null, 18, 99, 'years', 2),
  ('max_distance', 'Maximum distance', 'number', null, null, 1, 200, 'miles', 3),
  ('height_range', 'Height', 'range', 'height_cm', null, 90, 250, 'cm', 4),
  ('sexual_orientation', 'Sexual orientation', 'multi', 'sexual_orientation', 'sexual_orientation', null, null, null, 5),
  ('occupation', 'Occupation', 'multi', 'job_title', null, null, null, null, 6),
  ('smoking', 'Smoking', 'multi', 'lifestyle_tags', 'lifestyle', null, null, null, 7),
  ('drinking', 'Drinking', 'multi', 'lifestyle_tags', 'lifestyle', null, null, null, 8),
  ('relationship_goals', 'Relationship goals', 'multi', 'relationship_goal', 'relationship_goal', null, null, null, 9),
  ('interests', 'Interests', 'multi', 'interests', 'interest', null, null, null, 10);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text check (char_length(btrim(first_name)) between 1 and 50),
  birthday date,
  gender text,
  pronouns text[] not null default '{}',
  sexual_orientation text[] not null default '{}',
  height_cm smallint check (height_cm between 90 and 250),
  city text check (char_length(city) <= 100),
  job_title text check (char_length(job_title) <= 100),
  company text check (char_length(company) <= 100),
  school text check (char_length(school) <= 100),
  about_me text check (char_length(about_me) <= 500),
  lifestyle_tags text[] not null default '{}',
  languages text[] not null default '{}',
  interests text[] not null default '{}',
  relationship_goal text,
  allow_followers boolean not null default true,
  profile_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A user can read and edit only their own row. Everyone else's profile is
-- reachable only through server functions (the feed), never by table access.
-- Users can edit only the listed columns: never id, join date, completion
-- time, or anything else the server controls.
grant select on public.profiles to authenticated;
grant update (
  first_name, birthday, gender, pronouns, sexual_orientation, height_cm, city,
  job_title, company, school, about_me, lifestyle_tags, languages, interests,
  relationship_goal, allow_followers
) on public.profiles to authenticated;

create policy "users read their own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "users edit their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Minimum age, checked on the server whenever a birthday is saved.
create function private.enforce_min_age() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  years int;
begin
  if new.birthday is null then
    return new;
  end if;
  if new.birthday > current_date then
    raise exception 'Birthday cannot be in the future.' using errcode = 'check_violation';
  end if;
  years := private.age_in_years(new.birthday);
  if years > 120 then
    raise exception 'Please enter a valid birthday.' using errcode = 'check_violation';
  end if;
  if years < private.min_signup_age() then
    raise exception 'You must be at least % years old to use this app.', private.min_signup_age()
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

-- Answers must come from the configured options (or be short custom text where
-- allowed), and respect "choose up to N". Only values that are new in this
-- update are checked, so retiring an option never blocks unrelated edits.
create function private.validate_profile() returns trigger
language plpgsql set search_path = ''
as $$
declare
  d record;
  new_json jsonb := to_jsonb(new);
  old_json jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  new_vals text[];
  old_vals text[];
  v text;
begin
  for d in select * from public.profile_field_defs where active loop
    if d.kind = 'single' then
      new_vals := case when new_json ->> d.field is null then '{}' else array[new_json ->> d.field] end;
      old_vals := case when old_json ->> d.field is null then '{}' else array[old_json ->> d.field] end;
    else
      new_vals := case when jsonb_typeof(new_json -> d.field) = 'array'
        then array(select jsonb_array_elements_text(new_json -> d.field)) else '{}' end;
      old_vals := case when jsonb_typeof(old_json -> d.field) = 'array'
        then array(select jsonb_array_elements_text(old_json -> d.field)) else '{}' end;
    end if;

    if cardinality(new_vals) <> (select count(distinct x) from unnest(new_vals) as x) then
      raise exception '% contains duplicates.', d.label using errcode = 'check_violation';
    end if;
    if d.max_selected is not null and cardinality(new_vals) > d.max_selected then
      raise exception 'Choose up to % for %.', d.max_selected, d.label using errcode = 'check_violation';
    end if;

    foreach v in array new_vals loop
      continue when v = any (old_vals);
      if char_length(btrim(v)) = 0 or char_length(v) > 40 then
        raise exception '% entries must be 1 to 40 characters.', d.label using errcode = 'check_violation';
      end if;
      if not d.allow_custom and not exists (
        select 1 from public.profile_options o
        where o.category = d.option_category and o.value = v and o.active
      ) then
        raise exception '"%" is not an allowed choice for %.', v, d.label using errcode = 'check_violation';
      end if;
    end loop;
  end loop;

  -- Once a profile is finished, the must-have fields cannot be blanked out.
  if tg_op = 'UPDATE' and old.profile_completed_at is not null then
    if new.first_name is null or new.birthday is null or new.gender is null then
      raise exception 'First name, birthday and gender cannot be removed from a finished profile.'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_enforce_min_age
  before insert or update of birthday on public.profiles
  for each row execute function private.enforce_min_age();
create trigger profiles_validate
  before insert or update on public.profiles
  for each row execute function private.validate_profile();
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- profile_photos (the files live in the private "profile-photos" bucket)
-- ---------------------------------------------------------------------------
create table public.profile_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  position smallint not null check (position between 1 and 6),
  storage_path text not null,
  created_at timestamptz not null default now(),
  constraint profile_photos_position_unique unique (user_id, position) deferrable initially deferred,
  constraint profile_photos_path_in_own_folder check (storage_path like user_id::text || '/%')
);

alter table public.profile_photos enable row level security;
grant select, insert, delete on public.profile_photos to authenticated;
grant update (position) on public.profile_photos to authenticated;

create policy "users read their own photos" on public.profile_photos
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users add their own photos" on public.profile_photos
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "users reorder their own photos" on public.profile_photos
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users remove their own photos" on public.profile_photos
  for delete to authenticated using (user_id = (select auth.uid()));

-- A finished profile always keeps at least one photo. (Deleting the whole
-- account is fine: the profile row is already gone by then.)
create function private.keep_one_photo() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
       select 1 from public.profiles p
       where p.id = old.user_id and p.profile_completed_at is not null
     )
     and not exists (
       select 1 from public.profile_photos ph
       where ph.user_id = old.user_id and ph.id <> old.id
     ) then
    raise exception 'A profile needs at least one photo.' using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create trigger profile_photos_keep_one
  before delete on public.profile_photos
  for each row execute function private.keep_one_photo();

-- Private storage bucket. Only the owner can touch files in their own folder
-- ("<user id>/<file>"). Other people's photos will be served later through
-- server functions that hand out short-lived links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "users read their own photo files" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users upload their own photo files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users replace their own photo files" on storage.objects
  for update to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "users delete their own photo files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---------------------------------------------------------------------------
-- Finishing the profile ("Finish Setup" on screen 03)
-- ---------------------------------------------------------------------------
-- Required to finish: first name, birthday, gender, and at least one photo.
-- Everything else is optional.
create function public.complete_profile() returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  p public.profiles;
  missing text[] := '{}';
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  select * into p from public.profiles where id = me;
  if not found then
    raise exception 'No profile found.' using errcode = 'no_data_found';
  end if;
  if p.profile_completed_at is not null then
    return p.profile_completed_at;
  end if;
  if p.first_name is null then missing := array_append(missing, 'first name'); end if;
  if p.birthday is null then missing := array_append(missing, 'birthday'); end if;
  if p.gender is null then missing := array_append(missing, 'gender'); end if;
  if not exists (select 1 from public.profile_photos where user_id = me) then
    missing := array_append(missing, 'at least 1 photo');
  end if;
  if cardinality(missing) > 0 then
    raise exception 'Profile is not finished. Still needed: %.', array_to_string(missing, ', ')
      using errcode = 'check_violation';
  end if;
  update public.profiles set profile_completed_at = now() where id = me
    returning profile_completed_at into p.profile_completed_at;
  return p.profile_completed_at;
end;
$$;

revoke execute on function public.complete_profile() from public, anon;
grant execute on function public.complete_profile() to authenticated;

-- ---------------------------------------------------------------------------
-- filter_preferences (Feed Settings > Filters, 06i)
-- ---------------------------------------------------------------------------
create table public.filter_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.filter_preferences enable row level security;
grant select on public.filter_preferences to authenticated;
grant update (filters) on public.filter_preferences to authenticated;

create policy "users read their own filters" on public.filter_preferences
  for select to authenticated using (user_id = (select auth.uid()));
create policy "users edit their own filters" on public.filter_preferences
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Shape of each filter comes from filter_definitions, so adding a filter never
-- needs a code change here.
create function private.validate_filters() returns trigger
language plpgsql set search_path = ''
as $$
declare
  k text;
  val jsonb;
  d public.filter_definitions;
  lo numeric;
  hi numeric;
  item jsonb;
begin
  for k, val in select * from jsonb_each(new.filters) loop
    select * into d from public.filter_definitions where key = k and active;
    if not found then
      raise exception 'Unknown filter "%".', k using errcode = 'check_violation';
    end if;

    if d.control = 'segmented' then
      if jsonb_typeof(val) <> 'string' or not exists (
        select 1 from public.profile_options o
        where o.category = d.option_category and o.value = val #>> '{}' and o.active
      ) then
        raise exception 'Invalid choice for %.', d.label using errcode = 'check_violation';
      end if;

    elsif d.control = 'range' then
      if jsonb_typeof(val) <> 'object'
         or jsonb_typeof(val -> 'min') <> 'number' or jsonb_typeof(val -> 'max') <> 'number' then
        raise exception '% needs a min and a max number.', d.label using errcode = 'check_violation';
      end if;
      lo := (val ->> 'min')::numeric;
      hi := (val ->> 'max')::numeric;
      if lo > hi
         or (d.min_value is not null and lo < d.min_value)
         or (d.max_value is not null and hi > d.max_value) then
        raise exception '% is out of range.', d.label using errcode = 'check_violation';
      end if;

    elsif d.control = 'number' then
      if jsonb_typeof(val) <> 'number'
         or (d.min_value is not null and (val #>> '{}')::numeric < d.min_value)
         or (d.max_value is not null and (val #>> '{}')::numeric > d.max_value) then
        raise exception '% is out of range.', d.label using errcode = 'check_violation';
      end if;

    elsif d.control = 'multi' then
      if jsonb_typeof(val) <> 'array' or jsonb_array_length(val) > 25 then
        raise exception '% must be a list of up to 25 choices.', d.label using errcode = 'check_violation';
      end if;
      for item in select * from jsonb_array_elements(val) loop
        if jsonb_typeof(item) <> 'string'
           or char_length(btrim(item #>> '{}')) = 0
           or char_length(item #>> '{}') > 60 then
          raise exception '% choices must be text of 1 to 60 characters.', d.label using errcode = 'check_violation';
        end if;
      end loop;
    end if;
  end loop;
  return new;
end;
$$;

create trigger filter_preferences_validate
  before insert or update on public.filter_preferences
  for each row execute function private.validate_filters();
create trigger filter_preferences_touch_updated_at
  before update on public.filter_preferences
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- New account => empty profile and empty filter preferences
-- ---------------------------------------------------------------------------
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.filter_preferences (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();
