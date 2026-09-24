# Per-document operator verification

## Goal
Let admins approve or reject each required document separately. Operators can revisit verification after onboarding, replace only rejected documents, and keep accepted documents locked. Only an admin can reopen an accepted document.

## What will change

### 1. Store each document separately
- Add a verification document record for every required document type, linked to the business and its submission history.
- Track each document’s type, file, status, rejection reason, reviewer, decision date, and replacement history.
- Preserve the existing request history and audit trail while moving new reviews to per-document decisions.
- Keep operator access limited to their own business; only admins can approve, reject, or reopen documents.

### 2. Give admins document-by-document review controls
- Expand each business in the admin Documents area to show every submitted file and its current status.
- Allow each file to be opened, approved, or rejected independently.
- Require a specific rejection reason for each rejected file.
- Add an admin-only “Reopen” action for accepted files, with a required reason, so the operator can replace them when necessary.
- Mark the business verified only when every currently required document is accepted; partial approval remains incomplete.

### 3. Add permanent operator access after onboarding
- Add a dedicated **Verification documents** section inside operator Settings for every operator type.
- Show accepted, pending, rejected, and reopened documents clearly, including decision dates and admin feedback.
- Accepted documents remain visible but their upload controls are disabled.
- Rejected or admin-reopened documents show an upload-and-resubmit control only for that document.
- Link verification notifications and readiness prompts directly to this Settings section instead of relying on the onboarding wizard.

### 4. Make resubmission safe
- A replacement creates a new version for only the affected document and leaves accepted documents untouched.
- Prevent operators from replacing accepted or pending files on the server, not just in the screen.
- Return the resubmitted document to pending review and preserve all earlier versions for staff history.
- Prevent duplicate active submissions for the same document type.

### 5. Transition existing verification data
- Convert each existing request’s stored file list into document records without deleting historical requests.
- Existing fully approved requests become accepted document records; rejected batches remain resubmittable and will be clearly identified for staff review where the old data has no document-type label.
- Keep current listing publication safeguards in place and base verification readiness on all required documents being accepted.

### 6. Validate the full workflow
- Test mixed admin decisions: approve some files and reject another.
- Confirm operators can reach verification from their dashboard after onboarding and replace only the rejected file.
- Confirm accepted files cannot be changed by operators, but can be reopened by an admin.
- Confirm resubmission preserves accepted files, updates status correctly, retains history, and only verifies the business after all required files pass.
- Check desktop, tablet, and mobile layouts, database access rules, and the current app build.

## Technical details
- Use a normalized child table for document-level state and immutable version history rather than adding more status arrays to `verification_requests`.
- Apply explicit authenticated/service-role grants, row-level access rules, update timestamps, and server-side transition validation in the same database migration.
- Use authenticated TanStack server functions for operator reads/uploads and role-checked admin functions for decisions and reopening.
- Keep the private `verification-docs` storage flow and timestamped file paths; no accepted file is overwritten in place.
