drop policy if exists invitations_manage on public.invitations;

create policy invitations_read on public.invitations
for select
using (
  private.is_super_admin()
  or invited_by = auth.uid()
);

create policy invitations_insert on public.invitations
for insert
with check (
  invited_by = auth.uid()
  and private.can_manage_membership(role, area_id, village_id, group_id)
);

create policy invitations_update on public.invitations
for update
using (
  private.is_super_admin()
  or invited_by = auth.uid()
)
with check (
  private.is_super_admin()
  or (
    invited_by = auth.uid()
    and private.can_manage_membership(role, area_id, village_id, group_id)
  )
);

create policy invitations_delete on public.invitations
for delete
using (
  private.is_super_admin()
  or invited_by = auth.uid()
);
