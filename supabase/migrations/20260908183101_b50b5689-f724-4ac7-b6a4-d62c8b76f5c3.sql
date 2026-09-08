UPDATE public.businesses
SET category_key = 'charter', updated_at = now()
WHERE id = '8ff48e42-b666-44c1-a155-f83397abd82e'
  AND category_key = 'tackle_shop'
  AND EXISTS (
    SELECT 1
    FROM public.business_members bm
    JOIN public.user_roles ur ON ur.user_id = bm.user_id
    WHERE bm.business_id = businesses.id
      AND bm.role = 'owner'
      AND bm.user_id = 'c6a1f492-054f-444d-8169-60a4828640f2'
      AND ur.role = 'captain'
  );