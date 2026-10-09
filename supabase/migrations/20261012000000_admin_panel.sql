-- Phase 8: the internal admin website.
--
-- Admins (the same list as moderators) can see every profile, including photos,
-- and every video. Watching as an admin does not count as a view. Unhiding a
-- video puts that one video back and never touches the account. If tomorrow
-- (the next UTC day) has no question, each admin gets one email. Profile
-- question lists are editable by admins only.
--
-- Follower and nudge identities stay closed. This migration does not grant
-- anyone access to those tables.

-- ---------------------------------------------------------------------------
-- Profile question lists
-- ---------------------------------------------------------------------------
alter table public.profile_options
  add constraint profile_options_value_len check (char_length(btrim(value)) between 1 and 40),
  add constraint profile_options_description_len check (description is null or char_length(description) between 1 and 200);

grant insert (category, value, description, sort_order, active) on public.profile_options to authenticated;
grant update (description, sort_order, active) on public.profile_options to authenticated;
grant delete on public.profile_options to authenticated;
grant update (label, allow_custom, max_selected, sort_order, active) on public.profile_field_defs to authenticated;

create policy "admins add profile options" on public.profile_options
  for insert to authenticated with check (public.is_admin());
create policy "admins edit profile options" on public.profile_options
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins remove profile options" on public.profile_options
  for delete to authenticated using (public.is_admin());
create policy "admins edit profile questions" on public.profile_field_defs
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- A new choice has to belong to a list a profile question already uses
-- (or the "Show me" filter). Adding a whole new question still needs a
-- database column, which this screen cannot do.
create function private.guard_profile_option() returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    return old;
  end if;
  if new.category <> 'show_me' and not exists (
    select 1 from public.profile_field_defs f where f.option_category = new.category
  ) then
    raise exception 'That list is not used by a profile question.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profile_options_guard
  before insert or update or delete on public.profile_options
  for each row execute function private.guard_profile_option();

-- ---------------------------------------------------------------------------
-- Photos: an admin can read every file. Everyone else still sees only their
-- own folder, plus avatars (the first photo), which already have a policy.
-- ---------------------------------------------------------------------------
create policy "admins read every profile photo" on storage.objects
  for select to authenticated
  using (bucket_id = 'profile-photos' and public.is_admin());

-- ---------------------------------------------------------------------------
-- Who may call an admin function
-- ---------------------------------------------------------------------------
create function private.require_admin() returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if not public.is_admin() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
end;
$$;

-- Every profile, including people who have not finished setup and people who
-- were reported. Photos are paths; the website asks storage for a short-lived
-- link. Coordinates are included because an admin asked to see the whole
-- profile. Follower identities are not: only the count, which is already public.
create function public.admin_list_people()
returns table (
  id uuid, email text, first_name text, birthday date, age int, gender text,
  pronouns text[], sexual_orientation text[], height_cm smallint, city text,
  latitude double precision, longitude double precision, job_title text, company text,
  school text, about_me text, lifestyle_tags text[], languages text[], interests text[],
  relationship_goal text, allow_followers boolean, profile_completed_at timestamptz,
  time_zone text, created_at timestamptz, follower_count bigint, photos jsonb
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select p.id, u.email::text, p.first_name, p.birthday,
           case when p.birthday is null then null else private.age_in_years(p.birthday) end,
           p.gender, p.pronouns, p.sexual_orientation, p.height_cm, p.city,
           p.latitude, p.longitude, p.job_title, p.company, p.school, p.about_me,
           p.lifestyle_tags, p.languages, p.interests, p.relationship_goal,
           p.allow_followers, p.profile_completed_at, p.time_zone, p.created_at,
           (select count(*) from public.follows f where f.followed_id = p.id),
           coalesce((
             select jsonb_agg(jsonb_build_object('position', ph.position, 'storage_path', ph.storage_path) order by ph.position)
             from public.profile_photos ph where ph.user_id = p.id
           ), '[]'::jsonb)
    from public.profiles p
    join auth.users u on u.id = p.id
    order by p.created_at desc;
end;
$$;

-- Every recording, submitted or not, including ones flags have hidden.
create function public.admin_list_videos()
returns table (
  video_id uuid, user_id uuid, first_name text, question_date date, question_text text,
  video_status text, duration_seconds numeric, answer_id uuid, answer_status text,
  caption_text text, reject_reason text, created_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select v.id, v.user_id, p.first_name, q.question_date, q.text,
           v.status, v.duration_seconds, a.id, a.status, a.caption_text,
           v.reject_reason, v.created_at
    from public.videos v
    join public.profiles p on p.id = v.user_id
    join public.questions q on q.id = v.question_id
    left join public.answers a on a.video_id = v.id
    order by v.created_at desc;
end;
$$;

-- A playback id for any ready video. Does not write a view.
create function public.admin_get_video_for_playback(p_video_id uuid, p_answer_id uuid)
returns table (mux_playback_id text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_video_id is null and p_answer_id is null then
    raise exception 'Say which video.' using errcode = 'check_violation';
  end if;
  return query
    select v.mux_playback_id
    from public.videos v
    left join public.answers a on a.video_id = v.id
    where v.mux_playback_id is not null
      and v.status = 'ready'
      and (
        (p_video_id is not null and v.id = p_video_id)
        or (p_answer_id is not null and a.id = p_answer_id)
      )
    limit 1;
end;
$$;

-- Puts one hidden video back. If it is still waiting in the review queue,
-- that waiting item is closed as "put back". A video that was never hidden
-- is left alone. The account is not changed.
create function public.admin_unhide_answer(p_answer_id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  ans public.answers;
begin
  perform private.require_admin();
  select * into ans from public.answers where id = p_answer_id;
  if ans.id is null then
    raise exception 'Video not found.' using errcode = 'no_data_found';
  end if;
  if ans.status <> 'disabled' then
    raise exception 'That video is not hidden.' using errcode = 'check_violation';
  end if;
  update public.answers set status = 'live' where id = ans.id and status = 'disabled';
  update public.moderation_actions
    set status = 'restored', reviewed_at = now(), reviewed_by = auth.uid()
    where kind = 'answer' and answer_id = ans.id and status = 'open';
end;
$$;

revoke execute on function
  public.admin_list_people(), public.admin_list_videos(),
  public.admin_get_video_for_playback(uuid, uuid), public.admin_unhide_answer(uuid)
from public, anon;
grant execute on function
  public.admin_list_people(), public.admin_list_videos(),
  public.admin_get_video_for_playback(uuid, uuid), public.admin_unhide_answer(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Email every admin when the next UTC day has no question
-- ---------------------------------------------------------------------------
alter table public.notification_outbox drop constraint notification_outbox_type_check;
alter table public.notification_outbox add constraint notification_outbox_type_check
  check (type in ('daily_question', 'matches', 'messages', 'nudges', 'moderation', 'admin_alert'));
alter table public.notification_outbox drop constraint notification_outbox_kind_check;
alter table public.notification_outbox add constraint notification_outbox_kind_check
  check (kind in (
    'daily_question', 'nudge', 'generic', 'match_request', 'match', 'message',
    'answer_disabled', 'missing_question'
  ));

-- One email per admin per missing day. Running it again the same day adds
-- nobody. If a question is added before the email goes out, the worker drops it.
create function public.enqueue_missing_question_alerts(p_now timestamptz default now())
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  tomorrow date := ((p_now at time zone 'utc')::date + 1);
  added int;
begin
  if exists (select 1 from public.questions q where q.question_date = tomorrow) then
    return 0;
  end if;
  insert into public.notification_outbox (user_id, type, kind, title, body, data, dedupe_key)
  select a.user_id, 'admin_alert', 'missing_question',
         'No question scheduled for tomorrow',
         'There is no question scheduled for ' || to_char(tomorrow, 'FMMonth FMDD, YYYY')
           || ' (the next UTC day — the calendar day everyone in the app shares). '
           || 'Until you add one in the admin panel, people will have nothing to record that day.',
         jsonb_build_object('question_date', tomorrow),
         'missing_question:' || tomorrow::text
  from public.admin_users a
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics added = row_count;
  return added;
end;
$$;

revoke execute on function public.enqueue_missing_question_alerts(timestamptz) from public, anon, authenticated;
grant execute on function public.enqueue_missing_question_alerts(timestamptz) to service_role;

-- Same worker as every other email. An admin alert always goes by email,
-- never by push, and it cannot be turned off in notification settings.
-- A missing-question email is dropped if the question was added in time.
create or replace function public.claim_notifications(p_limit int default 50)
returns table (id uuid, user_id uuid, type text, title text, body text, data jsonb,
               email text, push_tokens text[], send_push boolean, send_email boolean)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  r public.notification_outbox;
  pref public.notification_preferences;
  push_on boolean;
  email_on boolean;
  tokens text[];
  addr text;
  n bigint;
  q uuid;
  out_title text;
  out_body text;
  skip_reason text;
  other_id uuid;
  other_name text;
  mid uuid;
  msg public.messages;
begin
  update public.notification_outbox set status = 'pending'
  where status = 'sending' and claimed_at < now() - interval '10 minutes';

  for r in
    select * from public.notification_outbox o
    where o.status = 'pending' and o.send_after <= now()
    order by o.send_after, o.created_at
    limit greatest(1, least(coalesce(p_limit, 50), 200))
    for update skip locked
  loop
    out_title := r.title;
    out_body := r.body;
    skip_reason := null;
    other_id := null;
    other_name := null;

    if r.kind = 'nudge' then
      q := (r.data ->> 'question_id')::uuid;
      if exists (select 1 from public.answers a where a.user_id = r.user_id and a.question_id = q) then
        skip_reason := 'already answered';
      else
        select count(*) into n from public.nudges where target_id = r.user_id and question_id = q;
        out_title := 'Your followers are waiting';
        out_body := case when n > 1 then n || ' followers want to hear your answer to today''s question.'
                         else 'A follower wants to hear your answer to today''s question.' end;
      end if;

    elsif r.kind = 'match_request' then
      other_id := (r.data ->> 'sender_id')::uuid;
      if not exists (
        select 1 from public.match_interests mi
        where mi.sender_id = other_id and mi.recipient_id = r.user_id and mi.status = 'pending'
      ) or private.is_blocked_between(r.user_id, other_id) then
        skip_reason := 'request no longer open';
      else
        select p.first_name into other_name from public.profiles p where p.id = other_id;
        out_title := 'New match request';
        out_body := coalesce(other_name, 'Someone') || ' wants to match with you.';
      end if;

    elsif r.kind = 'match' then
      mid := (r.data ->> 'match_id')::uuid;
      if not private.is_active_match_member(mid, r.user_id) then
        skip_reason := 'match ended';
      else
        select p.first_name into other_name
        from public.matches m join public.profiles p
          on p.id = case when m.user_a = r.user_id then m.user_b else m.user_a end
        where m.id = mid;
        out_title := 'It''s a match!';
        out_body := 'You and ' || coalesce(other_name, 'your match') || ' can chat now.';
      end if;

    elsif r.kind = 'message' then
      mid := (r.data ->> 'match_id')::uuid;
      select * into msg from public.messages mm where mm.id = (r.data ->> 'message_id')::uuid;
      if msg.id is null or not private.is_active_match_member(mid, r.user_id) then
        skip_reason := 'match ended';
      elsif exists (select 1 from public.conversation_mutes cm where cm.match_id = mid and cm.user_id = r.user_id) then
        skip_reason := 'conversation muted';
      else
        select p.first_name into other_name from public.profiles p where p.id = msg.sender_id;
        out_title := 'New message from ' || coalesce(other_name, 'your match');
        out_body := case when char_length(msg.body) > 140 then left(msg.body, 139) || '…' else msg.body end;
      end if;

    elsif r.kind = 'missing_question' then
      if exists (
        select 1 from public.questions qs
        where qs.question_date = (r.data ->> 'question_date')::date
      ) then
        skip_reason := 'question was added';
      end if;
    end if;

    if skip_reason is not null then
      update public.notification_outbox set status = 'skipped', last_error = skip_reason where id = r.id;
      continue;
    end if;

    select * into pref from public.notification_preferences np where np.user_id = r.user_id and np.type = r.type;
    push_on := coalesce(pref.push_enabled, private.notification_default(r.type, 'push'));
    email_on := coalesce(pref.email_enabled, private.notification_default(r.type, 'email'));

    -- Hidden-video notices cannot be turned off.
    if r.kind = 'answer_disabled' then
      push_on := true;
      email_on := true;
    end if;

    -- Operational mail for admins. Always email, never a phone notification,
    -- and notification settings do not apply.
    if r.type = 'admin_alert' then
      push_on := false;
      email_on := true;
    end if;

    if email_on and r.kind = 'message' and exists (
      select 1 from public.notification_outbox o
      where o.user_id = r.user_id and o.kind = 'message' and o.emailed and o.id <> r.id
        and o.data ->> 'match_id' = r.data ->> 'match_id'
        and o.claimed_at > now() - interval '1 hour'
    ) then
      email_on := false;
    end if;

    select array_agg(d.token) into tokens from public.device_tokens d where d.user_id = r.user_id;
    select u.email into addr from auth.users u where u.id = r.user_id;

    if not ((push_on and cardinality(coalesce(tokens, '{}')) > 0) or (email_on and addr is not null)) then
      update public.notification_outbox set status = 'skipped', last_error = 'no channel enabled' where id = r.id;
      continue;
    end if;

    update public.notification_outbox
      set status = 'sending', claimed_at = now(), attempts = attempts + 1, emailed = email_on and addr is not null
      where id = r.id;
    return query select r.id, r.user_id, r.type, out_title, out_body, r.data, addr,
                        coalesce(tokens, '{}'), push_on and cardinality(coalesce(tokens, '{}')) > 0, email_on and addr is not null;
  end loop;
end;
$$;

-- Once an hour. The first run after midnight UTC warns about the day that
-- just became "tomorrow", so there is almost a full day to add a question.
-- The dedupe key makes later runs the same day send nothing new.
select cron.schedule(
  'missing-question-alerts',
  '5 * * * *',
  'select public.enqueue_missing_question_alerts()'
);
