-- Phase 1 rules: accounts, profiles, photos, filters, and who can see what.
begin;
select plan(73);

-- Two test users. The sign-up trigger should give each an empty profile.
insert into auth.users (id, email, aud, role, instance_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'alice@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bob@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

select is((select count(*) from public.profiles where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002')), 2::bigint,
  'signing up creates an empty profile for each new account');
select is((select count(*) from public.filter_preferences where user_id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002')), 2::bigint,
  'signing up creates empty filter preferences');
select is(
  (select bool_and(push_enabled and email_enabled) from public.notification_preferences where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  true,
  'signing up turns push and email on for every notification type');
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
      first_name = 'Alex', gender = 'Woman',
      sexual_orientation = '{"Bisexual"}',
      interested_in = '{"Men","Women"}', interests = '{"Coffee","Hiking"}',
      relationship_goal = 'Long-term relationship', height_inches = 69, city = 'Brooklyn, NY',
      about_me = 'Hello'
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'a normal profile with allowed choices is accepted');
select throws_ok(
  $$update public.profiles set sexual_orientation = '{"Polysexual"}' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', '"Polysexual" is not an allowed choice for Sexual orientation.',
  'a custom sexual orientation is rejected');
select lives_ok(
  $$update public.profiles set sexual_orientation = '{"Lesbian"}' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'Lesbian is an allowed sexual orientation, and is not tied to gender or Interested in');
select throws_ok(
  $$update public.profiles set sexual_orientation = '{"Gay","Queer"}' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', 'Choose up to 1 for Sexual orientation.',
  'sexual orientation takes only one choice');
select is(
  (select array_agg(value order by sort_order) from public.profile_options where category = 'sexual_orientation'),
  array['Straight','Gay','Lesbian','Bisexual','Asexual','Demisexual','Pansexual','Queer','Questioning'],
  'sexual orientation choices are the nine designed ones');
select is(
  (select allow_custom from public.profile_field_defs where field = 'sexual_orientation'),
  false,
  'sexual orientation does not allow custom entries');
select throws_ok(
  $$update public.profiles set gender = 'Wizard' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', '"Wizard" is not an allowed choice for Gender.',
  'an unknown gender is rejected');
select throws_ok(
  $$update public.profiles set gender = 'More' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', '"More" is not an allowed choice for Gender.',
  'gender More is not an allowed choice');
select is(
  (select count(*) from public.profile_options where category = 'gender' and value = 'More'),
  0::bigint,
  'gender option More is not itself a stored choice');
select is(
  (select count(*) from public.profile_options where category = 'gender'),
  32::bigint,
  'gender has Woman, Man, and the 30 More choices');
select lives_ok(
  $$update public.profiles set gender = 'Two-Spirit' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'a gender from the More list is accepted');
select lives_ok(
  $$update public.profiles set gender = 'Woman' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'gender can go back to Woman');
select is(
  (select show_gender and show_orientation from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  true,
  'show gender and show orientation default to on');
select throws_ok(
  $$update public.profiles set relationship_goal = 'Marriage by Friday' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', '"Marriage by Friday" is not an allowed choice for Relationship goals.',
  'an unknown relationship goal is rejected');
select throws_ok(
  $$update public.profiles set interested_in = '{"Men","Women","Non-Binary","Men"}' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', 'Interested in contains duplicates.',
  'duplicate interested-in values are rejected');
select throws_ok(
  $$update public.profiles set interested_in = '{"Everyone"}' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', '"Everyone" is not an allowed choice for Interested in.',
  'an interested-in value outside the list is rejected');
select is(
  (select active from public.profile_field_defs where field = 'languages'),
  false,
  'languages is not collected on Build / Edit Profile');
select throws_ok(
  $$update public.profiles set interests = '{"Coffee","Coffee"}' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', 'Interests contains duplicates.',
  'duplicate interests are rejected');
select throws_ok(
  $$update public.profiles set interests = '{"Coffee","Hiking","Yoga","Travel","Wine","Tea"}' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', 'Choose up to 5 for Interests.',
  'more than 5 interests are rejected');
select throws_ok(
  $$update public.profiles set interests = '{"Dog lover"}' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  '23514', '"Dog lover" is not an allowed choice for Interests.',
  'an interest outside the list is rejected');
select lives_ok(
  $$update public.profiles set interests = '{"Coffee","Hiking","Yoga","Travel","Wine"}' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'exactly 5 interests are accepted');
select is(
  (select count(*) from public.profile_options where category = 'interest'),
  278::bigint,
  'interests has the 278 designed choices');
select is(
  (select active from public.profile_field_defs where field = 'lifestyle_tags'),
  false,
  'lifestyle tags are not collected on Build / Edit Profile');
select is(
  (select count(*) from public.filter_definitions where key in ('smoking', 'drinking') and active),
  0::bigint,
  'the Smoking and Drinking filters are gone');
select is(
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'feed_settings' and column_name = 'lifestyle_compatibility'),
  0::bigint,
  'the Lifestyle Compatibility ranking signal is gone');
select is(
  (select active from public.profile_field_defs where field = 'pronouns'),
  false,
  'pronouns is not collected on Build / Edit Profile');
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
select lives_ok(
  $$insert into public.profile_photos (user_id, position, storage_path)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 7, 'aaaaaaaa-0000-0000-0000-000000000001/7.jpg')$$,
  'a sixth gallery photo (position 7) is allowed alongside the avatar at position 1');
select throws_ok(
  $$insert into public.profile_photos (user_id, position, storage_path)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 8, 'aaaaaaaa-0000-0000-0000-000000000001/8.jpg')$$,
  '23514', null,
  'an eighth slot is rejected (avatar plus six gallery photos max)');
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
      "height_range": {"min": 60, "max": 76},
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
