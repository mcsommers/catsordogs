-- How many people answered a question, for the admin calendar.
-- One row per person (answers are unique per person and question). A hidden
-- video still counts: the person did answer. Upcoming days are omitted.
create function public.admin_question_answer_counts()
returns table (question_id uuid, answer_count bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select q.id, count(a.id)
    from public.questions q
    left join public.answers a
      on a.question_id = q.id and a.status in ('live', 'disabled')
    where q.question_date <= public.utc_today()
    group by q.id;
end;
$$;

revoke execute on function public.admin_question_answer_counts() from public, anon;
grant execute on function public.admin_question_answer_counts() to authenticated;
