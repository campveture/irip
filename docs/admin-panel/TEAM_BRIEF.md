# Phase 3 addendum (read this first; the Phase 2 brief below still applies)

The product owner asked for three things:
1. **Every edit screen shows the public page (or learner view) live, with proper Edit buttons on it.**
2. **More control for admin and the other roles.**
3. **Every logic and workflow reviewed.**

### Live preview standard (mandatory for every editor whose content is seen by visitors or learners)
- Use `client/src/components/admin/preview/PreviewKit.tsx`: `EditorWithPreview` (layout: form | preview, Edit/Preview tabs on phones, Desktop/Phone width switch, "View live page"), `EditSection target="x"` (wrap each form section), `EditSpot target="x" label="headline"` (wrap each editable block inside the public component), `useInPreview()`. Read its header comment.
- The preview must render the **same presentational component** the real public page or learner screen renders. If a public page fetches its own data, split it into `XView({data})` (pure, props only) + a thin page that fetches and renders `XView`. Put `EditSpot`s inside `XView`: they render nothing extra on the real site.
- The preview updates as you type, using the unsaved draft. Every visible editable block has an Edit button that jumps to and focuses its form section.
- Show what visitors see now vs the draft (badge: Draft / Published / Changes not yet published).
- Unit test that the view renders the draft values (e.g. with `react-dom/server` `renderToStaticMarkup`, which is available) and that `EditSpot` renders no button outside a preview.

### Phase 3 ownership (only edit what you own; same rules as Phase 2)
| Agent | Owns |
|---|---|
| **P1. Website previews** | `components/admin/website/**`, `components/home/**`, public `Home/About/FAQ/HowItWorks/Policy/Contact/Teach.jsx`, `Footer.jsx`, `server/admin/content-*.js` (bug fixes only) |
| **P2. Program & curriculum previews** | `components/admin/programs/**`, public `ProgramDetail/CourseDetail/Programs.jsx`, `components/programs/**`, `components/catalog/**`, `components/courses/**`. For lesson and assignment previews, extract presentational views from `components/learner/LearnerCourses.tsx` / `LearnerAssignments.tsx` (you may edit those two files only to extract views; keep behaviour identical). `server/admin/curriculum-*.js` (bug fixes only) |
| **P3. Projects & cohorts previews + supervisor tools** | `components/admin/projects/**`, `components/admin/CohortTeaching.tsx`, `components/projects/**`, public `Projects/PublicProjectDetail.jsx`, `server/admin/teaching-*.js`, `server/admin/cohort-service.js`, `server/admin/routes/teaching.js`, project routes in `server/routes/mentor.js`, mentor project pages |
| **P4. Enrolment & payment controls** | `server/admin/enrollment-*.js`, `server/admin/routes/enrollments.js`, `server/admin/schema/enrollments.js`, `server/test-enrollment-controls.js`, `client/tests/enrollmentControls.test.ts`, new `components/admin/enrollments/**`; small edits to `components/admin/operations/**` (Learner 360, Finance screens) |
| **P5. Account controls, announcements, extensions, certificate preview** | `server/admin/account-*.js`, `server/admin/routes/accounts.js`, `server/admin/schema/accounts.js`, `server/test-account-controls.js`, `client/tests/accountControls.test.ts`, new `components/admin/accounts/**`; small targeted edits to `server/routes/auth.js`, `client/src/contexts/AuthContext.tsx`, `client/src/pages/account/Security.jsx`, `server/routes/mentor.js` (announcement + extension routes only), `server/routes/student.js` (announcement + extension reads only), `components/learner/**` (showing announcements/extensions only), `components/mentor/**` (announcement + extension UI only), `components/admin/operations/CertificatesAdmin.tsx` and public `CertificateVerify.jsx` (preview only) |

New capabilities already exist in `server/admin/policy.js`: `enrollments.manage`, `finance.record_payment`, `accounts.reset_password`, `announcements.post`, `assignments.extend`. New admin routers are mounted at `/api/admin/enrollments` and `/api/admin/accounts`. Schema hooks `server/admin/schema/{enrollments,accounts}.js` exist. Test placeholders exist and are registered. **No new navigation items**: put new controls inside existing screens.

Ports for your server test: P4 → 5067, P5 → 5068. P1–P3 extend their existing tests (5081/5062/5063).

---

# Team brief: making the panel fully editable and usable (Phase 2)

Six developers (agents) are working **at the same time in the same working tree**. Read this whole file before you change anything. Also read `docs/admin-panel/ADMIN_PANEL_PLAN.md` (rules, security, review checklist) and `CLAUDE.md`-level context: this is the IRIP local demo (`server/` Express + better-sqlite3, `client/` React + Vite + Tailwind, TypeScript strict for new code).

## The goal (from the product owner)
1. **Everything a visitor or learner sees on the site must be changeable from the admin panel** by a non-technical person: no code, no JSON, no Markdown syntax knowledge needed. Use plain forms: text fields, text areas, lists with "Add item / Remove / Move up / Move down", dropdowns, date pickers, toggles, and Save, with a clear "Saved" confirmation.
2. **No unnecessary pages.** A page exists only if someone uses it regularly. Merge thin pages. Do not add new navigation items beyond those already in `client/src/components/PortalLayout.jsx` (the tech lead has fixed the navigation).
3. **The learner, mentor and admin panels must actually work**: every button does something real, or it is removed.
4. **Production-ready UI/UX** (see the standard below).

## Ownership: only edit files you own
| Agent | Owns (create/edit freely) | May make small, targeted edits to |
|---|---|---|
| **A. Website content** | `server/admin/content-*.js`, `server/admin/routes/website.js`, `server/admin/schema/content.js`, `server/test-website-content.js`, `client/src/components/admin/website/**`, `client/tests/website.test.ts`, public pages `client/src/pages/public/{Home,About,FAQ,HowItWorks,Policy,Contact,Teach}.jsx`, `client/src/components/home/**`, `client/src/components/Footer.jsx` | `server/routes/public.js` (only `/pages/:key`, plus new `/site` endpoint) |
| **B. Programs & curriculum** | `server/admin/curriculum-*.js`, `server/admin/routes/curriculum.js`, `server/admin/schema/curriculum.js`, `server/test-curriculum.js`, `client/src/components/admin/programs/**`, `client/tests/curriculum.test.ts` | `server/routes/public.js` (program/course endpoints only), `client/src/pages/public/{ProgramDetail,CourseDetail,Programs}.jsx` |
| **C. Cohorts, classes & projects** | `server/admin/cohort-service.js`, `server/admin/teaching-*.js`, `server/admin/routes/teaching.js`, `server/admin/schema/teaching.js`, `server/test-teaching-projects.js`, `client/src/components/admin/CohortTeaching.tsx`, `client/src/components/admin/projects/**`, `client/tests/teaching.test.ts`, mentor project pages `client/src/pages/mentor/MentorProject*.jsx`, learner project pages `client/src/pages/student/{StudentProjects,ProjectDetail}.jsx` | `server/routes/mentor.js` (project routes only), `server/routes/student.js` (project routes only), `server/routes/public.js` (project endpoints only) |
| **D. Learner portal** | `client/src/pages/student/**` **except** project and support pages, `server/admin/schema/learner.js`, `server/test-learner-portal.js`, `client/tests/learnerPortal.test.ts`, new files under `client/src/components/learner/**` | `server/routes/student.js` (dashboard, learning, lessons, assignments, calendar, billing, certificates and notifications routes only) |
| **E. Mentor panel** | `client/src/pages/mentor/**` **except** project pages, `server/admin/schema/mentor.js`, `server/test-mentor-panel.js`, `client/tests/mentorPanel.test.ts`, new files under `client/src/components/mentor/**` | `server/routes/mentor.js` (everything except project routes; keep the grading rules in ADMIN_PANEL_PLAN §3.4) |
| **F. Operations** | `client/src/components/admin/operations/**`, `server/admin/operations-*.js`, `server/admin/routes/operations.js`, `server/admin/schema/operations.js`, `server/test-operations.js`, `client/tests/operations.test.ts`, `client/src/pages/admin/{AdminLearners,AdminLearnerDetail,AdminAdmissions,AdminFinance,AdminReports}.jsx`, learner support pages `client/src/pages/student/{StudentSupport,SupportTicket}.jsx` | `server/routes/student.js` (support routes only), `server/routes/admin.js` (existing support/crm/certificates/dashboard/learners/admissions/finance/reports handlers only) |

**Shared files that nobody edits:** `client/src/App.jsx`, `client/src/components/PortalLayout.jsx`, `server/admin/policy.js`, `server/db.js`, `server/server.js`, both `package.json` files. If you truly need a change there (a route, a capability), **do not edit them**. List the exact change in your final report and the tech lead will apply it. The routes and capabilities you need already exist (below).

When you edit a shared-by-region file (`public.js`, `student.js`, `mentor.js`, `admin.js`): make small `Edit` calls on your own region only. If you are told a file changed since you read it, re-read it and re-apply. **Never rewrite a whole shared file**, and never revert someone else's change.

## What already exists for you
- **Admin API mount points** (`server/routes/admin.js`): `/api/admin/website/*` → `server/admin/routes/website.js`, `/api/admin/curriculum/*` → `curriculum.js`, `/api/admin/teaching/*` → `teaching.js`, `/api/admin/operations/*` → `operations.js`. These are empty routers: fill them.
- **Capabilities** (`server/admin/policy.js`): `content.edit`, `catalog.read`, `catalog.publish`, `curriculum.edit`, `cohorts.read`, `cohorts.edit`, `cohorts.assign_mentors`, `projects.read`, `projects.edit`, `support.read`, `support.respond`, `crm.read`, `crm.manage`, `certificates.read`, `certificates.manage`, `learners.*`, `dashboard.read`, `finance.read`, `reports.read`, `audit.read`. Use `requireCapability('x')` on **every** admin route.
- **Helpers**: `server/admin/validate.js` (`HttpError`, `fail`, `body` allowed-field guard, `text`, `reason`, `id`, `oneOf`, `handle`) and `server/admin/history.js` (`recordChange` for access decisions; for content edits write `audit_events` directly with `payload_logged:false`).
- **Schema hook**: put `CREATE TABLE IF NOT EXISTS …` and guarded `ALTER TABLE … ADD COLUMN` in your `server/admin/schema/<area>.js` (already called from `initSchema`). Additive only. Seed defaults **equal to today's hard-coded text** so the public site looks identical until someone edits it.
- **Client routes** (already in `App.jsx`): `/admin` → `operations/AdminHome.tsx`; `/admin/website` → `website/WebsiteContent.tsx`; `/admin/programs`, `/admin/programs/:id` → `programs/ProgramList.tsx`, `ProgramEditor.tsx`; `/admin/cohorts`, `/admin/cohorts/:id` → `CohortTeaching.tsx` (`CohortList`, `CohortDetailPage`); `/admin/projects`, `/admin/projects/:id` → `projects/ProjectList.tsx`, `ProjectEditor.tsx`; `/admin/support` → `operations/SupportDesk.tsx`; `/admin/inquiries` → `operations/Inquiries.tsx`; `/admin/certificates` → `operations/CertificatesAdmin.tsx`. The placeholder files exist; replace their contents (keep the default export name).
- **Client helpers**: `client/src/components/admin/AdminShared.tsx` (`AdminPage`, `ResourceView`, `ReasonField`, `Feedback`, `ChangeHistory`, `cardClass`), `client/src/components/accounts/accountModel.ts` (`fieldClass`, `actionClass`, `secondaryClass`), `client/src/components/accounts/useAccountResource.ts` (loading/error/ready resource hook), `client/src/lib/api.js` (`api.get/post/patch/del`; it adds the CSRF header automatically).
- **Tests**: your server test file and client test file already exist as placeholders and are already registered in `npm test`. Replace them with real checks.

## Engineering rules (same as ADMIN_PANEL_PLAN §9)
- Server: thin routes, synchronous services inside `db.transaction`, allowed-field lists, length limits, explicit SELECT columns, conditional updates for state changes (→ 409 on conflict), audit every write. No user ID, role or price is ever taken from the request body.
- Content edits use **optimistic concurrency**: every editable record has a `version` integer; a save sends the version it loaded; a mismatch → 409 "Someone else changed this. Reload to see their version."
- Public endpoints only ever return **published** content.
- Client: new code is TypeScript (`.tsx`/`.ts`). Parse every API response with a parser in a `*Model.ts` file (pattern: `client/src/components/admin/adminModel.ts`) and unit test the parsers and any rule mirrors.
- Don't add npm dependencies.

## UI/UX production standard (every screen you touch)
- **Plain language** labels and help text written for a non-technical office user. No internal words like "slug", "entity" or "payload" on screen. Say "Web address (the part after /programs/)" instead of "slug".
- **Every state is designed:** loading (`role="status"`), empty (explains what to do next, with a button), error (`role="alert"` + Retry), success ("Saved", announced with `role="status"`), and a disabled reason when an action isn't allowed.
- **Forms:** visible `<label>` for every field, required markers, inline validation messages next to the field, character limits shown on long text, Save disabled while saving, no lost input after a failed save, a warning when leaving with unsaved changes (at least a confirm before discarding inside the screen), and confirmation before destructive actions.
- **Previews:** wherever content goes public, show "View on site" (opens the public page) and a clear Draft/Published badge.
- **Layout:** use the existing Archive Indigo tokens/classes (brand-*, ivory surfaces, `cardClass`, rounded-2xl cards, `actionClass`/`secondaryClass` buttons). Must work at 360px phone width with no horizontal scroll (tables become stacked cards or scroll inside their own container). Touch targets ≥ 44px.
- **Accessibility:** keyboard reachable, visible focus, headings in order, `aria-*` on toggles/expanders, colour is never the only signal, text contrast ≥ 4.5:1.
- **Consistency:** the same pattern for lists (search/filter at top, then cards or rows, then pagination or "load more") and editors (header with status badge + View on site, sections as cards, sticky or bottom Save bar).
- Remove dead ends: no buttons that do nothing, no "coming soon", no placeholder numbers. If a feature is disabled for policy reasons (payments, email), say so in one line and don't show a fake control.

## Verifying your work
- Run **only**: `npm --prefix server test` is too broad while others are editing. Run your own server test (`node --preserve-symlinks --preserve-symlinks-main server/test-<area>.js` from `server/`) **and** `node --preserve-symlinks --preserve-symlinks-main server/test-demo.js` + `server/test-admin-access.js` if you touched shared routes. For the client, run `npm --prefix client run typecheck` and `node --import tsx --test tests/<yourArea>.test.ts` (from `client/`).
- **Do not** run Playwright, `npm run build` or `npm run dev`. They share ports and the `dist/` folder with other agents. The tech lead runs browser tests at the end.
- Typecheck errors in files you don't own: ignore them (another agent is mid-edit), but make sure none come from your files.
- Do not commit. Do not touch git state.

## Final report (keep it under 300 words)
What you built (screens + endpoints), which rules are enforced, the test results you ran, any change you need in a shared file (exact snippet), and anything you deliberately left out and why.
