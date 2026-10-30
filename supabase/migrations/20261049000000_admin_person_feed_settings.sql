-- Admins can read one person's Feed Settings (filters + ranking) on the People page.

create or replace function public.admin_get_person_feed_settings(p_user_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  filters jsonb := '{}'::jsonb;
  filters_updated timestamptz;
  shared_interests text := 'medium';
  specific_interests text[] := '{}';
  relationship_goals text := 'medium';
  distance text := 'medium';
begin
  perform private.require_admin();
  if p_user_id is null or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Person not found.' using errcode = 'no_data_found';
  end if;

  select coalesce(fp.filters, '{}'::jsonb), fp.updated_at
    into filters, filters_updated
  from public.filter_preferences fp
  where fp.user_id = p_user_id;

  select f.shared_interests, f.specific_interests, f.relationship_goals, f.distance
    into shared_interests, specific_interests, relationship_goals, distance
  from public.feed_settings f
  where f.user_id = p_user_id;

  return jsonb_build_object(
    'filters', filters,
    'filters_updated_at', filters_updated,
    'shared_interests', coalesce(shared_interests, 'medium'),
    'specific_interests', coalesce(specific_interests, '{}'::text[]),
    'relationship_goals', coalesce(relationship_goals, 'medium'),
    'distance', coalesce(distance, 'medium')
  );
end;
$$;

revoke all on function public.admin_get_person_feed_settings(uuid) from public;
grant execute on function public.admin_get_person_feed_settings(uuid) to authenticated;
