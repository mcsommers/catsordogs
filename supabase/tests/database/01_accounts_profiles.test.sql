-- Phase 1 rules: accounts, profiles, photos, filters, and who can see what.
begin;
select plan(52);

-- Two test users. The sign-up trigger should give each an empty profile.
insert into auth.users (id, email, aud, role, instance_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

select is((select count(*) from public.profiles where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002')), 2::bigint,
  'signing up creates an empty profile for each new account');
select is((select count(*) from public.filter_preferences where user_id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002')), 2::bigint,
  'signing up creates empty filter preferences');
select is((select profile_completed_at from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'), null,
  'a new profile is not finished');

-- ---------------------------------------------------------------------------
-- Minimum age (enforced by the database, not the app)
-- ---------------------------------------------------------------------------
select throws_ok(
  format($$update public.profiles set birthday = %L where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, (current_date - interval '17 years')::date),
  '23514', 'You must be at least 18 years old to use this app.',
  'a 17-year-old birthday is rejected');
select throws_ok(
  format($$update public.profiles set birthday = %L where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, (current_date - interval '18 years')::date + 1),
  '23514', 'You must be at least 18 years old to use this app.',
  'someone turning 18 tomorrow is rejected');
select lives_ok(
  format($$update public.profiles set birthday = %L where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, (current_date - interval '18 years')::date),
  'someone who turns 18 today is accepted');
select throws_ok(
  format($$update public.profiles set birthday = %L where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, current_date + 1),
  '23514', 'Birthday cannot be in the future.',
  'a future birthday is rejected');
select throws_ok(
  $$update public.profiles set birthday = '1800-01-01' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', 'Please enter a valid birthday.',
  'an impossible birthday is rejected');

-- ---------------------------------------------------------------------------
-- Profile answers must come from the configured options
-- ---------------------------------------------------------------------------
select lives_ok(
  $$update public.profiles set
      first_name = 'Alex', gender = 'Woman', pronouns = '{"She/her","Xe/xem"}',
      sexual_orientation = '{"Bisexual","Pansexual"}', languages = '{"English","Klingon"}',
      interests = '{"Hiking","Coffee","Movies"}', lifestyle_tags = '{"Dog lover"}',
      relationship_goal = 'Long-term relationship', height_cm = 175, city = 'Brooklyn, NY',
      about_me = 'Hello'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'a normal profile (with custom pronouns, orientation and language) is accepted');
select throws_ok(
  $$update public.profiles set gender = 'Wizard' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', '"Wizard" is not an allowed choice for Gender.',
  'an unknown gender is rejected');
select throws_ok(
  $$update public.profiles set relationship_goal = 'Marriage by Friday' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', '"Marriage by Friday" is not an allowed choice for Relationship goals.',
  'an unknown relationship goal is rejected');
select throws_ok(
  $$update public.profiles set interests = '{"Hiking","Coffee","Movies","Travel","Cooking","Yoga"}' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', 'Choose up to 5 for Interests.',
  'more than 5 interests is rejected');
select throws_ok(
  $$update public.profiles set interests = '{"Skydiving"}' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', '"Skydiving" is not an allowed choice for Interests.',
  'an interest outside the list is rejected (interests do not allow custom entries)');
select throws_ok(
  $$update public.profiles set lifestyle_tags = '{"Dog lover","Dog lover"}' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', 'Lifestyle contains duplicates.',
  'duplicate tags are rejected');
select throws_ok(
  $$update public.profiles set pronouns = '{"This is a ridiculously long pronoun that goes on and on"}' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', 'Pronouns entries must be 1 to 40 characters.',
  'an over-long custom entry is rejected');
select throws_ok(
  format($$update public.profiles set about_me = %L where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, repeat('x', 501)),
  '23514', null,
  'About Me over 500 characters is rejected');
select lives_ok(
  format($$update public.profiles set about_me = %L where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, repeat('x', 500)),
  'About Me of exactly 500 characters is accepted');

-- ---------------------------------------------------------------------------
-- Photos and finishing the profile (acting as Alice, a signed-in app user)
-- ---------------------------------------------------------------------------
insert into public.profile_photos (user_id, position, storage_path)
  values ('bbbbbbbb-0000-0000-0000-000000000002', 1, 'bbbbbbbb-0000-0000-0000-000000000002/1.jpg');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$update public.profiles set birthday = birthday where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'a signed-in user (not just an admin) can save their birthday');
select throws_ok(
  $$select public.complete_profile()$$,
  '23514', 'Profile is not finished. Still needed: at least 1 photo.',
  'a profile without a photo cannot be finished');
select lives_ok(
  $$insert into public.profile_photos (user_id, position, storage_path)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 1, 'aaaaaaaa-0000-0000-0000-000000000001/1.jpg')$$,
  'a user can add their own photo');
select throws_ok(
  $$insert into public.profile_photos (user_id, position, storage_path)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 2, 'bbbbbbbb-0000-0000-0000-000000000002/sneaky.jpg')$$,
  '23514', null,
  'a photo path must be inside the owner''s own folder');
select throws_ok(
  $$insert into public.profile_photos (user_id, position, storage_path)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 7, 'aaaaaaaa-0000-0000-0000-000000000001/7.jpg')$$,
  '23514', null,
  'a seventh photo is rejected (up to 6)');
select throws_ok(
  $$insert into public.profile_photos (user_id, position, storage_path)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 2, 'bbbbbbbb-0000-0000-0000-000000000002/2.jpg')$$,
  '42501', null,
  'a user cannot add photos to someone else''s profile');

select isnt(public.complete_profile(), null, 'a profile with the required fields and a photo can be finished');
select is(
  (select profile_completed_at from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  public.complete_profile(),
  'finishing twice is harmless and keeps the original time');

select throws_ok(
  $$delete from public.profile_photos where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', 'A profile needs at least one photo.',
  'the last photo of a finished profile cannot be deleted');
select lives_ok(
  $$insert into public.profile_photos (user_id, position, storage_path)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 2, 'aaaaaaaa-0000-0000-0000-000000000001/2.jpg')$$,
  'a second photo can be added');
select lives_ok(
  $$delete from public.profile_photos where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and position = 1$$,
  'a photo can be deleted while another remains');
select throws_ok(
  $$update public.profiles set first_name = null where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', 'First name, birthday and gender cannot be removed from a finished profile.',
  'a finished profile keeps its first name, birthday and gender');

-- ---------------------------------------------------------------------------
-- Who can see and change what
-- ---------------------------------------------------------------------------
select throws_ok(
  $$update public.profiles set profile_completed_at = null where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '42501', null,
  'a user cannot edit their own completion time directly');
select throws_ok(
  $$update public.profiles set created_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '42501', null,
  'a user cannot edit their own join date');
select throws_ok(
  $$insert into public.profiles (id) values ('cccccccc-0000-0000-0000-000000000003')$$,
  '42501', null,
  'a user cannot create profile rows');
select throws_ok(
  $$delete from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '42501', null,
  'a user cannot delete a profile row directly');

select is((select count(*) from public.profiles), 1::bigint, 'a user can read only their own profile row');
select is((select count(*) from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0::bigint,
  'another user''s profile is invisible');
select is_empty(
  $$update public.profiles set first_name = 'Hacked' where id = 'bbbbbbbb-0000-0000-0000-000000000002' returning 1$$,
  'editing another user''s profile changes nothing');
select is((select count(*) from public.profile_photos), 1::bigint, 'a user sees only their own photos');
select is((select count(*) from public.filter_preferences), 1::bigint, 'a user sees only their own filter preferences');

-- Filter preferences
select lives_ok(
  $$update public.filter_preferences set filters = '{
      "show_me": "Women",
      "age_range": {"min": 24, "max": 35},
      "max_distance": 25,
      "height_range": {"min": 152, "max": 193},
      "interests": ["Hiking", "Coffee"],
      "occupation": ["Product Designer"]
    }' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'valid filters are accepted');
select throws_ok(
  $$update public.filter_preferences set filters = '{"favorite_color": "blue"}' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', 'Unknown filter "favorite_color".',
  'an unknown filter is rejected');
select throws_ok(
  $$update public.filter_preferences set filters = '{"age_range": {"min": 40, "max": 30}}' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', 'Age range is out of range.',
  'a backwards range is rejected');
select throws_ok(
  $$update public.filter_preferences set filters = '{"age_range": {"min": 12, "max": 30}}' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', 'Age range is out of range.',
  'an age filter below the minimum age is rejected');
select throws_ok(
  $$update public.filter_preferences set filters = '{"max_distance": 5000}' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', 'Maximum distance is out of range.',
  'a huge distance is rejected');
select throws_ok(
  $$update public.filter_preferences set filters = '{"show_me": "Aliens"}' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', 'Invalid choice for Show me.',
  'an invalid "Show me" choice is rejected');
select throws_ok(
  $$update public.filter_preferences set filters = '{"interests": "Hiking"}' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', 'Interests must be a list of up to 25 choices.',
  'a list filter that is not a list is rejected');
select is_empty(
  $$update public.filter_preferences set filters = '{}' where user_id = 'bbbbbbbb-0000-0000-0000-000000000002' returning 1$$,
  'editing another user''s filters changes nothing');

select cmp_ok((select count(*) from public.profile_options), '>', 0::bigint, 'signed-in users can read the profile option lists');

-- ---------------------------------------------------------------------------
-- Signed-out visitors (the anon role) get nothing
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select throws_ok($$select * from public.profiles$$, '42501', null, 'signed-out visitors cannot read profiles');
select throws_ok($$select * from public.profile_options$$, '42501', null, 'signed-out visitors cannot read option lists');
select throws_ok($$select public.complete_profile()$$, '42501', null, 'signed-out visitors cannot call complete_profile');
reset role;

-- ---------------------------------------------------------------------------
-- Deleting an account removes everything that belongs to it
-- ---------------------------------------------------------------------------
select lives_ok(
  $$delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'an account with a finished profile and photos can be deleted');
select is(
  (select count(*) from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001')
  + (select count(*) from public.profile_photos where user_id = 'aaaaaaaa-0000-0000-0000-000000000001')
  + (select count(*) from public.filter_preferences where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  0::bigint,
  'deleting an account removes its profile, photos and filter preferences');

select * from finish();
rollback;
