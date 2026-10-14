-- New accounts: opt in to push and email for every notification type (stored explicitly on sign-up).

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  t text;
begin
  insert into public.profiles (id) values (new.id);
  insert into public.filter_preferences (user_id) values (new.id);
  insert into public.feed_settings (user_id) values (new.id);
  foreach t in array private.notification_types() loop
    insert into public.notification_preferences (user_id, type, push_enabled, email_enabled)
    values (new.id, t, true, true);
  end loop;
  return new;
end;
$$;
