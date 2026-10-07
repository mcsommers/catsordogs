-- Phase 3: video pipeline. One row per recording attempt ("videos"), the
-- server rules around it (daily attempt limit, length limit, caption editing),
-- and the functions the Edge Functions call as Mux reports progress.
--
-- The actual video files live at Mux, not in our database. We store Mux's ids,
-- the length, and the captions. Writing to this table is done only by the
-- functions below; the app can only read its own rows.

-- ---------------------------------------------------------------------------
-- New admin setting: how many recordings a user may start per day
-- ---------------------------------------------------------------------------
-- Each recording attempt costs video processing money, so this caps re-records
-- (and abuse). Counts every attempt, including ones that failed or were too long.
alter table public.app_settings
  add column max_recordings_per_day int not null default 10 check (max_recordings_per_day >= 1);
grant update (max_recordings_per_day) on public.app_settings to authenticated;

-- ---------------------------------------------------------------------------
-- videos
-- ---------------------------------------------------------------------------
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  question_id uuid not null references public.questions (id) on delete restrict,
  mux_upload_id text unique,
  mux_asset_id text unique,
  mux_playback_id text,
  status text not null default 'awaiting_upload'
    check (status in ('awaiting_upload', 'processing', 'ready', 'rejected', 'failed', 'cancelled')),
  reject_reason text,
  duration_seconds numeric(7, 3) check (duration_seconds is null or duration_seconds > 0),
  captions_status text not null default 'pending'
    check (captions_status in ('pending', 'ready', 'unavailable')),
  -- What speech-to-text produced: [{"start": 0, "end": 4.2, "text": "..."}]. Never edited.
  auto_caption_segments jsonb,
  -- What the viewer will see. Starts equal to the automatic version; the owner
  -- may edit the text (not the timing) until the answer is submitted.
  caption_segments jsonb,
  captions_edited_at timestamptz,
  -- Set when the recording becomes the user's answer (Phase 4). Locks captions.
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index videos_user_question_idx on public.videos (user_id, question_id);

alter table public.videos enable row level security;
grant select on public.videos to authenticated;
create policy "users read their own videos" on public.videos
  for select to authenticated using (user_id = (select auth.uid()));

create trigger videos_touch_updated_at
  before update on public.videos
  for each row execute function private.touch_updated_at();

-- A recording may be a little longer than the setting because of encoding
-- rounding (a "14 second" clip can measure 14.03s). Anything beyond this much
-- extra is rejected.
create function private.duration_tolerance_seconds() returns numeric
language sql immutable
as $$ select 1.0::numeric $$;

-- ---------------------------------------------------------------------------
-- Starting a recording (called by the signed-in user, through an Edge Function)
-- ---------------------------------------------------------------------------
create function public.request_video_upload()
returns table (video_id uuid, recording_length_seconds int)
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  q_id uuid;
  max_per_day int;
  length_seconds int;
  new_id uuid;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  -- One request at a time per user, so the daily limit cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended(me::text, 0));

  if not exists (select 1 from public.profiles p where p.id = me and p.profile_completed_at is not null) then
    raise exception 'Finish your profile before recording.' using errcode = 'check_violation';
  end if;

  select q.id into q_id from public.questions q where q.question_date = public.utc_today();
  if q_id is null then
    raise exception 'There is no question scheduled for today.' using errcode = 'no_data_found';
  end if;

  if exists (select 1 from public.videos v where v.user_id = me and v.question_id = q_id and v.submitted_at is not null) then
    raise exception 'You have already answered today''s question.' using errcode = 'check_violation';
  end if;

  select s.max_recordings_per_day, s.recording_length_seconds into max_per_day, length_seconds
  from public.app_settings s;

  if (select count(*) from public.videos v where v.user_id = me and v.question_id = q_id) >= max_per_day then
    raise exception 'You have reached today''s limit of % recordings.', max_per_day using errcode = 'check_violation';
  end if;

  insert into public.videos (user_id, question_id) values (me, q_id) returning id into new_id;
  return query select new_id, length_seconds;
end;
$$;
revoke execute on function public.request_video_upload() from public, anon;
grant execute on function public.request_video_upload() to authenticated;

-- ---------------------------------------------------------------------------
-- Progress reports from Mux (called only by our own Edge Functions, using the
-- server key. The app can never call these).
-- ---------------------------------------------------------------------------
create function public.video_attach_upload(p_video_id uuid, p_mux_upload_id text) returns void
language sql security definer set search_path = ''
as $$
  update public.videos set mux_upload_id = p_mux_upload_id
  where id = p_video_id and status = 'awaiting_upload' and mux_upload_id is null
$$;

create function public.video_upload_asset_created(p_video_id uuid, p_mux_asset_id text) returns void
language sql security definer set search_path = ''
as $$
  update public.videos set mux_asset_id = p_mux_asset_id, status = 'processing'
  where id = p_video_id and status = 'awaiting_upload'
$$;

-- The video is processed. This is where the recording-length rule is enforced:
-- if it is longer than the admin-set length (plus a small tolerance) it is
-- rejected. Returns the resulting status so the caller can delete a rejected
-- asset from Mux.
create function public.video_asset_ready(
  p_video_id uuid, p_mux_asset_id text, p_mux_playback_id text, p_duration_seconds numeric
) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v public.videos;
  max_seconds numeric;
begin
  select * into v from public.videos where id = p_video_id for update;
  if not found then
    return 'unknown';
  end if;
  if v.status in ('ready', 'rejected', 'failed', 'cancelled') then
    return v.status;   -- repeated or late event: nothing to do
  end if;

  select s.recording_length_seconds + private.duration_tolerance_seconds() into max_seconds
  from public.app_settings s;

  if p_duration_seconds is null or p_duration_seconds > max_seconds then
    update public.videos
      set status = 'rejected', reject_reason = 'too_long',
          mux_asset_id = p_mux_asset_id, duration_seconds = nullif(p_duration_seconds, 0),
          mux_playback_id = null
      where id = p_video_id;
    return 'rejected';
  end if;

  update public.videos
    set status = 'ready', mux_asset_id = p_mux_asset_id, mux_playback_id = p_mux_playback_id,
        duration_seconds = p_duration_seconds
    where id = p_video_id;
  return 'ready';
end;
$$;

create function public.video_mark_failed(p_video_id uuid, p_new_status text default 'failed') returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_new_status not in ('failed', 'cancelled') then
    raise exception 'Invalid status.' using errcode = 'check_violation';
  end if;
  update public.videos set status = p_new_status
  where id = p_video_id and status in ('awaiting_upload', 'processing');
end;
$$;

-- Captions arrived from speech-to-text. An empty list means no speech was
-- found ("unavailable"). Does nothing once the answer has been submitted.
create function public.video_set_captions(p_video_id uuid, p_segments jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  seg jsonb;
begin
  if jsonb_typeof(p_segments) is distinct from 'array' or jsonb_array_length(p_segments) > 300 then
    raise exception 'Captions must be a list of at most 300 segments.' using errcode = 'check_violation';
  end if;
  for seg in select * from jsonb_array_elements(p_segments) loop
    if jsonb_typeof(seg -> 'start') is distinct from 'number' or jsonb_typeof(seg -> 'end') is distinct from 'number'
       or jsonb_typeof(seg -> 'text') is distinct from 'string'
       or (seg ->> 'end')::numeric < (seg ->> 'start')::numeric
       or char_length(seg ->> 'text') > 500 then
      raise exception 'Each caption needs a start, an end, and text of up to 500 characters.' using errcode = 'check_violation';
    end if;
  end loop;

  update public.videos
    set auto_caption_segments = p_segments,
        caption_segments = p_segments,
        captions_edited_at = null,
        captions_status = case when jsonb_array_length(p_segments) = 0 then 'unavailable' else 'ready' end
    where id = p_video_id and submitted_at is null and status in ('processing', 'ready');
end;
$$;

revoke execute on function
  public.video_attach_upload(uuid, text),
  public.video_upload_asset_created(uuid, text),
  public.video_asset_ready(uuid, text, text, numeric),
  public.video_mark_failed(uuid, text),
  public.video_set_captions(uuid, jsonb)
from public, anon, authenticated;
grant execute on function
  public.video_attach_upload(uuid, text),
  public.video_upload_asset_created(uuid, text),
  public.video_asset_ready(uuid, text, text, numeric),
  public.video_mark_failed(uuid, text),
  public.video_set_captions(uuid, jsonb)
to service_role;

-- ---------------------------------------------------------------------------
-- Reviewing captions (called by the owner, "Edit Captions" 05b)
-- ---------------------------------------------------------------------------
-- The owner can change the TEXT of each caption, not its timing, and only
-- until the answer is submitted.
create function public.update_caption_segments(p_video_id uuid, p_texts text[]) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v public.videos;
  rebuilt jsonb;
begin
  select * into v from public.videos where id = p_video_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Video not found.' using errcode = 'no_data_found';
  end if;
  if v.submitted_at is not null then
    raise exception 'Captions cannot be edited after the answer is submitted.' using errcode = 'check_violation';
  end if;
  if v.status <> 'ready' or v.captions_status <> 'ready' then
    raise exception 'Captions are not ready to edit.' using errcode = 'check_violation';
  end if;
  if cardinality(p_texts) is distinct from jsonb_array_length(v.auto_caption_segments) then
    raise exception 'Send one text for each caption segment.' using errcode = 'check_violation';
  end if;
  if exists (select 1 from unnest(p_texts) t where t is null or char_length(t) > 500) then
    raise exception 'Each caption can be up to 500 characters.' using errcode = 'check_violation';
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object('start', (e.seg ->> 'start')::numeric, 'end', (e.seg ->> 'end')::numeric,
                              'text', btrim(p_texts[e.ord::int]))
           order by e.ord), '[]'::jsonb)
    into rebuilt
  from jsonb_array_elements(v.auto_caption_segments) with ordinality as e(seg, ord);

  update public.videos set caption_segments = rebuilt, captions_edited_at = now() where id = v.id;
  return rebuilt;
end;
$$;

create function public.reset_captions(p_video_id uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v public.videos;
begin
  select * into v from public.videos where id = p_video_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Video not found.' using errcode = 'no_data_found';
  end if;
  if v.submitted_at is not null then
    raise exception 'Captions cannot be edited after the answer is submitted.' using errcode = 'check_violation';
  end if;
  if v.status <> 'ready' or v.captions_status <> 'ready' then
    raise exception 'Captions are not ready to edit.' using errcode = 'check_violation';
  end if;
  update public.videos set caption_segments = auto_caption_segments, captions_edited_at = null where id = v.id;
  return v.auto_caption_segments;
end;
$$;

-- Playback: the owner can play their own finished recording (to review it
-- before submitting). Other people's playback is added with the feed in Phase 4,
-- behind the daily gate. The Edge Function turns the playback id into a
-- short-lived signed link.
create function public.get_my_video_for_playback(p_video_id uuid)
returns table (mux_playback_id text)
language sql stable security definer set search_path = ''
as $$
  select v.mux_playback_id from public.videos v
  where v.id = p_video_id and v.user_id = (select auth.uid())
    and v.status = 'ready' and v.mux_playback_id is not null
$$;

revoke execute on function
  public.update_caption_segments(uuid, text[]),
  public.reset_captions(uuid),
  public.get_my_video_for_playback(uuid)
from public, anon;
grant execute on function
  public.update_caption_segments(uuid, text[]),
  public.reset_captions(uuid),
  public.get_my_video_for_playback(uuid)
to authenticated;
