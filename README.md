# IRIP — Institute of Research, Innovation and Practice

This is a **synthetic, local-only prototype** based on [`website_skull.xlsx`](website_skull.xlsx). The workbook has 28 sheets covering the platform map, 81 screens, flows, decisions, and acceptance scenarios. It is a proposed specification; its commercial and academic decisions have not been approved.

## Run

Requires Node 20+. From this folder, run these commands in one terminal:

```powershell
npm run build
npm run serve
```

Open **http://localhost:43137**. The API and built client are served together on that address. If dependencies are missing, run `npm run setup` first. After editing client files, stop the server with Ctrl+C and run `npm run build` followed by `npm run serve` again. SQLite is created as `server/data.sqlite` on first start. For a fresh *synthetic* dataset, stop the server and remove that file manually (this discards local demo submissions and tickets).

For development, run `npm run dev` from this folder and open the URL printed in the terminal. This starts the API and Vite together, using ports 5000 and 5173 when available. Stop both with Ctrl+C.

Demo accounts (password for each: `demo1234`):

| Workspace | Email |
|---|---|
| Learner | `learner@irip.ac` |
| Second learner | `student2@irip.ac` |
| Mentor | `mentor@irip.ac` |
| Operations | `admin@irip.ac` |
| Academic ops | `academic@irip.ac` |
| Finance | `finance@irip.ac` |
| Support | `support@irip.ac` |

Visit `/app`, `/mentor` and `/admin` after choosing an appropriate account. From the repository root, `npm test` runs API smoke and access-control checks and `npm run build` checks the frontend bundle.

## Current scope

- React routes for public catalog, program/course/mentor details, FAQ and contact, certificates, and learner/mentor/operations workspaces.
- SQLite tables for identity, catalog, cohorts, applications, orders, enrollments, submissions, projects, CRM, tickets, audit and notifications. Seeded dates, names, fees, capacity, orders and certificates are **fictional demonstration data**.
- Interactive local flows include sign-in/sign-up, onboarding, public inquiries into the sample CRM, mentor applications, support tickets, assignment submissions, mentor grading for assigned cohorts, catalog drafts and admissions decisions. Other modules are read-only presentations or placeholders, not operational systems.
- The demo prevents unauthenticated access to private workspaces and some cross-program reads; it is **not** a comprehensive security implementation.

## Deliberately unavailable

No live checkout, verified payment integration, refunds, subscription billing, email verification/recovery, MFA, protected media storage, provider-backed meetings, real notifications, certificate eligibility engine, full prerequisite graph, immutable academic versioning, outbox/reconciliation, backups, legal policy publication, verified mentor claims or production deployment. Payment webhook and refund approval endpoints return `501`; they cannot turn a client request into a settled payment. The server refuses `NODE_ENV=production`.

Do not deploy this app, import real learners/financial data, or treat seeded `paid` records as actual receipts. Sessions use an in-memory store, credentials are public demo credentials, and several administrative/academic operations are intentionally incomplete. Policies are draft placeholders, not legally approved terms.

## Production decision gates (from the specification)

Founder and academic/finance leads must approve IRIP's name/identity, first discipline, fees/discounts/capacity, intake dates/timetable, admissions criteria, completion rules, payment provider, refunds/transfers/access duration, faculty qualifications/agreements, data/ethics/IP/authorship, subscription scope, and brand/translations. Then implement and test the specification's A01–A24 acceptance scenarios using sandbox accounts and provider callbacks, including recovery and accessibility, **before** any public sale.

This demo is a navigation and data-model prototype, not evidence that the 27-point handoff has been fully implemented.
