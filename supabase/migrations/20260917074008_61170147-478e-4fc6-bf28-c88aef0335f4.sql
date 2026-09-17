
create or replace function public.grant_platform_admin_for_staff_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null
     and lower(new.email) = 'findfishingdates5400@gmail.com' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin'::app_role)
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_grant_platform_admin on auth.users;
create trigger on_auth_user_created_grant_platform_admin
after insert on auth.users
for each row execute function public.grant_platform_admin_for_staff_email();

drop trigger if exists on_auth_user_confirmed_grant_platform_admin on auth.users;
create trigger on_auth_user_confirmed_grant_platform_admin
after update of email_confirmed_at on auth.users
for each row
when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
execute function public.grant_platform_admin_for_staff_email();

-- backfill if the staff account already exists and is confirmed
insert into public.user_roles (user_id, role)
select u.id, 'admin'::app_role
from auth.users u
where lower(u.email) = 'findfishingdates5400@gmail.com'
  and u.email_confirmed_at is not null
on conflict (user_id, role) do nothing;

grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;

drop policy if exists "Admins read the audit log" on public.audit_logs;
create policy "Admins read the audit log"
on public.audit_logs
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'::app_role));
