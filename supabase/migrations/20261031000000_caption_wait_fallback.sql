-- Caption wait fallback: owner can stop waiting for Mux auto-captions after the app
-- timeout. Late webhook events must not overwrite a fallback or edited captions.

create or replace function public.video_set_captions(p_video_id uuid, p_segments jsonb) returns void
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
    where id = p_video_id
      and submitted_at is null
      and status in ('processing', 'ready')
      and captions_status = 'pending';
end;
$$;

-- Owner gave up waiting for auto-captions; use a single placeholder segment.
create function public.abandon_pending_captions(p_video_id uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v public.videos;
  span numeric;
  placeholder jsonb;
begin
  select * into v from public.videos where id = p_video_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Video not found.' using errcode = 'no_data_found';
  end if;
  if v.submitted_at is not null then
    raise exception 'Captions cannot be edited after the answer is submitted.' using errcode = 'check_violation';
  end if;
  if v.status <> 'ready' then
    raise exception 'That recording is not ready yet.' using errcode = 'check_violation';
  end if;
  if v.captions_status <> 'pending' then
    return coalesce(v.caption_segments, '[]'::jsonb);
  end if;

  span := greatest(coalesce(v.duration_seconds, 1)::numeric, 0.1);
  placeholder := jsonb_build_array(jsonb_build_object('start', 0, 'end', span, 'text', 'No caption.'));

  update public.videos
    set auto_caption_segments = placeholder,
        caption_segments = placeholder,
        captions_edited_at = null,
        captions_status = 'ready'
    where id = v.id;

  return placeholder;
end;
$$;

revoke execute on function public.abandon_pending_captions(uuid) from public, anon;
grant execute on function public.abandon_pending_captions(uuid) to authenticated;
