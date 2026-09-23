create or replace function public.grant_platform_admin_for_staff_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- No designated staff emails configured. Admin access is granted manually.
  return new;
end;
$$;

revoke execute on function public.grant_platform_admin_for_staff_email() from public, anon, authenticated;