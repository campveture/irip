---
name: academy-secure-fullstack
description: Build or review Unknown Academy features connecting its React/Vite frontend to the local Express/SQLite API. Use for authentication, single-admin authorization, profile submissions and approvals, migrations, API contracts, CSRF protections, or backend integration; deliver small tested slices without deployment.
metadata:
  author: unknown-academy-local
  provenance: locally-authored-not-downloaded
---

# Academy secure full-stack development

Locally authored for Unknown Academy; not downloaded or endorsed by Vercel.
This is development guidance, not a security guarantee or production certification.

## Establish the boundary

1. Read relevant project instructions and inspect the current diff before editing.
2. Trace the UI, API client, route, authorization, persistence, and tests together.
3. Describe one small vertical slice and its acceptance checks; preserve other work.
4. Keep React/Vite and Express/SQLite local. Do not deploy, provision, or add secrets.
5. Preserve the production refusal in `server/server.js`; never weaken or bypass it.
6. Do not reinterpret a successful local test or static preview as production readiness.

## Contracts and frontend integration

- Define request/response DTOs, allowed fields, errors, and revision identifiers first.
- Use strict TypeScript for new client/contracts; preserve existing strict settings.
- Bridge legacy JavaScript incrementally; do not silently migrate the entire app.
- TypeScript is not runtime validation: validate untrusted bodies, params, and JSON.
- Reject unexpected security-sensitive fields; never mass-assign a submitted object.
- Keep API requests in the existing client boundary; use credentialed local sessions.
- Show loading, empty, validation, unauthenticated, forbidden, and conflict states.
- Abort stale reads or ignore obsolete results; do not retry mutations blindly.
- Treat UI role gates as convenience only, never as the authorization boundary.

## Identity and the central admin portal

- Resolve the active actor from the server session, not body IDs or client headers.
- Check current account status, effective permissions, and resource scope per request.
- Deny by default; validate ownership even when a role check succeeds.
- Keep one central admin portal with server-enforced staff permissions underneath.
- Prevent signup, profile updates, or ordinary users from setting role/admin fields.
- Never interpret one admin portal as a requirement for only one admin account.
- Do not use first signup, a hardcoded email, or a demo account as implicit admin.
- Bootstrap/transfer admin only through an explicitly authorized local process.
- Apply privilege revocations immediately; stale sessions cannot retain authority.
- Regenerate sessions on login/privilege change; invalidate on logout/deactivation.
- Keep session cookies HttpOnly and SameSite; do not store credentials in web storage.
- Keep existing synthetic demo identity clearly separate from verified identity.

## CSRF and request origin

- Guard every state-changing endpoint, including login, logout, and review decisions.
- Require a project-specific custom header, e.g. `X-Academy-Request: 1`, on mutations.
- Check its exact value server-side before mutation; this marker is not a secret.
- Also require an exact allowed Origin: scheme, host, and port; no suffix matching.
- Reject missing, `null`, or unapproved Origin on browser mutation routes.
- For local tests, send the explicitly configured local Origin and custom header.
- Restrict credentialed CORS to that allowlist; never reflect arbitrary origins.
- Require JSON for JSON mutations; reject form/simple-request fallback paths.
- Do not mutate on GET/HEAD; do not rely on CORS or SameSite alone for CSRF defense.
- Keep authentication and resource authorization independent of the CSRF marker.

## Profile revisions and approvals

- Store each submitted profile revision as an immutable snapshot with server metadata.
- Link every decision to the exact revision ID, reviewer ID, and server timestamp.
- Keep draft, pending, approved, rejected, and revoked transitions explicit.
- Publish only the currently approved, non-revoked snapshot through an allowlist DTO.
- A pending edit never changes the approved public snapshot before approval.
- New submissions create revisions; do not overwrite or silently reapprove old ones.
- Authorize review decisions for permitted operations staff; applicants cannot self-approve.
- Compare expected revision/state inside the transaction; reject stale actions with 409.
- Make repeated decisions deterministic; prevent approval/rejection races atomically.
- Persist decision, publication pointer, and required audit event in one transaction.
- Critical review auditing must fail closed, not silently drop an audit write.
- Record only necessary audit metadata; exclude secrets and private profile contents.

## Persistence and data minimization

- Use bound SQL parameters, constraints, foreign keys, and explicit transactions.
- Add versioned migrations with tested upgrade/restart behavior and data preservation.
- Do not use destructive reseeding or startup updates to overwrite existing accounts.
- Use synthetic fixtures in an isolated temporary database, never `server/data.sqlite`.
- Never export private profiles, pending/rejected revisions, contacts, or admin data.
- Check public APIs, static demo JSON, preview builds, logs, and caches for leaks.
- Return explicit public fields, not `SELECT *` rows or serialized database objects.
- Do not share user-scoped data through unscoped caches; use no-store for private data.

## Security acceptance before claiming completion

- Test anonymous, owner, other user, inactive user, designated admin, and revoked admin.
- Test ID swapping, forged roles/actor IDs, malformed inputs, and unauthorized writes.
- Test missing/wrong custom header and missing/null/foreign Origin without mutations.
- Test immutable revisions, stale decisions, concurrency, revocation, and audit rollback.
- Test that pending/private fields never appear in public API or preview exports.
- Test migration preservation and the production refusal without modifying real data.
- Run focused API/client tests, typecheck, and the relevant local browser flow.
- Inspect test commands first: avoid destructive seeds, external calls, and deployment.
- Report exact checks run, untested paths, remaining demo limitations, and changed files.
