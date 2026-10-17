create function public.admin_list_website_launch_signups()
returns table (
  id uuid,
  email text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select s.id, s.email, s.created_at
    from public.website_launch_signups s
    order by s.created_at desc;
end;
$$;

revoke all on function public.admin_list_website_launch_signups() from public;
grant execute on function public.admin_list_website_launch_signups() to authenticated;
