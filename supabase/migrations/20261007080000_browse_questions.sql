-- Phase 4 (addition): Browse Questions and question search.
--
-- One function serves both the Browse Questions list (06c) and the live
-- autosuggest while typing (06d): with no search text it lists past questions
-- newest first; with search text it lists only questions containing every
-- typed word (ignoring case). The app asks for a small page for autosuggest.
-- Selecting a question opens that day's feed with get_feed(p_date => question_date).
--
-- Behind the daily gate, like the feed itself. Only today's and earlier
-- questions are ever returned (the calendar ahead is for admins). The response
-- count is the number of live answers to that question.
create function public.browse_questions(p_query text default null, p_limit int default 30, p_offset int default 0)
returns table (question_id uuid, question_date date, question_text text, response_count bigint, is_today boolean, total_count bigint)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  me uuid := auth.uid();
  lim int := least(greatest(coalesce(p_limit, 30), 1), 100);
  off int := greatest(coalesce(p_offset, 0), 0);
  terms text[];
begin
  if me is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if private.gate_state(me) <> 'open' then
    return;
  end if;

  -- up to 5 words; % _ and \ are matched literally
  terms := array(
    select '%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%'
    from regexp_split_to_table(left(btrim(coalesce(p_query, '')), 100), '\s+') as w
    where w <> ''
    limit 5
  );

  return query
  select q.id, q.question_date, q.text,
         (select count(*) from public.answers a where a.question_id = q.id and a.status = 'live'),
         q.question_date = public.utc_today(),
         count(*) over ()
  from public.questions q
  where q.question_date <= public.utc_today()
    and not exists (select 1 from unnest(terms) t where q.text not ilike t)
  order by q.question_date desc
  offset off limit lim;
end;
$$;
revoke execute on function public.browse_questions(text, int, int) from public, anon;
grant execute on function public.browse_questions(text, int, int) to authenticated;
