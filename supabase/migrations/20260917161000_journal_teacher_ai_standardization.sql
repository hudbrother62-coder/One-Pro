alter table public.daily_journals
  add column if not exists rubric_version text not null default 'one-pro-journal-v1',
  add column if not exists session_assessment jsonb not null default '{}'::jsonb;

alter table public.student_progress
  add column if not exists rubric_version text not null default 'one-pro-journal-v1',
  add column if not exists assessment jsonb not null default '{}'::jsonb,
  add column if not exists follow_up text,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  if not exists (select 1 from pg_constraint where conname='daily_journals_session_assessment_object') then
    alter table public.daily_journals add constraint daily_journals_session_assessment_object check (jsonb_typeof(session_assessment)='object');
  end if;
  if not exists (select 1 from pg_constraint where conname='student_progress_assessment_object') then
    alter table public.student_progress add constraint student_progress_assessment_object check (jsonb_typeof(assessment)='object');
  end if;
  if not exists (select 1 from pg_constraint where conname='student_progress_value_range') then
    alter table public.student_progress add constraint student_progress_value_range check (progress_value is null or (progress_value >= 0 and progress_value <= 100));
  end if;
end $$;

create index if not exists class_teachers_user_idx on public.class_teachers(user_id);
create index if not exists daily_journals_class_date_idx on public.daily_journals(class_id,journal_date desc);
create index if not exists student_progress_student_idx on public.student_progress(student_id,created_at desc);
create unique index if not exists ai_analyses_source_dedupe_idx on public.ai_analyses(report_id,analysis_type,source_hash);

create or replace function private.validate_class_teacher_assignment() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  target_group uuid;
  assignment_count integer;
begin
  select c.group_id into target_group from public.classes c where c.id=new.class_id;
  if target_group is null then raise exception 'Kelas tidak ditemukan.'; end if;
  if not exists (
    select 1 from public.memberships m
    where m.user_id=new.user_id and m.group_id=target_group and m.is_active
      and m.role in ('pengajar','pj_kelompok')
  ) then
    raise exception 'Pengajar harus memiliki akses aktif pada kelompok kelas tersebut.';
  end if;
  select count(*) into assignment_count from public.class_teachers ct
    where ct.user_id=new.user_id and ct.class_id<>new.class_id;
  if assignment_count >= 2 then raise exception 'Setiap pengajar maksimal memegang 2 kelas.'; end if;
  return new;
end $$;

drop trigger if exists validate_class_teacher_assignment on public.class_teachers;
create trigger validate_class_teacher_assignment
before insert or update on public.class_teachers
for each row execute function private.validate_class_teacher_assignment();

create or replace function private.can_journal_class(target_class uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.classes c
    where c.id=target_class and (
      private.can_manage_group(c.group_id)
      or exists(select 1 from public.class_teachers ct where ct.class_id=c.id and ct.user_id=auth.uid())
    )
  )
$$;

create or replace function public.set_teacher_classes(p_user_id uuid,p_class_ids uuid[]) returns void
language plpgsql security invoker set search_path='' as $$
declare
  target_group uuid;
  requested_count integer := coalesce(cardinality(p_class_ids),0);
begin
  if auth.uid() is null then raise exception 'Silakan masuk kembali.'; end if;
  if requested_count > 2 then raise exception 'Setiap pengajar maksimal memegang 2 kelas.'; end if;

  select m.group_id into target_group
  from public.memberships m
  where m.user_id=p_user_id and m.is_active and m.role in ('pengajar','pj_kelompok') and m.group_id is not null
  order by case when m.role='pengajar' then 0 else 1 end
  limit 1;
  if target_group is null then raise exception 'Akun pengajar tidak memiliki kelompok aktif.'; end if;
  if not private.can_manage_group(target_group) then raise exception 'Anda tidak memiliki akses mengatur pengajar kelompok ini.'; end if;

  if exists(
    select 1 from unnest(coalesce(p_class_ids,'{}'::uuid[])) requested(id)
    left join public.classes c on c.id=requested.id
    where c.id is null or c.group_id<>target_group or not c.is_active
  ) then raise exception 'Pilihan kelas tidak valid atau berasal dari kelompok lain.'; end if;

  delete from public.class_teachers ct
  using public.classes c
  where ct.class_id=c.id and ct.user_id=p_user_id and c.group_id=target_group;

  insert into public.class_teachers(class_id,user_id,is_lead)
  select id,p_user_id,true from unnest(coalesce(p_class_ids,'{}'::uuid[])) as id;
end $$;
revoke all on function public.set_teacher_classes(uuid,uuid[]) from public,anon;
grant execute on function public.set_teacher_classes(uuid,uuid[]) to authenticated;

drop policy if exists daily_journals_scope_all on public.daily_journals;
create policy daily_journals_assigned_scope on public.daily_journals for all to authenticated
using (private.can_journal_class(class_id))
with check (private.can_journal_class(class_id));

drop policy if exists student_progress_scope_all on public.student_progress;
create policy student_progress_assigned_scope on public.student_progress for all to authenticated
using (private.can_journal_class((select j.class_id from public.daily_journals j where j.id=student_progress.journal_id)))
with check (private.can_journal_class((select j.class_id from public.daily_journals j where j.id=student_progress.journal_id)));

drop trigger if exists touch_student_progress on public.student_progress;
create trigger touch_student_progress before update on public.student_progress
for each row execute function public.touch_updated_at();