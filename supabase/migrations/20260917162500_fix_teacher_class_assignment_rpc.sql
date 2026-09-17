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
    select 1
    from unnest(coalesce(p_class_ids,'{}'::uuid[])) as requested(class_id)
    left join public.classes c on c.id=requested.class_id
    where c.id is null or c.group_id<>target_group or not c.is_active
  ) then raise exception 'Pilihan kelas tidak valid atau berasal dari kelompok lain.'; end if;

  delete from public.class_teachers ct
  using public.classes c
  where ct.class_id=c.id and ct.user_id=p_user_id and c.group_id=target_group;

  insert into public.class_teachers(class_id,user_id,is_lead)
  select requested.class_id,p_user_id,true
  from unnest(coalesce(p_class_ids,'{}'::uuid[])) as requested(class_id);
end $$;

revoke all on function public.set_teacher_classes(uuid,uuid[]) from public,anon;
grant execute on function public.set_teacher_classes(uuid,uuid[]) to authenticated;
