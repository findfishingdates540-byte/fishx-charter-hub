/**
 * Auth-related server functions.
 * Query user roles and permissions.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (error) throw new Response(error.message, { status: 500 });

    return (Array.isArray(data) ? data : []).map((r: { role: string }) => r.role);
  });

export type VerticalRole =
  | "captain"
  | "marina"
  | "lodge"
  | "tackle_shop"
  | "bait_shop"
  | "gear_mfg"
  | "apparel"
  | "guide_service";

export type PrimaryRole = VerticalRole | "business_owner" | "angler";

/** Business category that each vertical role owns. */
const ROLE_CATEGORY: Record<VerticalRole, string> = {
  captain: "charter",
  marina: "marina",
  lodge: "lodge",
  tackle_shop: "tackle_shop",
  bait_shop: "bait_shop",
  gear_mfg: "gear_mfg",
  apparel: "apparel",
  guide_service: "guide_service",
};

/** The business category a role should always land on, when it has one. */
export const roleCategoryKey = (role: string | null): string | null =>
  role && role in ROLE_CATEGORY ? ROLE_CATEGORY[role as VerticalRole] : null;

/** True for any operator-side role (a vertical, or a legacy business owner). */
export const isOperatorRole = (role: string | null): boolean =>
  role === "business_owner" || roleCategoryKey(role) !== null;

/**
 * The signed-in user's routing role. A vertical role (chosen at signup) always
 * wins so an account never flips between, say, captain and tackle shop.
 */
export const hasPrimaryRole = (roles: unknown): PrimaryRole | null => {
  if (!Array.isArray(roles)) {
    // Defensive: a transient server-fn/serialization hiccup (e.g. right after
    // sign-in) must not crash the dashboard with "roles.includes is not a function".
    console.error("hasPrimaryRole received non-array roles:", roles);
    return null;
  }
  const vertical = (Object.keys(ROLE_CATEGORY) as VerticalRole[]).find((r) =>
    roles.includes(r),
  );
  if (vertical) return vertical;
  if (roles.includes("business_owner")) return "business_owner";
  if (roles.includes("angler")) return "angler";
  return null;
};

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Response(error.message, { status: 500 });
    return data;
  });

/**
 * One round trip for everything the dashboard needs to decide what to render:
 * roles, business memberships and profile. Each authenticated server call pays
 * a token-verification cost, so merging three calls into one is the single
 * biggest win on the login -> dashboard path.
 */
export const getMyBootstrap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [rolesRes, memsRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase
        .from("business_members")
        .select(
          "role, business:businesses(id,slug,name,category_key,hero_url,is_published,verified_at)",
        )
        .eq("user_id", userId),
      supabase
        .from("profiles")
        .select("id, full_name, display_name, avatar_url")
        .eq("id", userId)
        .maybeSingle(),
    ]);
    if (rolesRes.error) throw new Response(rolesRes.error.message, { status: 500 });
    if (memsRes.error) throw new Response(memsRes.error.message, { status: 500 });
    if (profileRes.error) throw new Response(profileRes.error.message, { status: 500 });

    return {
      roles: (rolesRes.data ?? []).map((r: { role: string }) => r.role),
      businesses: memsRes.data ?? [],
      profile: profileRes.data,
    };
  });
