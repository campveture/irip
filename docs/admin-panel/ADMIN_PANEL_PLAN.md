# IRIP Operations (Admin) Panel — Plan, Rules and Review Guide

_Last updated: 8 November 2026. Status: Phase 1 implemented and tested locally. This is still the local demo; nothing here is production-ready until Phase 4._

This document is written for the next developer or AI model who works on, reviews, or approves this code. Read it before changing anything under `server/admin/`, `server/routes/admin.js`, `server/routes/mentor.js` (grading), or `client/src/components/admin/`.

---

## 1. Who uses the panel and what they need

| Person | Workspace | What they need to do | What they must never be able to do |
|---|---|---|---|
| **Learner** | `/app` | Study published lessons, submit work, see feedback/grades, resubmit when asked, get notified | See other learners, unpublished content, or any staff screen |
| **Mentor** | `/mentor` | See only the cohorts they are assigned to; review submissions (grade **or** request changes); see their projects | Grade cohorts they are not assigned to; grade their own work; review the same attempt twice |
| **Academic ops** | `/admin` | Catalog drafts, cohorts, **assign/remove mentors**, admissions decisions, mentor approval, learner academic records | Grant staff roles, suspend accounts, see finance figures |
| **Support** | `/admin` | Tickets, learner contact context | Grades, finance, cohorts, staff access |
| **Finance** | `/admin` | Orders, refunds, finance reports, cash totals | Learner academic records, cohorts |
| **Admin** | `/admin` | Everything above + staff access for non-privileged roles, audit log, suspend/reactivate learners | Create other admins/owners; remove an admin; change own roles |
| **Owner** | `/admin` | Everything, including managing admins and owners | Change own roles; leave the system with no admin/owner |

## 2. Permission model (single source of truth)

`server/admin/policy.js` maps **capabilities → roles**. Every `/api/admin/*` route declares exactly one capability with `requireCapability(...)`, and any path not declared returns 404 (**default deny**). The client asks `GET /api/admin/modules` for its `capabilities` and only uses them to hide navigation. **The server always decides.**

| Capability | academic_ops | support | finance | admin | owner |
|---|:-:|:-:|:-:|:-:|:-:|
| dashboard.read (cash totals redacted without finance.read) | ✓ | ✓ | ✓ | ✓ | ✓ |
| learners.read | ✓ | ✓ | | ✓ | ✓ |
| learners.read_academic (grades, profile detail) | ✓ | | | ✓ | ✓ |
| learners.manage_status (suspend/reactivate) | | | | ✓ | ✓ |
| catalog.read / catalog.edit_draft | ✓ | | | ✓ | ✓ |
| academics / mentors / projects / certificates .read | ✓ | | | ✓ | ✓ |
| cohorts.read / cohorts.assign_mentors | ✓ | | | ✓ | ✓ |
| admissions.read / admissions.decide | ✓ | | | ✓ | ✓ |
| crm.read | ✓ | | | ✓ | ✓ |
| support.read | | ✓ | | ✓ | ✓ |
| finance.read / finance.approve_refund (still 501) | | | ✓ | ✓ | ✓ |
| reports.read | ✓ | | ✓ | ✓ | ✓ |
| audit.read, automations.read, settings.read, staff.read, staff.manage | | | | ✓ | ✓ |

Extra rule in `grantableRoles()`: **admin** may grant/revoke `academic_ops`, `finance` and `support`. Only an **owner** may grant/revoke `admin` and `owner`.

Roles are read from `role_grants` (active account, `scope='global'`, not expired; mentor roles also need an approved mentor profile) **on every request**. A revoked role or a suspended account stops working on the next request. Nobody has to sign out.

The **first owner** can only be created from the server shell: `node server/scripts/grant-owner.js person@example.com`. The seed data has an admin but no owner.

## 3. Workflows and their rules

Every operational decision below needs a **reason of 10–1000 characters**. It is written to `access_changes` (an append-only history with who, what, why and when), to `audit_events` (with `payload_logged:false`) and, where relevant, to an in-app notification for the person affected. All of this happens in **one transaction** with the state change, so either everything is saved or nothing is.

### 3.1 Staff access — `server/admin/access-service.js`, UI `/admin/staff`
- Only these staff roles can be managed here. Mentor access comes from mentor review (`profiles/service.js#decide`), and learner access comes from signup.
- Nobody can change their own roles.
- The target account must be **active with a verified email**. No accounts are created here.
- An optional expiry date can be set, at most 366 days ahead. It means the end of that day in Bangladesh time.
- Granting a role the person already holds returns 409. Revoking a role they don't hold returns 404.
- Removing admin/owner is refused if no other active admin or owner would remain.

### 3.2 Learner account status — `server/admin/learner-service.js`, UI: Learner 360 → Account status
- The only allowed changes are `active → suspended` and `suspended → active`. The update only applies if the account is still in the status the reviewer saw (`AND status = ?`), so a second click gets a 409.
- This only applies to plain learner accounts. Accounts with staff or mentor access are refused here and must be handled in Staff access or Mentor operations.
- Suspension keeps all records: nothing is deleted. Sessions die on the learner's next request, and login is refused.

### 3.3 Teaching assignment — `server/admin/cohort-service.js`, UI `/admin/cohorts/:id`
A teaching assignment is what gives a mentor access to a cohort. Every mentor query in `routes/mentor.js` is filtered by `teaching_assignments`.
- An eligible mentor has an active account, an approved mentor profile and an active `mentor` grant.
- Staff cannot assign themselves.
- Closed, archived or completed cohorts cannot gain mentors.
- **The last mentor cannot be removed while submissions are waiting to be graded.**
- The cohort list warns when learners are enrolled but no mentor is assigned.

### 3.4 Submission review (LMS core loop) — `routes/mentor.js`, `routes/student.js`
```
learner submits ──► submitted ──mentor──► graded (score 0–100 + feedback)       [final]
                         │
                         └──mentor──► changes_requested (feedback only)
                                         │ learner resubmits (attempt + 1 ≤ max_attempts)
                                         ▼
                              old attempt → superseded, new attempt → submitted
```
- A mentor can only review cohorts they teach, and never their own submission. Each attempt can be reviewed once: the state change is conditional, so a second review gets a 409.
- "Request changes" is refused when no attempts remain. Feedback must be 10–5000 characters.
- The learner is notified either way. The learner's assignment list shows only the **latest** attempt and its latest review.
- Submitting is check-and-insert inside one transaction, so a double click can't create two attempts. Submissions are 10–20,000 characters.
- Lessons from unpublished courses return 404, even to enrolled learners.

### 3.5 Admission decisions — `routes/admin.js` `/admissions/:id/outcome`
- The outcome must be one of `offered | waitlisted | rejected | withdrawn`, and a reason is required.
- Only an undecided or **waitlisted** application can receive a new outcome. Other outcomes are final, and a later attempt to change them gets a 409.
- Reviewers can't decide their own application. The applicant is notified.

### 3.6 Mentor approval (already existed, unchanged) — `server/profiles/service.js`
This uses versioned revisions. Approval, publication and access are three separate decisions. Only admin/owner can grant mentor access, nobody can review themselves, and suspension revokes mentor grants.

## 4. Security model — what protects what

| Threat | Protection | Where |
|---|---|---|
| Cross-site request forgery | Custom `X-IRIP-Request` header + exact Origin allowlist + Fetch-Metadata; JSON only | `middleware/security.js` |
| Session fixation | `session.regenerate` on login/signup; httpOnly, SameSite=Lax cookie | `routes/auth.js`, `server.js` |
| Privilege escalation | Capability per route; role hierarchy; no self-changes; owner only via CLI | `admin/policy.js`, `admin/access-service.js` |
| Mass assignment | Each command accepts only an explicit list of fields; unknown fields → 400 | `admin/validate.js#body` |
| Injection | Prepared statements only. The audit `action` filter must match `^[a-z0-9_]{1,64}$` | all services |
| Race conditions / double submit | Transactions + conditional UPDATE … WHERE state = expected → 409 | all commands |
| Data leakage | Explicit SELECT projections; finance figures redacted; client parsers copy only known fields | services, `adminModel.ts` |
| Error leakage | `handle()` maps known errors; anything else → generic 500, logged server-side | `admin/validate.js` |
| Abuse | 60 commands/minute per signed-in staff member on the admin router; login/signup limits per IP; failed sign-ins limited per email+IP (10) with a per-email backstop (50) | `routes/admin.js`, `server.js` |
| Repudiation | Append-only `access_changes` + `audit_events`; nothing in the UI can delete them | `admin/history.js` |

## 5. Known gaps (be honest before any launch)

1. **Demo-only infrastructure.** `server.js` refuses to start with `NODE_ENV=production`. Things that don't exist yet: email delivery (verification, recovery, notifications), MFA, a shared session store (sessions live in memory), a distributed rate limiter and a payment gateway.
2. **Refund approval** returns 501 until finance policy and the payment provider are set up.
3. **Published-catalog editing** is blocked until versioning and academic approval exist.
4. **Due dates and late policy** are not enforced. That policy hasn't been approved.
5. **Older screens** (`pages/admin/*.jsx`, plain JS) still read some endpoints without runtime parsing. New work goes into strict TypeScript under `components/admin/`.
6. The duplicate-free grade rule is enforced by logic, not by a UNIQUE index, because older databases may already contain duplicate grades. Clean them up during the Phase 4 migration.

## 6. Roadmap

| Phase | Scope | Status |
|---|---|---|
| **1. Foundation** | Capability policy + default deny, staff access, learner suspension, teaching assignment, audit log viewer, admissions hardening, review loop with "request changes", tests | ✅ Done (this change) |
| **2. Everything editable + usable panels** | Website content editor (homepage, pages, site details, publish/history/restore); programs & curriculum builder with versioning and editable launch pricing (`programs.fee` + `programs.launch_discount` drive `launch-plan.js`); cohort create/edit + class schedule; research projects editor, public directory redesign, supervisor/staff application decisions; decluttered learner portal (9 nav items, focused home, lesson progress); mentor panel (attendance, class notes, grading queue, saved availability, profile editor with live public preview + private "For IRIP only" details); operations action centre, support desk, inquiries, certificates issue/revoke. Rules per area live in each service's header comment; team ownership in `TEAM_BRIEF.md`. | ✅ Done |
| **3. Live previews + operational controls + review** | Every editor shows the real public/learner component live in a scaled device frame (`client/src/components/admin/preview/PreviewKit.tsx`) with per-block Edit buttons; enrolment controls (enrol/transfer/pause/withdraw/complete) and offline payments against instalments; temporary password reset with forced change; cohort announcements; per-learner deadline extensions; supervisor milestone editing; certificate preview. Three independent reviews (learner, mentor, staff/security) — every confirmed finding fixed with a regression test (`server/test-security-hardening.js` and per-area suites); legacy `/api/crm` and `/api/finance` removed. | ✅ Done |
| **3b. Remaining** | Delete out-of-nav learner features (scholarships, growth, alumni, recorded courses, course studio) if the owner confirms; `/mentors` list cards still use stock portraits; historic demo order ORD-2026-0001 has no instalments; completed learners lose lesson access (decide policy) | Planned |
| **3. Academic quality** | Curriculum versioning + approval, rubric-based grading, grade appeals, certificate issuance tied to completion rules | Planned (policies needed) |
| **4. Production readiness** | Postgres; schema and migrations through an ORM (see 6.1); email provider; MFA for staff; Redis sessions/rate limits; payment gateway; backups; security review | Needs your decisions |

### 6.1 Database layer decision (Prisma), recorded but not done yet
Prisma was requested "for solid performance". Recommendation: **do not migrate the current SQLite demo to Prisma now.**
- Today every route uses synchronous `better-sqlite3`. That is already one of the fastest ways to use SQLite. Prisma adds an async query engine on top, so it is not faster on SQLite.
- Moving means rewriting about 50 tables' worth of queries and every route's transaction logic. Nothing user-visible improves, and there's a real risk of breaking the guarantees in section 3.
- Where Prisma **is** worth it is the **Phase 4 move to Postgres**: a typed schema, reviewed migrations and safer refactors. Do it then, one module at a time (start with `admin/` services, which are already isolated behind service functions), with the tests in section 8 as the safety net. Drizzle is a lighter alternative worth comparing at that point.

## 7. Code layout and conventions

```
server/admin/
  policy.js           capabilities, roles, module list (the only place access rules live)
  validate.js         HttpError, body/text/reason/id/oneOf guards, handle() route adapter
  history.js          recordChange() → access_changes + audit_events + notification
  access-service.js   staff roles            learner-service.js  suspend/reactivate
  cohort-service.js   teaching assignments   audit-service.js    audit read model
server/routes/admin.js   thin HTTP layer: route → cap(...) → service
server/scripts/grant-owner.js   first-owner bootstrap (shell only)
client/src/components/admin/
  adminModel.ts       response parsers + UI mirrors of server rules (unit tested)
  AdminShared.tsx     page frame, loading/error view, reason field, history list
  StaffAccess.tsx  AuditLog.tsx  CohortTeaching.tsx  LearnerAccountControl.tsx
```
Conventions:
- Routes stay thin; business rules live in services that are synchronous and run inside `db.transaction`.
- Services throw `HttpError(status, message)`. Never send raw errors to the client.
- Every new command needs a capability, an allowed-field list, a reason (if it changes someone's access or record), a conditional update, `recordChange`, and a test.
- Client code parses every response with a function in `adminModel.ts`. Never render unparsed API data in new code.

## 8. How to verify

```
npm run test:api        # 10 suites incl. server/test-admin-access.js (authz matrix, escalation, races, LMS loop)
npm run test:client     # typecheck + 49 unit tests incl. client/tests/admin.test.ts
npm run build && npx --prefix client playwright test tests/e2e/adminPanel.spec.ts
```

## 9. Review checklist (use before approving any change here)

- [ ] Every new `/api/admin` route has `requireCapability(...)`, and the capability exists in `policy.js`.
- [ ] No route trusts a user ID, role or price from the request body; identity comes from the session.
- [ ] Each command has an allowed-field list and length limits, and returns 400/403/404/409 correctly.
- [ ] State changes are conditional and run in a transaction with their history record.
- [ ] Nobody can act on themselves where that would be a conflict (roles, status, assignment, review).
- [ ] SELECTs list their columns explicitly. No `password_hash`, private notes or finance data reach roles that shouldn't see them.
- [ ] The client parses responses in `adminModel.ts`, and UI hints match the server rules.
- [ ] Tests cover the allowed path **and** at least one forbidden path per role.
- [ ] Docs updated: this file (rules/roadmap) and `WORKBOOK_STATUS.md` (status).
