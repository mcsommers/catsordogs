-- A person can delete one of their own answers (screen 06ka / 06kb / 06kc).
--
-- The answer row goes away, so it leaves the profile, the feed, and the
-- streak (the streak is worked out from the answers that remain, so a deleted
-- day leaves a gap). Deleting today's answer closes the daily gate again.
--
-- The recording row is kept but emptied and marked cancelled. That matters for
-- two server rules: the daily recording cap still counts the deleted
-- recording (deleting never gives a recording back), and the same recording
-- can never be submitted again. The Mux file itself is deleted by the
-- delete-answer server function, which calls this and then asks Mux.
create function public.delete_my_answer(p_answer_id uuid) returns text
language plpgsql security definer set search_path = ''
as $$
declare
  me uuid := auth.uid();
  ans public.answers;
  asset text;
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(me::text, 1));

  select * into ans from public.answers a where a.id = p_answer_id and a.user_id = me for update;
  if not found then
    raise exception 'Answer not found.' using errcode = 'no_data_found';
  end if;

  select v.mux_asset_id into asset from public.videos v where v.id = ans.video_id;

  -- A flag review that is still open has nothing left to look at.
  update public.moderation_actions m
    set status = 'reviewed', reviewed_at = now(),
        snapshot = m.snapshot || jsonb_build_object('deleted_by_owner', true)
    where m.kind = 'answer' and m.answer_id = ans.id and m.status = 'open';
  update public.moderation_actions m
    set snapshot = m.snapshot || jsonb_build_object('deleted_by_owner', true)
    where m.kind = 'answer' and m.answer_id = ans.id;

  delete from public.answers where id = ans.id;

  update public.videos v
    set status = 'cancelled', submitted_at = null,
        mux_asset_id = null, mux_playback_id = null,
        auto_caption_segments = null, caption_segments = null
    where v.id = ans.video_id;

  return asset;
end;
$$;

revoke execute on function public.delete_my_answer(uuid) from public, anon;
grant execute on function public.delete_my_answer(uuid) to authenticated;
