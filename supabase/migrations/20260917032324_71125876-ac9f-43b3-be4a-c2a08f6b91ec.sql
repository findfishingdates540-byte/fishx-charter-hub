create or replace function public.can_view_profile(_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    _profile_id = auth.uid()
    or exists (
      select 1
      from public.bookings b
      where b.angler_id = _profile_id
        and (
          b.captain_id = auth.uid()
          or (b.business_id is not null
              and public.is_business_member(b.business_id, auth.uid(), 'staff'::business_member_role))
        )
    )
    or exists (
      select 1
      from public.business_members m1
      join public.business_members m2 on m2.business_id = m1.business_id
      where m1.user_id = auth.uid()
        and m2.user_id = _profile_id
    );
$$;

grant execute on function public.can_view_profile(uuid) to authenticated;

drop policy if exists "Profiles: operators read customers" on public.profiles;
create policy "Profiles: operators read customers"
on public.profiles
for select
to authenticated
using (public.can_view_profile(id));