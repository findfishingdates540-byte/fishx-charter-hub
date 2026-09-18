# Refine the Fish-X auth emails

## Design
- Replace the plain dark card with a premium maritime editorial layout: Deep Hull navy, Sandy Gold details, warm white reading surface, and a restrained cyan utility accent.
- Give the Fish-X wordmark a stronger header treatment, use elegant serif-style headings with email-safe fallbacks, and improve spacing, hierarchy, dividers, and mobile readability.
- Keep every message visually consistent while giving confirmation, sign-in, recovery, invitation, email-change, and security-code emails distinct copy and icon-free status labels.

## Compatibility
- Use table-based HTML and inline styles so the templates render reliably in Gmail, Outlook, Apple Mail, and mobile clients.
- Preserve all Supabase placeholders exactly, including confirmation links, email addresses, and verification tokens.
- Include a clear fallback link, security note, and branded footer in every template.

## Deliverables
- Update all six HTML files in `supabase/email-templates/`.
- Keep them ready to paste directly into Supabase Authentication email templates.
