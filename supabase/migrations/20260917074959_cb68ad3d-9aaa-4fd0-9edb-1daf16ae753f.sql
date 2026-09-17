create or replace function public.grant_platform_admin_for_staff_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is not null
     and lower(new.email) in (
       'findfishingdates5400@gmail.com',
       'findfishingdates54000@gmail.com'
     ) then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin'::app_role)
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

revoke execute on function public.grant_platform_admin_for_staff_email() from public, anon, authenticated;

insert into public.user_roles (user_id, role)
select u.id, 'admin'::app_role
from auth.users u
where lower(u.email) in ('findfishingdates5400@gmail.com','findfishingdates54000@gmail.com')
  and u.email_confirmed_at is not null
on conflict (user_id, role) do nothing;