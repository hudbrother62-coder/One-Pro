alter table public.profiles add column if not exists username text;

create unique index if not exists profiles_username_unique
  on public.profiles (lower(username))
  where username is not null;

alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z0-9][a-z0-9._-]{2,31}$') not valid;

alter table public.profiles validate constraint profiles_username_format;

create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  requested_username text;
begin
  requested_username := lower(nullif(trim(new.raw_user_meta_data->>'username'), ''));

  insert into public.profiles(id, full_name, phone, username)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, new.phone, 'Pengguna One Pro'), '@', 1)),
    new.phone,
    requested_username
  )
  on conflict (id) do nothing;

  perform pg_advisory_xact_lock(hashtext('one_pro_first_super_admin'));
  if not exists (select 1 from public.memberships where role = 'super_admin' and is_active) then
    insert into public.memberships(user_id, role) values (new.id, 'super_admin');
  end if;
  return new;
end $$;

revoke execute on function private.handle_new_user() from public, anon;
grant execute on function private.handle_new_user() to authenticated;
