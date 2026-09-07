CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  intended text;
  vertical text;
  role_val public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, display_name, avatar_url, phone)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'phone'
  )
  ON CONFLICT (id) DO NOTHING;

  intended := COALESCE(NEW.raw_user_meta_data ->> 'intended_role', 'angler');
  vertical := NEW.raw_user_meta_data ->> 'vertical';

  -- Business signups: the vertical they picked becomes their role.
  IF vertical IS NOT NULL AND vertical <> '' THEN
    intended := CASE lower(vertical)
      WHEN 'captain' THEN 'captain'
      WHEN 'charter' THEN 'captain'
      WHEN 'tackle' THEN 'tackle_shop'
      WHEN 'tackle_shop' THEN 'tackle_shop'
      WHEN 'bait' THEN 'bait_shop'
      WHEN 'bait_shop' THEN 'bait_shop'
      WHEN 'marina' THEN 'marina'
      WHEN 'lodge' THEN 'lodge'
      WHEN 'manufacturer' THEN 'gear_mfg'
      WHEN 'gear_mfg' THEN 'gear_mfg'
      WHEN 'apparel' THEN 'apparel'
      WHEN 'guide' THEN 'guide_service'
      WHEN 'guide_service' THEN 'guide_service'
      ELSE intended
    END;
  END IF;

  IF intended NOT IN (
    'angler','business_owner','captain','marina','tackle_shop',
    'bait_shop','gear_mfg','apparel','guide_service','lodge'
  ) THEN
    intended := 'angler';
  END IF;

  role_val := intended::public.app_role;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, role_val)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;