CREATE OR REPLACE FUNCTION public.grant_platform_admin_for_staff_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  if new.email_confirmed_at is not null
     and lower(new.email) in ('sibelferrer22@gmail.com', 'joshuacambelladmin@gmail.com') then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin'::app_role)
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;