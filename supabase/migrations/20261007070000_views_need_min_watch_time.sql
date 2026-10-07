-- Phase 4 (continued): an answer view only counts once the viewer has had the
-- video for at least the admin-set minimum watch time.
--
-- The server cannot see the phone's screen, so it measures time itself: it notes
-- when it handed out the playback link, and the app reports "I have watched it"
-- afterwards. The report is accepted only if at least the minimum watch time
-- has passed since the link was issued, and the viewer is still allowed to see
-- the answer. The setting comes from app_settings, never hard-coded.

alter table public.answer_views rename column viewed_at to link_issued_at;
alter table public.answer_views add column counted_at timestamptz;

-- Handing out a link starts the clock (restarting it if they ask again before
-- the view has counted). It no longer counts as a view by itself.
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
    insert into public.answer_views (answer_id, viewer_id, link_issued_at)
      values (p_answer_id, me, clock_timestamp())
      on conflict (answer_id, viewer_id) do update set link_issued_at = clock_timestamp()
      where public.answer_views.counted_at is null;
  end if;
  return query select playback;
end;
$$;

-- The app calls this when the viewer has watched for the minimum watch time.
-- Returns true if the view now counts (or already did). Returns false, and
-- counts nothing, if it is too early, no link was issued, or the viewer may no
-- longer see the answer. The same answer by the same person counts only once.
create function public.record_answer_view(p_answer_id uuid) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  av public.answer_views;
  a public.answers;
  min_watch int;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  select * into av from public.answer_views where answer_id = p_answer_id and viewer_id = me for update;
  if not found then
    return false;
  end if;
  if av.counted_at is not null then
    return true;
  end if;

  select * into a from public.answers where id = p_answer_id;
  if not found or a.status <> 'live'
     or private.gate_state(me) <> 'open'
     or private.is_blocked_between(me, a.user_id) then
    return false;
  end if;

  select s.min_watch_seconds into min_watch from public.app_settings s;
  if clock_timestamp() - av.link_issued_at < make_interval(secs => min_watch) then
    return false;
  end if;

  update public.answer_views set counted_at = clock_timestamp() where answer_id = p_answer_id and viewer_id = me;
  return true;
end;
$$;
revoke execute on function public.record_answer_view(uuid) from public, anon;
grant execute on function public.record_answer_view(uuid) to authenticated;

create or replace function public.get_my_answers()
returns table (
  answer_id uuid, question_id uuid, question_date date, question_text text, caption_text text,
  duration_seconds numeric, status text, submitted_at timestamptz, view_count bigint
)
language sql stable security definer set search_path = ''
as $$
  select a.id, q.id, q.question_date, q.text, a.caption_text, a.duration_seconds, a.status, a.submitted_at,
         (select count(*) from public.answer_views av where av.answer_id = a.id and av.counted_at is not null)
  from public.answers a
  join public.questions q on q.id = a.question_id
  where a.user_id = (select auth.uid())
  order by q.question_date desc
$$;
