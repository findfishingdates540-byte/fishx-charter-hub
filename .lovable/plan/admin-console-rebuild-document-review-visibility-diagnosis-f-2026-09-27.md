# Admin console rebuild: document review, visibility diagnosis, full management

## 1. Review a document before deciding
- Every submitted document gets a clear **View document** button that opens a preview window inside the admin panel (images shown inline, PDFs embedded, with a "Open in new tab" and "Download" fallback).
- Approve / Reject / Reopen buttons sit inside that preview, so you decide while looking at the file. Approve is disabled until the file has been opened at least once.
- If a file link cannot be generated (missing file), the card says "File missing — ask operator to resubmit" instead of silently hiding the button.

## 2. Explain why an approved operator is still hidden
Approval only covers documents. An operator is shown to anglers only when all of these are true:
1. Documents approved
2. Payments connected (Stripe can charge and pay out)
3. Storefront switched live
4. At least one live listing with upcoming dates (or a live in-stock product for shops)

Current data confirms this: approved operators are hidden because payments are not connected and/or there are no bookable listings.

Changes:
- Each operator row and profile shows a **Visibility checklist** with a green/red tick per item and a plain-language reason ("Hidden — payments not connected").
- After you approve the last document, a confirmation shows what the operator still has to do, and the operator receives a notification listing the remaining steps with a link to each.
- Admin actions: "Send reminder" (notifies operator of missing steps) and "Publish storefront" (only allowed when payments + listings are ready; payments are never bypassed, so anglers can always check out).

## 3. Proper admin console layout
Replace the long top tab strip with a left **sidebar** (collapsible drawer on mobile) in the dark operator theme:

```text
Dashboard | Operators | Users | Verification | Listings | Bookings
Calendar | Payments & Payouts | Reconciliation | Disputes | Activity log
```

- **Dashboard (new home):** totals for users, operators, live vs hidden operators, documents awaiting review, bookings and gross this week/month, open disputes, pending payouts, plus "Needs attention" lists (docs to review, hidden-but-approved operators, disputes) with one-click jumps. Real data only.
- **Operators:** searchable/filterable table (type, status, visibility) → operator detail page: business info, owner contact, documents with review, visibility checklist, listings, bookings, payouts, history; actions: publish/unpublish storefront, suspend/restore, send reminder.
- **Users:** searchable list of all accounts (anglers, operators, staff) → user detail: profile, roles (grant/revoke), businesses, bookings; actions: suspend/restore sign-in, send password reset.
- Existing sections (Listings, Bookings, Calendar, Payments, Payouts, Reconciliation, Disputes, Activity) move under the sidebar unchanged in behaviour.
- Each section gets its own address (e.g. /admin/operators/…), so pages are bookmarkable and the back button works.

## Technical details
- Split `src/routes/admin.tsx` into `admin.tsx` (login + shell with sidebar, `<Outlet />`) and child routes: `admin.index`, `admin.operators`, `admin.operators.$id`, `admin.users`, `admin.users.$id`, `admin.verification`, and the existing panels as routes.
- New `DocumentPreviewDialog` using signed `viewUrl` (15 min, regenerated on open via a new `getVerificationDocumentUrl` admin fn); client tracks "opened" before enabling Approve.
- New admin fns in `admin-directory.functions.ts`: `getAdminDashboard`, `getOperatorDetail` (includes visibility checklist computed from `charges_enabled`, `payouts_enabled`, `verified_at`, `is_published`, `business_has_bookable`), `getUserDetail`, `setBusinessPublished`, `sendSetupReminder`, `setUserSuspended` (Auth admin ban via service role), `sendPasswordReset`. All gated by `assertAdmin` and logged to `audit_logs`.
- `decideVerificationDocument`: when business becomes verified, call `recompute_listing_ready` and notify with remaining blockers.
- Suspension: add `suspended_at` to `businesses` (migration) and exclude suspended businesses from the public RLS policy; user suspension uses Supabase Auth ban, no schema change.
