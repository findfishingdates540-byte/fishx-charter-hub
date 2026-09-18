import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
// Brand template shared with Supabase → Authentication → Email Templates.
// Raw-imported so the app sends the exact same design through Resend.
import confirmTemplate from "../../supabase/email-templates/confirm-signup.html?raw";

const APP_URL =
  process.env["PUBLIC_APP_URL"] ?? "https://booking.fish-x.com";

/**
 * Generates a fresh signup-confirmation link with the service role and sends
 * it through Resend (verified domain), bypassing Supabase's default sender
 * which is capped and unreliable for non-team addresses.
 *
 * Public by design: it can only email a confirmation link for the address the
 * caller provides — it reveals nothing about whether the account exists.
 */
export const sendSignupConfirmation = createServerFn({ method: "POST" })
  .inputValidator(
    (data) =>
      z
        .object({
          email: z.string().email().max(320),
          kind: z.enum(["angler", "business"]).default("angler"),
        })
        .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const redirectTo =
      data.kind === "business" ? `${APP_URL}/onboarding` : `${APP_URL}/dashboard`;

    // magiclink (not "signup", which demands the password we don't have):
    // verifying it both confirms the email and signs the user in.
    const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: data.email,
      options: { redirectTo },
    });
    if (error || !linkData?.properties?.action_link) {
      // Already confirmed, unknown address, etc. — stay vague on purpose.
      console.error("generateLink failed:", error?.message);
      return { sent: false, reason: "no_pending_confirmation" };
    }

    const apiKey = process.env["RESEND_API_KEY"];
    const from = process.env["EMAIL_FROM"];
    if (!apiKey || !from) return { sent: false, reason: "email_not_configured" };

    const html = confirmTemplate
      .replaceAll("{{ .ConfirmationURL }}", linkData.properties.action_link)
      .replaceAll("{{ .Token }}", "")
      .replaceAll("{{ .SiteURL }}", APP_URL)
      .replaceAll("{{ .Email }}", data.email);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [data.email],
        subject: "Confirm your Fish-X account — the water is waiting",
        html,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`Resend failed [${res.status}]: ${body}`);
      return { sent: false, reason: `resend_${res.status}` };
    }
    return { sent: true, reason: null as string | null };
  });
