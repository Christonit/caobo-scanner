-- Allow users to read every organization they are a member of.
--
-- Without this, the sidebar/settings org switcher cannot resolve names for
-- non-active memberships: organization_members embeds return organization=null
-- because the existing org SELECT policies only expose current_user_org().

drop policy if exists "organizations_select_as_member" on public.organizations;
create policy "organizations_select_as_member"
  on public.organizations
  for select
  to authenticated
  using (
    id in (
      select m.organization_id
      from public.organization_members m
      where m.user_id = (select auth.uid())
    )
    or public.is_superadmin()
  );
