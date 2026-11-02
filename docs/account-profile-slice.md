# Accounts and profile approvals: first backend slice

Implemented locally on 31 October 2026; revised on 1 November to use public mentor applications rather than mentor signup. This is a working synthetic prototype, not a production account launch or security certification. Nothing in this slice authorizes real enrollment, financial commitments or deployment.

## Review the workflow

Run `npm run dev` and use the URL printed by the development server. Default: `http://127.0.0.1:5173`. Restart this process after backend edits: Vite reloads frontend modules, but the embedded Express process does not automatically reload API routes. An old process can otherwise show the new form while returning 404 for its endpoint.

1. New mentors use **Apply as a mentor** at `/teach/apply`, linked from **More**, the mobile navigation menu, mentor directory, teaching pages, footer and learner signup page. Per the user's explicit preference, there is **no standalone desktop or mobile header button**. The old `/signup/mentor` bookmark redirects to this application. No signup, password, identity session or learner account is needed. Learner registration remains at `/signup`.
2. `/account/profile` and `/app/onboarding` share one profile editor. Name, phone, language/timezone, goals, interests and study plan persist and appear in the authorized admin learner detail. Email changes, verification and recovery remain unavailable.
3. The public application has three steps: professional background, mentoring fit, and review/consent. It collects qualifications, experience, expertise, optional professional-profile URL, availability, language and mentoring approach. Drafts stay in tab memory only; final submission persists an immutable private application in `mentor_intake`. The acknowledgement creates no account and sends no email. The submitted snapshot and decision history appear under **New mentor applications** in `/admin/approvals` and `/admin/mentors`, with a dedicated review at `/admin/mentor-applications/:id`. Approval here means suitable to proceed to verified onboarding only—not an access grant, public listing or verified email. Secure invitation and identity verification are not connected; follow-up is manual in this demo.
4. Existing members retain `/account/mentor-application` for account-owned profile revisions. Approved mentors also reach it through `/mentor/application`. This is separate from the public application intake; unverified applicant emails are never automatically linked to an existing account.
5. Members can save a partial private draft. It is not a public profile or an operations review record. Complete the required fields and explicitly submit it. Submission locks the content; withdrawal or requested changes require a **new revision**, preserving the earlier submitted content.
6. Academic operations/admin/owner use `/admin/approvals` or `/admin/mentors`, then `/admin/mentors/:id` for member revisions. They can request changes, reject or approve a submitted revision, recording a shared reason. Approval also requires a private verification note, which is not a substitute for genuine credential verification.
7. Only admin/owner can explicitly grant a new `mentor` capability for an existing member. Profile approval does not create a class, learner, project, supervisor, enrollment, contract or financial entitlement. An edit approval preserves existing active mentoring grants; it does not silently revive suspended/legacy grants.
8. Member-profile publication is a separate checkbox requiring applicant consent for that exact snapshot. Only display name, biography and expertise are public. Experience, availability, application history, verification notes and contact details stay out of public responses.
9. Member applicants see review feedback/history and can refresh current status. In-app notifications link to their member application; no external email is sent. Public intake does not expose an email-based status lookup.
10. Admin can hide a member listing without revoking mentoring access, or suspend mentoring, which hides the listing and deletes mentoring/supervisor role grants. Members can hide their own listing immediately. Consent withdrawal also invalidates older pending publication permission. Republishing needs a newly consented, reviewed revision.

One central admin portal does **not** mean one shared administrator login or only one administrator identity. Staff permissions are enforced underneath it, allowing later operational panels without redesigning the identity model.

## Modules and persistence

| Module | Responsibility |
| --- | --- |
| `server/profiles/schema.js` | Additive profile fields, application revisions, decision history, indexes |
| `server/profiles/service.js` | Field allowlists, ownership, version/state checks, transactions, projections, approval/consent policy |
| `server/profiles/routes.js` | Authenticated account API and restricted operations commands |
| `server/middleware/security.js` | Exact-origin/custom-header mutation guard and bounded local rate limiter |
| `server/middleware/auth.js` | Current active-account/global capability checks; mentor approval required for mentoring roles |
| `client/src/components/accounts/` | Strict TypeScript profile/application/operations UI, runtime decoders and loading/retry handling |
| `client/src/contexts/AuthContext.tsx` | Typed, runtime-validated identity and refresh after profile changes |

`mentor_profiles` remains the approved public projection; `mentor_applications` stores private drafts and submitted revisions. Existing approved synthetic mentor names are snapshotted once during migration. Subsequent account-name edits cannot change the approved public display name. Fresh synthetic seeding explicitly sets its approved display name; existing profiles, learners, rates and historical transactions are not reseeded.

`POST /api/auth/signup` now accepts only learner registration (including the optional legacy `account_type='learner'`). `account_type='mentor'` returns **410** directing callers to `/teach/apply`; mentor signup is no longer a parallel bypass. Existing `mentor_applicant` identities and member applications are preserved, not converted or deleted. The new additive `mentor_intake` and `mentor_intake_decisions` tables deliberately have no account-ownership inference from email. `server/test-mentor-applications.js` covers public submission, review and the absence of automatic account provisioning.

Public submission uses `POST /api/mentor-applications` with exact-origin/custom-header protection, explicit field/URL/range validation, review consent, an accuracy declaration and a bounded local rate limit. It returns a generic **202** acknowledgement for both a new application and an already-open application at the same normalized email; anonymous resubmission cannot overwrite a snapshot or reveal its status. There is no public list, detail or edit endpoint. Staff GET list/detail and POST decisions use `/api/accounts/operations/mentor-intake[/:id[/decision]]`, require academic-ops/admin/owner, deny self-review and compare versions transactionally. Decision, history and mandatory payload-free audit either all commit or all roll back. No account, role grant, public profile or outgoing message is created, even on approval.

Application versions increase across revisions as well as edits/transitions, preventing stale tabs from accidentally editing a newer revision with a reused version number. Decisions compare expected state and version inside a transaction. The decision, projection/grant change, notification and mandatory payload-free audit write commit together; audit failure rolls them all back. Duplicate/concurrent decisions return a conflict rather than approving twice.

Old mutation endpoints `/api/auth/profile`, `/api/auth/mentor-application`, `/api/mentor/application` and `/api/student/onboarding` return **410** with migration guidance, not a second path around approval. Their active frontend callers have been replaced. Historical records are preserved.

## API contract

All paths below are under `/api/accounts`. Private responses use `Cache-Control: no-store`.

| Method/path | Allowed actor / input |
| --- | --- |
| `GET /profile` | Current account only |
| `PATCH /profile` | Current account; name, phone, language, timezone, goals, interests, study plan and expected `version` |
| `GET /mentor-application` | Own latest draft/submission, approved projection and shared feedback |
| `PATCH /mentor-application` | Own descriptive draft fields, explicit public-consent preference, expected `version` |
| `POST /mentor-application/submit` | Own complete draft; expected `version` |
| `POST /mentor-application/withdraw` | Own pending submission; expected `version` |
| `POST /mentor-profile/hide` | Own approved projection; expected profile `version` |
| `GET /operations/mentors?search=` | Academic ops/admin/owner; at most 100 matching records, pending count |
| `GET /operations/mentors/:id` | Same staff; last **submitted** revision, not a newer private draft |
| `POST /operations/mentors/:id/decision` | Same staff, no self-review; exact application ID/version, decision/reason, private verification note, explicit grant/publication flags |
| `POST /operations/mentors/:id/moderation` | Same staff, no self-moderation; `hide` or `suspend`, reason, expected approved-profile version |

New access grants additionally require admin/owner. Finance/support/ordinary mentors cannot read the new review queue or make decisions. Support's existing learner detail projection excludes goals, interests, study plan and grades. Broad legacy operations screens still need a module-by-module least-privilege audit before production.

## Local request protections

Every local API mutation, including login/logout, requires:

- Exact `X-IRIP-Request: 1` custom header. It is a browser-CSRF marker, **not a secret or authentication credential**.
- Explicit allowed `Origin` matching scheme, host and port. Missing, `null`, foreign and misleading suffix origins are rejected. Cross-site Fetch Metadata is rejected too.
- JSON content type for non-DELETE mutations. Credentialed CORS only permits the explicit loopback allowlist and required headers.

`appFetch()` centrally supplies the custom header; browser Fetch supplies Origin. Existing growth/scholarship clients now use this same transport. Non-browser test clients deliberately supply both headers. Do not use a header marker to bypass authentication or permissions.

The process listens only on loopback. Standard local origins include ports 5000, 5173, 43139 and the configured API port. `dev.mjs` explicitly supplies its selected frontend origin through `LOCAL_WEB_ORIGIN`, validated as a loopback HTTP origin. No Host/X-Forwarded-Host-derived trust or arbitrary production-origin reflection is used.

Login, signup and profile commands have bounded, **in-memory per-process** rate limits. No distributed or production abuse-protection claim is made. Express errors do not return database errors, stack traces or request payloads. Signup no longer writes user-supplied identity content into audit metadata.

## Tests and boundaries

- `server/test-profiles.js`: legacy-schema preservation, idempotent migrations, own-account isolation, forbidden staff roles, self-review denial, exact-origin/header/content-type checks, private partial drafts, immutable revisions, monotonic versions, separate access/publication, consent withdrawal, stale and concurrent commands, audit-failure rollback, immediate suspension, inactive accounts, scoped-grant rejection, rate-limit behavior and unchanged production refusal.
- `client/tests/accounts.test.ts`: runtime contract narrowing and malformed flags/states/versions.
- `client/tests/e2e/accounts.spec.ts`: learner signup/profile/admin integration, member revisions and approval, approved public projection, suspension, stale-save conflict and mobile partial drafts.
- `client/tests/e2e/mentorApply.spec.ts`: guest application without signup, consent/review, staff decision and persistence, error/retry preservation, mobile sizing and prominent navigation entry points.
- Full existing API, unit and browser regressions remain part of acceptance. Hosted-preview tests explicitly block the new account/approval routes and verify that account APIs never enter the static snapshot.

The Vercel deployment remains a **static read-only synthetic demo**, with no account forms, runtime API or private data. The user authorized a main-branch push on 1 November 2026 to publish the visual refresh. That release publishes only the read-only preview, not this authenticated local backend.

## Next slice and production prerequisites

Next local feature: explicit admin-reviewed mentor-to-cohort/project assignments, capacity and reassignment history, then the learner-readiness/project workflow. Review historical assignments during any mentor restoration; approval is not evidence of capacity or technical competence.

Before real accounts: choose production architecture and database/migration strategy; remove synthetic bootstrap from the live path; implement durable revocable sessions, staff MFA, verified email/invites/recovery and all-device password-change revocation; review account/data retention and case-scoped staff access; add supported dependency/security updates, managed secrets, monitoring, backups/restore, HTTPS/proxy/origin policy, distributed rate limits and external acceptance testing. No secret values or provider credentials belong in frontend bundles, URLs, git or chat. `NODE_ENV=production` intentionally still refuses to start the local prototype.
