/**
 * Server functions for the angler Account / Profile screen.
 * Everything runs as the signed-in user via requireSupabaseAuth (RLS applies) —
 * an angler can only read/write their own `profiles` row. The email itself lives
 * in auth (never in `profiles`), so it is surfaced read-only from the claims.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** The signed-in angler's own profile (may be null if not created yet) + email. */
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;

    const profileRes = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (profileRes.error) throw new Response(profileRes.error.message, { status: 500 });

    return {
      profile: profileRes.data ?? null,
      email: (claims as { email?: string | null }).email ?? null,
      viewerId: userId,
    };
  });

const norm = (v: string | undefined) => {
  const t = (v ?? "").trim();
  return t.length ? t : null;
};

/** Upsert the signed-in angler's own profile row. */
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        full_name: z.string().max(120).optional(),
        display_name: z.string().max(80).optional(),
        phone: z.string().max(40).optional(),
        avatar_url: z
          .string()
          .max(2000)
          .refine((v) => v === "" || /^(https?:\/\/|\/)/.test(v), "Invalid image URL")
          .optional(),
        home_port: z.string().max(120).optional(),
        favorite_species: z.string().max(160).optional(),
        bio: z.string().max(600).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error } = await supabase.from("profiles").upsert(
      {
        id: userId,
        full_name: norm(data.full_name),
        display_name: norm(data.display_name),
        phone: norm(data.phone),
        avatar_url: norm(data.avatar_url),
        home_port: norm(data.home_port),
        favorite_species: norm(data.favorite_species),
        bio: norm(data.bio),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    if (error) throw new Response(error.message, { status: 500 });

    return { ok: true as const };
  });
