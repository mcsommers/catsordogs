-- Phase A: the phone app needs to tell why a recording could not start, so it
-- can show the right screen (Daily Limit Reached 04f, No Question Today 04g)
-- instead of a generic error. Same rules as before; each refusal now carries a
-- fixed reason in the error's hint, and the daily limit carries the number in
-- its detail so the dialog can show the admin-set limit.
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
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  -- One request at a time per user, so the daily limit cannot be raced.
  perform pg_advisory_xact_lock(hashtextextended(me::text, 0));

  if not exists (select 1 from public.profiles p where p.id = me and p.profile_completed_at is not null) then
    raise exception 'Finish your profile before recording.'
      using errcode = 'check_violation', hint = 'profile_incomplete';
  end if;

  select q.id into q_id from public.questions q where q.question_date = public.utc_today();
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
revoke execute on function public.request_video_upload() from public, anon;
grant execute on function public.request_video_upload() to authenticated;
