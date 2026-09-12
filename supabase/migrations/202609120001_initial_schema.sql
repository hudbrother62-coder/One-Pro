create extension if not exists pgcrypto;

create type public.app_role as enum ('super_admin','admin_daerah','admin_desa','pj_kelompok','pengajar');
create type public.student_status as enum ('active','inactive','archived');
create type public.attendance_status as enum ('hadir','izin','alpha');
create type public.report_status as enum ('draft','processing','ready','failed');

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.villages (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(area_id, name)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  village_id uuid not null references public.villages(id) on delete restrict,
  name text not null,
  study_days smallint[] not null default '{}',
  reminder_time time not null default '20:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(village_id, name)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  avatar_path text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null,
  area_id uuid references public.areas(id) on delete cascade,
  village_id uuid references public.villages(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    (role = 'super_admin' and area_id is null and village_id is null and group_id is null) or
    (role = 'admin_daerah' and area_id is not null and village_id is null and group_id is null) or
    (role = 'admin_desa' and village_id is not null and group_id is null) or
    (role in ('pj_kelompok','pengajar') and group_id is not null)
  )
);

create unique index memberships_unique_scope on public.memberships (
  user_id, role, coalesce(area_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(village_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(group_id, '00000000-0000-0000-0000-000000000000')
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(group_id, name)
);

create table public.class_teachers (
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_lead boolean not null default false,
  primary key(class_id, user_id)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  full_name text not null,
  nickname text,
  birth_place text,
  birth_date date,
  address text,
  phone text,
  father_name text,
  mother_name text,
  father_phone text,
  mother_phone text,
  school_grade smallint check (school_grade between 0 and 6),
  photo_path text,
  show_photo boolean not null default false,
  status public.student_status not null default 'active',
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.class_enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  student_id uuid not null references public.students(id) on delete restrict,
  started_on date not null default current_date,
  ended_on date,
  created_at timestamptz not null default now()
);
create unique index one_active_class_per_student on public.class_enrollments(student_id) where ended_on is null;

create table public.schedules (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  teacher_id uuid references public.profiles(id) on delete set null,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  material_plan text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  session_date date not null,
  schedule_id uuid references public.schedules(id) on delete set null,
  notes text,
  submitted_by uuid references public.profiles(id) on delete set null,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(class_id, session_date)
);

create table public.attendance_records (
  session_id uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  status public.attendance_status not null,
  note text,
  recorded_at timestamptz not null default now(),
  primary key(session_id, student_id)
);

create table public.target_versions (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id) on delete restrict,
  title text not null,
  period_start date not null,
  period_end date not null,
  version integer not null default 1,
  source_file_path text,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(area_id, title, version)
);

create table public.targets (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.target_versions(id) on delete cascade,
  school_grade smallint not null check (school_grade between 0 and 6),
  code text,
  title text not null,
  description text,
  target_value numeric,
  target_unit text,
  sort_order integer not null default 0
);

create table public.daily_journals (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  journal_date date not null,
  responsible_user_id uuid references public.profiles(id) on delete set null,
  teacher_id uuid references public.profiles(id) on delete set null,
  started_at time,
  ended_at time,
  material text not null,
  achievement text,
  obstacles text,
  improvement_plan text,
  notes text,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(class_id, journal_date)
);

create table public.student_progress (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.daily_journals(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete restrict,
  target_id uuid references public.targets(id) on delete set null,
  progress_value numeric,
  progress_note text not null,
  created_at timestamptz not null default now(),
  unique(journal_id, student_id, target_id)
);

create table public.monthly_journals (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  month date not null check (extract(day from month) = 1),
  achievement_summary text,
  teacher_notes text,
  target_percentage numeric check (target_percentage between 0 and 100),
  generated_from timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(class_id, month)
);

create table public.meeting_minutes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  meeting_date date not null,
  period_month date not null,
  attendees text[] not null default '{}',
  material_achievement text,
  decisions text not null,
  follow_up text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.report_templates (
  id uuid primary key default gen_random_uuid(),
  class_id uuid references public.classes(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  file_path text not null,
  field_map jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete restrict,
  student_id uuid references public.students(id) on delete restrict,
  period_start date not null,
  period_end date not null,
  kind text not null check (kind in ('individual','class','monthly_journal')),
  status public.report_status not null default 'draft',
  template_id uuid references public.report_templates(id) on delete set null,
  summary jsonb not null default '{}',
  output_path text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id) on delete cascade,
  student_id uuid references public.students(id) on delete restrict,
  analysis_type text not null,
  model text not null,
  input_snapshot jsonb not null,
  output jsonb not null,
  source_hash text not null,
  created_at timestamptz not null default now()
);

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  area_id uuid references public.areas(id) on delete cascade,
  village_id uuid references public.villages(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  title text,
  is_announcement boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.chat_participants (
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  primary key(thread_id, user_id)
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  data jsonb not null default '{}',
  scheduled_for timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text,
  full_name text not null,
  role public.app_role not null,
  area_id uuid references public.areas(id) on delete cascade,
  village_id uuid references public.villages(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  scope jsonb not null default '{}',
  before_data jsonb,
  after_data jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

do $$ declare t text; begin
  foreach t in array array['areas','villages','groups','profiles','classes','students','schedules','attendance_sessions','daily_journals','monthly_journals','meeting_minutes','reports'] loop
    execute format('create trigger touch_%I before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

create or replace function public.is_super_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from memberships where user_id = auth.uid() and role = 'super_admin' and is_active)
$$;

create or replace function public.can_access_group(target_group uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists(
    select 1 from memberships m
    left join groups g on g.id = target_group
    left join villages v on v.id = g.village_id
    where m.user_id = auth.uid() and m.is_active and (
      m.group_id = target_group or m.village_id = g.village_id or m.area_id = v.area_id
    )
  )
$$;

create or replace function public.can_manage_group(target_group uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists(
    select 1 from memberships m
    left join groups g on g.id = target_group
    left join villages v on v.id = g.village_id
    where m.user_id = auth.uid() and m.is_active and m.role <> 'pengajar' and (
      m.group_id = target_group or m.village_id = g.village_id or m.area_id = v.area_id
    )
  )
$$;

create or replace function public.can_access_membership(target_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select target_user = auth.uid() or public.is_super_admin() or exists(
    select 1
    from memberships target
    left join groups tg on tg.id = target.group_id
    left join villages tv on tv.id = coalesce(target.village_id, tg.village_id)
    join memberships viewer on viewer.user_id = auth.uid() and viewer.is_active
    where target.user_id = target_user and target.is_active and (
      viewer.area_id = coalesce(target.area_id, tv.area_id) or
      viewer.village_id = coalesce(target.village_id, tg.village_id) or
      viewer.group_id = target.group_id
    )
  )
$$;

create or replace function public.can_manage_membership(target_role public.app_role, target_area uuid, target_village uuid, target_group uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin() or exists(
    select 1
    from memberships viewer
    left join groups tg on tg.id = target_group
    left join villages tv on tv.id = coalesce(target_village, tg.village_id)
    where viewer.user_id = auth.uid() and viewer.is_active and (
      (viewer.role = 'admin_daerah' and target_role in ('admin_desa','pj_kelompok','pengajar') and viewer.area_id = coalesce(target_area, tv.area_id)) or
      (viewer.role = 'admin_desa' and target_role in ('pj_kelompok','pengajar') and viewer.village_id = coalesce(target_village, tg.village_id)) or
      (viewer.role = 'pj_kelompok' and target_role = 'pengajar' and viewer.group_id = target_group)
    )
  )
$$;

create or replace function public.is_thread_participant(target_thread uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from chat_participants where thread_id = target_thread and user_id = auth.uid())
$$;

alter table public.areas enable row level security;
alter table public.villages enable row level security;
alter table public.groups enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.classes enable row level security;
alter table public.class_teachers enable row level security;
alter table public.students enable row level security;
alter table public.class_enrollments enable row level security;
alter table public.schedules enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.target_versions enable row level security;
alter table public.targets enable row level security;
alter table public.daily_journals enable row level security;
alter table public.student_progress enable row level security;
alter table public.monthly_journals enable row level security;
alter table public.meeting_minutes enable row level security;
alter table public.report_templates enable row level security;
alter table public.reports enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_scope_read on public.profiles for select using (public.can_access_membership(id));
create policy profiles_self_update on public.profiles for update using (id = auth.uid() or public.is_super_admin()) with check (id = auth.uid() or public.is_super_admin());
create policy memberships_scope_read on public.memberships for select using (public.can_access_membership(user_id));
create policy memberships_scope_insert on public.memberships for insert with check (public.can_manage_membership(role, area_id, village_id, group_id));
create policy memberships_scope_update on public.memberships for update using (public.can_manage_membership(role, area_id, village_id, group_id)) with check (public.can_manage_membership(role, area_id, village_id, group_id));
create policy memberships_scope_delete on public.memberships for delete using (public.can_manage_membership(role, area_id, village_id, group_id));
create policy notifications_own on public.notifications for select using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy audit_super_read on public.audit_logs for select using (public.is_super_admin());

create policy areas_member_read on public.areas for select using (
  public.is_super_admin() or exists(select 1 from memberships m where m.user_id=auth.uid() and m.is_active and (m.area_id=areas.id or m.village_id in (select id from villages where area_id=areas.id) or m.group_id in (select g.id from groups g join villages v on v.id=g.village_id where v.area_id=areas.id)))
);
create policy villages_member_read on public.villages for select using (
  public.is_super_admin() or exists(select 1 from memberships m where m.user_id=auth.uid() and m.is_active and (m.area_id=villages.area_id or m.village_id=villages.id or m.group_id in (select id from groups where village_id=villages.id)))
);
create policy groups_member_read on public.groups for select using (public.can_access_group(id));

create policy classes_scope_read on public.classes for select using (public.can_access_group(group_id));
create policy classes_scope_manage on public.classes for all using (public.can_manage_group(group_id)) with check (public.can_manage_group(group_id));
create policy students_scope_read on public.students for select using (public.can_access_group(group_id));
create policy students_scope_manage on public.students for all using (public.can_manage_group(group_id)) with check (public.can_manage_group(group_id));
create policy schedules_scope_read on public.schedules for select using (public.can_access_group((select group_id from classes where id=class_id)));
create policy schedules_scope_manage on public.schedules for all using (public.can_manage_group((select group_id from classes where id=class_id))) with check (public.can_manage_group((select group_id from classes where id=class_id)));
create policy attendance_sessions_scope_all on public.attendance_sessions for all using (public.can_access_group((select group_id from classes where id=class_id))) with check (public.can_access_group((select group_id from classes where id=class_id)));
create policy attendance_records_scope_all on public.attendance_records for all using (public.can_access_group((select c.group_id from attendance_sessions s join classes c on c.id=s.class_id where s.id=session_id))) with check (public.can_access_group((select c.group_id from attendance_sessions s join classes c on c.id=s.class_id where s.id=session_id)));
create policy daily_journals_scope_all on public.daily_journals for all using (public.can_access_group((select group_id from classes where id=class_id))) with check (public.can_access_group((select group_id from classes where id=class_id)));
create policy monthly_journals_scope_all on public.monthly_journals for all using (public.can_access_group((select group_id from classes where id=class_id))) with check (public.can_access_group((select group_id from classes where id=class_id)));
create policy student_progress_scope_all on public.student_progress for all using (public.can_access_group((select c.group_id from daily_journals j join classes c on c.id=j.class_id where j.id=journal_id))) with check (public.can_access_group((select c.group_id from daily_journals j join classes c on c.id=j.class_id where j.id=journal_id)));
create policy enrollments_scope_read on public.class_enrollments for select using (public.can_access_group((select group_id from classes where id=class_id)));
create policy enrollments_scope_manage on public.class_enrollments for all using (public.can_manage_group((select group_id from classes where id=class_id))) with check (public.can_manage_group((select group_id from classes where id=class_id)));
create policy class_teachers_scope_read on public.class_teachers for select using (public.can_access_group((select group_id from classes where id=class_id)));
create policy class_teachers_scope_manage on public.class_teachers for all using (public.can_manage_group((select group_id from classes where id=class_id))) with check (public.can_manage_group((select group_id from classes where id=class_id)));
create policy meeting_minutes_scope_all on public.meeting_minutes for all using (public.can_access_group(group_id)) with check (public.can_manage_group(group_id));
create policy templates_scope_read on public.report_templates for select using (owner_id=auth.uid() or public.is_super_admin() or public.can_access_group((select group_id from classes where id=class_id)));
create policy templates_owner_manage on public.report_templates for all using (owner_id=auth.uid() or public.is_super_admin()) with check (owner_id=auth.uid() or public.is_super_admin());
create policy reports_scope_all on public.reports for all using (public.can_access_group((select group_id from classes where id=class_id))) with check (public.can_access_group((select group_id from classes where id=class_id)));
create policy analyses_scope_read on public.ai_analyses for select using (public.is_super_admin() or exists(select 1 from reports r join classes c on c.id=r.class_id where r.id=report_id and public.can_access_group(c.group_id)));
create policy target_versions_read on public.target_versions for select using (public.is_super_admin() or exists(select 1 from memberships where user_id=auth.uid() and is_active));
create policy target_versions_manage on public.target_versions for all using (public.is_super_admin() or exists(select 1 from memberships where user_id=auth.uid() and role='admin_daerah' and area_id=target_versions.area_id and is_active)) with check (public.is_super_admin() or exists(select 1 from memberships where user_id=auth.uid() and role='admin_daerah' and area_id=target_versions.area_id and is_active));
create policy targets_read on public.targets for select using (exists(select 1 from target_versions v where v.id=version_id and (public.is_super_admin() or exists(select 1 from memberships where user_id=auth.uid() and is_active))));
create policy targets_manage on public.targets for all using (exists(select 1 from target_versions v where v.id=version_id and (public.is_super_admin() or exists(select 1 from memberships where user_id=auth.uid() and role='admin_daerah' and area_id=v.area_id and is_active)))) with check (exists(select 1 from target_versions v where v.id=version_id and (public.is_super_admin() or exists(select 1 from memberships where user_id=auth.uid() and role='admin_daerah' and area_id=v.area_id and is_active))));
create policy chat_threads_read on public.chat_threads for select using (public.is_super_admin() or public.is_thread_participant(id));
create policy chat_participants_read on public.chat_participants for select using (user_id=auth.uid() or public.is_super_admin() or public.is_thread_participant(thread_id));
create policy chat_messages_read on public.chat_messages for select using (public.is_super_admin() or public.is_thread_participant(thread_id));
create policy chat_messages_insert on public.chat_messages for insert with check (sender_id=auth.uid() and public.is_thread_participant(thread_id));
create policy invitations_manage on public.invitations for all using (public.is_super_admin() or invited_by=auth.uid()) with check (public.is_super_admin() or invited_by=auth.uid());

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into public.areas(name) values ('Malang Timur');
insert into public.villages(area_id,name)
select a.id, v.name from public.areas a cross join (values ('Mangliawan'),('Sawojajar'),('Cibuni')) v(name) where a.name='Malang Timur';
insert into public.groups(village_id,name)
select v.id, g.name from public.villages v join (values
('Mangliawan','Mangliawan Utara'),('Mangliawan','Mangliawan Selatan'),('Mangliawan','Sekarpuro'),('Mangliawan','Mendit'),('Mangliawan','Zam Zam'),
('Sawojajar','Sawojajar'),('Sawojajar','Muharto'),('Sawojajar','Kerinci'),('Sawojajar','Madyopuro'),('Sawojajar','Polehan'),
('Cibuni','Cibuni'),('Cibuni','Bengawan Solo'),('Cibuni','Mergosono'),('Cibuni','Pandanwangi'),('Cibuni','Plaosan'),('Cibuni','Klonjen')
) g(village_name,name) on g.village_name=v.name;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
('student-photos','student-photos',false,5242880,array['image/jpeg','image/png','image/webp']),
('report-templates','report-templates',false,20971520,array['application/vnd.openxmlformats-officedocument.presentationml.presentation']),
('generated-reports','generated-reports',false,52428800,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do nothing;

create policy storage_authenticated_read on storage.objects for select to authenticated using (bucket_id in ('student-photos','report-templates','generated-reports'));
create policy storage_owner_insert on storage.objects for insert to authenticated with check (bucket_id in ('student-photos','report-templates','generated-reports') and owner_id=auth.uid()::text);
create policy storage_owner_update on storage.objects for update to authenticated using (owner_id=auth.uid()::text or public.is_super_admin()) with check (owner_id=auth.uid()::text or public.is_super_admin());
create policy storage_owner_delete on storage.objects for delete to authenticated using (owner_id=auth.uid()::text or public.is_super_admin());
