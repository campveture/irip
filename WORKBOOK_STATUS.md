# Workbook implementation status

Source: `website_skull.xlsx` (28 sheets, 81 page/screen entries, 24 acceptance scenarios, 12 decisions). The workbook is a proposed specification. Its decision register is still unconfirmed.

## Working locally

- One-process run path: `npm run build`, then `npm run serve`; browser and API share `http://localhost:43137`.
- Public catalog, projects, mentor directory, certificate lookup, inquiries, and draft policy pages.
- Account profile, password change, notification consent, learner/mentor/admin workspaces, and scoped local demo records.
- P1 public resources, events, stories, ideas, partner and internship pages; staff curation keeps drafts private and checks publication evidence.
- Local event registration, private idea drafts and moderation request, and internship application for an approved published opportunity.
- Enrollment, admission-offer, checkout and order-status screens read actual local records and explain the approval gate. No purchase or payment action is enabled.

## Pending decisions and integrations

All 12 entries in the workbook's `26 Decisions` sheet remain unconfirmed. In particular, academy identity, first domain, approved curriculum/faculty, price/capacity, intake schedule, admission criteria, completion rules, payment provider, refund/access policy, mentor contracts, data/IP policy, subscription scope, and final brand/translations require owners to decide. Commercial actions remain blocked by request.

The current prototype has no verified payment or refund settlement, email verification/recovery, MFA, protected media provider, live meeting provider, recurring billing, durable notification worker, backup/restore process, or production deployment. Some admin/academic review screens are read-only until their policies and approvals are defined. P2 adaptive recommendations need approved skill evidence and evaluation criteria.

## Verification

- `npm run build` passes.
- `npm test` passes the demo API suite (54 checks), expansion curation/flow checks, and admin workspace access checks. These are local synthetic tests.
- Headless Chrome rendered the Programs and My Research Ideas pages without JavaScript console errors after the blank-page spinner error was fixed.
- The combined server returned HTTP 200 for the public pages and API endpoints checked on port 43137.

The workbook's 24 staging acceptance scenarios are not marked passed by these checks. Payment, recovery, concurrency, accessibility, restore, and full purchase-to-learning-to-refund scenarios still require their approved policies, integrations, and dedicated staging verification.
