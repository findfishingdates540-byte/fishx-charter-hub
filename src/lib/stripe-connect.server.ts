export async function getOwnedBusiness(
  supabase: any,
  userId: string,
  businessId?: string,
) {
  const query = supabase
    .from("business_members")
    .select("business_id, role, business:businesses(*)")
    .eq("user_id", userId)
    .in("role", ["owner", "manager"]);

  const { data, error } = businessId
    ? await query.eq("business_id", businessId)
    : await query;

  if (error) throw new Error(error.message);
  const row = (data ?? [])[0];
  if (!row?.business) throw new Error("No business found for this account");
  return row.business;
}
/** Same lookup, but returns null instead of throwing when the account has no business yet. */
export async function findOwnedBusiness(
  supabase: any,
  userId: string,
  businessId?: string,
) {
  try {
    return await getOwnedBusiness(supabase, userId, businessId);
  } catch {
    return null;
  }
}
