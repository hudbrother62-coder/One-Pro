create policy chat_threads_insert on public.chat_threads
for insert to authenticated
with check (
  created_by = auth.uid()
  and (private.is_super_admin() or private.can_access_group(group_id))
);

create policy chat_threads_update on public.chat_threads
for update to authenticated
using (created_by = auth.uid() or private.is_super_admin())
with check (created_by = auth.uid() or private.is_super_admin());

create policy chat_threads_delete on public.chat_threads
for delete to authenticated
using (created_by = auth.uid() or private.is_super_admin());

create policy chat_participants_insert on public.chat_participants
for insert to authenticated
with check (
  (user_id = auth.uid() or private.is_super_admin())
  and exists(select 1 from public.chat_threads t where t.id = thread_id and (t.created_by = auth.uid() or private.is_super_admin()))
);

create policy chat_participants_update on public.chat_participants
for update to authenticated
using (user_id = auth.uid() or private.is_super_admin())
with check (user_id = auth.uid() or private.is_super_admin());
