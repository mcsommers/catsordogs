-- Admins can make any existing account an admin, and remove admin access from
-- another admin, from the People page of the admin website.
-- The app and the website still cannot read or write admin_users directly:
-- only these server functions touch it, and only for a signed-in admin.
-- Rules enforced here: nobody can make themselves an admin (only an existing
-- admin can add one), and nobody can remove their own admin access, so the
-- site can never be left without an admin.

create function public.admin_list_admin_ids()
returns setof uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  return query select a.user_id from public.admin_users a;
end;
$$;

create function public.admin_set_admin(p_user_id uuid, p_make_admin boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_user_id is null or p_make_admin is null
     or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Person not found.' using errcode = 'no_data_found';
  end if;
  if p_make_admin then
    insert into public.admin_users (user_id) values (p_user_id)
    on conflict (user_id) do nothing;
  else
    if p_user_id = auth.uid() then
      raise exception 'You cannot remove your own admin access.' using errcode = '42501';
    end if;
    delete from public.admin_users where user_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.admin_list_admin_ids() from public, anon;
revoke all on function public.admin_set_admin(uuid, boolean) from public, anon;
grant execute on function public.admin_list_admin_ids() to authenticated;
grant execute on function public.admin_set_admin(uuid, boolean) to authenticated;
