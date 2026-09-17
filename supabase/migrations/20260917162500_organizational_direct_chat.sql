create table if not exists public.org_conversations (
  id uuid primary key default gen_random_uuid(),
  scope_a_type text not null check (scope_a_type in ('area','village','group')),
  scope_a_id uuid not null,
  scope_b_type text not null check (scope_b_type in ('area','village','group')),
  scope_b_id uuid not null,
  pair_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.org_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.org_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists org_messages_conversation_created_idx on public.org_messages(conversation_id, created_at);
create index if not exists org_conversations_scope_a_idx on public.org_conversations(scope_a_type, scope_a_id);
create index if not exists org_conversations_scope_b_idx on public.org_conversations(scope_b_type, scope_b_id);

create or replace function private.user_has_org_scope(p_type text, p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.is_active and (
      (p_type='area' and m.role='admin_daerah' and m.area_id=p_id)
      or (p_type='village' and m.role='admin_desa' and m.village_id=p_id)
      or (p_type='group' and m.role in ('pj_kelompok','pengajar') and m.group_id=p_id)
    )
  )
$$;

create or replace function private.org_scopes_related(a_type text, a_id uuid, b_type text, b_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select case
    when a_type='area' and b_type='village' then exists(select 1 from public.villages v where v.id=b_id and v.area_id=a_id)
    when a_type='village' and b_type='area' then exists(select 1 from public.villages v where v.id=a_id and v.area_id=b_id)
    when a_type='area' and b_type='group' then exists(select 1 from public.groups g join public.villages v on v.id=g.village_id where g.id=b_id and v.area_id=a_id)
    when a_type='group' and b_type='area' then exists(select 1 from public.groups g join public.villages v on v.id=g.village_id where g.id=a_id and v.area_id=b_id)
    when a_type='village' and b_type='group' then exists(select 1 from public.groups g where g.id=b_id and g.village_id=a_id)
    when a_type='group' and b_type='village' then exists(select 1 from public.groups g where g.id=a_id and g.village_id=b_id)
    else false
  end
$$;

create or replace function private.can_access_org_conversation(p_conversation uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from public.org_conversations c
    where c.id=p_conversation and (
      private.user_has_org_scope(c.scope_a_type,c.scope_a_id)
      or private.user_has_org_scope(c.scope_b_type,c.scope_b_id)
    )
  )
$$;

create or replace function public.open_org_conversation(p_target_type text, p_target_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  src_type text;
  src_id uuid;
  a_type text;
  a_id uuid;
  b_type text;
  b_id uuid;
  a_key text;
  b_key text;
  v_pair text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Silakan masuk kembali.'; end if;
  if p_target_type not in ('area','village','group') then raise exception 'Jenis kontak tidak valid.'; end if;

  select case
      when m.role='admin_daerah' then 'area'
      when m.role='admin_desa' then 'village'
      when m.role in ('pj_kelompok','pengajar') then 'group'
    end,
    case
      when m.role='admin_daerah' then m.area_id
      when m.role='admin_desa' then m.village_id
      when m.role in ('pj_kelompok','pengajar') then m.group_id
    end
  into src_type,src_id
  from public.memberships m
  where m.user_id=auth.uid() and m.is_active and m.role in ('admin_daerah','admin_desa','pj_kelompok','pengajar')
  order by case m.role when 'admin_daerah' then 1 when 'admin_desa' then 2 when 'pj_kelompok' then 3 else 4 end
  limit 1;

  if src_type is null or src_id is null then raise exception 'Akun ini belum memiliki lingkup komunikasi.'; end if;
  if src_type=p_target_type and src_id=p_target_id then raise exception 'Tidak dapat membuka percakapan dengan unit sendiri.'; end if;
  if not private.org_scopes_related(src_type,src_id,p_target_type,p_target_id) then raise exception 'Kontak berada di luar struktur akses Anda.'; end if;

  a_key := src_type || ':' || src_id::text;
  b_key := p_target_type || ':' || p_target_id::text;
  if a_key <= b_key then
    a_type:=src_type; a_id:=src_id; b_type:=p_target_type; b_id:=p_target_id;
  else
    a_type:=p_target_type; a_id:=p_target_id; b_type:=src_type; b_id:=src_id;
  end if;
  v_pair := least(a_key,b_key) || '|' || greatest(a_key,b_key);

  insert into public.org_conversations(scope_a_type,scope_a_id,scope_b_type,scope_b_id,pair_key)
  values(a_type,a_id,b_type,b_id,v_pair)
  on conflict(pair_key) do update set updated_at=public.org_conversations.updated_at
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.open_org_conversation(text,uuid) from public,anon;
grant execute on function public.open_org_conversation(text,uuid) to authenticated;

alter table public.org_conversations enable row level security;
alter table public.org_messages enable row level security;

drop policy if exists org_conversations_read on public.org_conversations;
create policy org_conversations_read on public.org_conversations for select to authenticated
using (private.user_has_org_scope(scope_a_type,scope_a_id) or private.user_has_org_scope(scope_b_type,scope_b_id));

drop policy if exists org_messages_read on public.org_messages;
create policy org_messages_read on public.org_messages for select to authenticated
using (private.can_access_org_conversation(conversation_id));

drop policy if exists org_messages_insert on public.org_messages;
create policy org_messages_insert on public.org_messages for insert to authenticated
with check (sender_id=auth.uid() and private.can_access_org_conversation(conversation_id));

drop trigger if exists touch_org_conversations on public.org_conversations;
create trigger touch_org_conversations before update on public.org_conversations
for each row execute function public.touch_updated_at();

do $$
begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
     and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='org_messages') then
    alter publication supabase_realtime add table public.org_messages;
  end if;
end $$;