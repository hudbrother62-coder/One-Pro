create or replace function private.can_access_membership(target_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select target_user = auth.uid() or private.is_super_admin() or exists(
    select 1
    from memberships target
    left join groups tg on tg.id = target.group_id
    left join villages tv on tv.id = coalesce(target.village_id, tg.village_id)
    join memberships viewer on viewer.user_id = auth.uid() and viewer.is_active
    where target.user_id = target_user and (
      viewer.area_id = coalesce(target.area_id, tv.area_id) or
      viewer.village_id = coalesce(target.village_id, tg.village_id) or
      viewer.group_id = target.group_id
    )
  )
$$;

create or replace function private.protect_profile_account_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() = old.id and not private.is_super_admin() and
    (new.username is distinct from old.username or new.is_active is distinct from old.is_active)
  then
    raise exception 'Account fields must be managed by an authorized administrator';
  end if;
  return new;
end
$$;

drop trigger if exists protect_profile_account_fields on public.profiles;
create trigger protect_profile_account_fields
before update on public.profiles
for each row execute function private.protect_profile_account_fields();

revoke all on function private.protect_profile_account_fields() from public, anon, authenticated;
