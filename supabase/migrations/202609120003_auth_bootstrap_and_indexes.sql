create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name, phone)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, new.phone, 'Pengguna One Pro'), '@', 1)),
    new.phone
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

create index if not exists idx_class_teachers_user_id on public.class_teachers(user_id);
create index if not exists idx_attendance_records_student_id on public.attendance_records(student_id);
create index if not exists idx_student_progress_student_id on public.student_progress(student_id);
create index if not exists idx_student_progress_target_id on public.student_progress(target_id);
create index if not exists idx_chat_participants_user_id on public.chat_participants(user_id);
