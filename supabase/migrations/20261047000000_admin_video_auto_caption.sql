-- Admin video list also returns the original Mux speech-to-text text.
-- That copy is never edited. The caption column stays the text viewers see.
drop function if exists public.admin_list_videos();

create function public.admin_list_videos()
returns table (
  video_id uuid,
  user_id uuid,
  first_name text,
  email text,
  question_date date,
  question_text text,
  video_status text,
  duration_seconds numeric,
  answer_id uuid,
  answer_status text,
  caption_text text,
  auto_caption_text text,
  reject_reason text,
  created_at timestamptz,
  answer_submitted_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select v.id, v.user_id, p.first_name, u.email::text, q.question_date, q.text,
           v.status, v.duration_seconds, a.id, a.status,
           coalesce(
             nullif(a.caption_text, ''),
             (
               select nullif(string_agg(seg.value ->> 'text', ' ' order by seg.ordinality), '')
               from jsonb_array_elements(coalesce(v.caption_segments, '[]'::jsonb))
                 with ordinality as seg(value, ordinality)
               where coalesce(seg.value ->> 'text', '') <> ''
             )
           ),
           (
             select nullif(string_agg(seg.value ->> 'text', ' ' order by seg.ordinality), '')
             from jsonb_array_elements(coalesce(v.auto_caption_segments, '[]'::jsonb))
               with ordinality as seg(value, ordinality)
             where coalesce(seg.value ->> 'text', '') <> ''
           ),
           v.reject_reason, v.created_at, a.submitted_at
    from public.videos v
    join public.profiles p on p.id = v.user_id
    join auth.users u on u.id = v.user_id
    join public.questions q on q.id = v.question_id
    left join public.answers a on a.video_id = v.id
    order by v.created_at desc;
end;
$$;

revoke execute on function public.admin_list_videos() from public, anon;
grant execute on function public.admin_list_videos() to authenticated;
