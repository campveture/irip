---
name: academy-code-organization
description: Organize or refactor Unknown Academy React/Vite and Express/SQLite code incrementally. Use when adding modules, splitting large components/routes, defining frontend/API contracts, untangling imports, or placing tests; preserve behavior, authorization, private data boundaries, and existing work.
metadata:
  author: unknown-academy-local
  provenance: locally-authored-not-downloaded
---

# Academy code organization

Locally authored for Unknown Academy; not a downloaded upstream skill.
These conventions support reviewability; they do not guarantee secure behavior.

## Start with the actual repository

1. Read relevant instructions, inspect `git status`, and identify user-owned changes.
2. Trace one feature from `client/src` through API calls to `server/routes` and SQLite.
3. Read relevant tests and package scripts before proposing a new folder or abstraction.
4. Reuse the nearest established pattern unless it conflicts with a security boundary.
5. Separate behavior changes from moves/refactors so each diff can be reviewed.
6. Avoid broad renames, formatting sweeps, generated files, and dependency churn.

## Keep feature boundaries visible

- Keep page composition under existing `client/src/pages` conventions.
- Extract reusable UI to `client/src/components`; keep feature-only UI near its feature.
- Put API transport and decoding behind `client/src/lib` or an existing feature client.
- Keep new contract types near their feature or in a small agreed contract-only module.
- Keep Express transport concerns in routes and reusable policy in middleware/services.
- Follow existing server feature modules; introduce a service only when it adds clarity.
- Keep SQL access on the server; do not import database modules into client code.
- Keep tests beside the existing tests for that layer, with focused feature names.
- Do not create a speculative monorepo, framework migration, or generic plugin system.

## Types and dependency direction

- Use strict TypeScript for new frontend and shared contract modules (`.ts`/`.tsx`).
- Preserve strict, unchecked-index, and exact-optional-property checks already enabled.
- Prefer `unknown` plus runtime narrowing over `any`, assertions, and suppression flags.
- Represent approval states with discriminated unions and exhaustive transitions.
- Use explicit return types at API, validation, persistence, and permission boundaries.
- Share DTOs, not ORM/database records, session objects, or privileged internal fields.
- Keep shared contracts free of Node APIs, SQLite handles, and server environment access.
- Preserve the current CommonJS server boundary when integrating legacy modules.
- Add typed server modules only with a runnable, checked path; explain toolchain gaps.
- Do not add compiler/package configuration merely to make a refactor look complete.
- Keep dependencies directed: UI -> API client -> DTO; route -> policy/service -> DB.
- Avoid circular imports and global mutable request/actor state.

## React components and API calls

- Prefer small components with explicit props and one coherent responsibility.
- Keep render pure; put user-triggered mutations in event handlers, not effects.
- Derive inexpensive display values during render; avoid duplicated state.
- Extract hooks for meaningful lifecycle reuse, not to disguise a large component.
- Include cancellation/stale-result handling for async reads and clean up subscriptions.
- Keep loading/error/empty/conflict behavior visible after splitting a component.
- Centralize local API base, credentials, custom CSRF header, and error handling.
- Keep profile revision IDs in mutation contracts so stale decisions can be rejected.
- Do not use optimistic approval/publication unless server-confirmed semantics are safe.
- Do not hide a failed authorization request behind a successful mock fallback.

## Backend organization must preserve policy

- Keep authentication, active-account checks, ownership, and admin policy explicit.
- Route extraction must not drop middleware or create an unguarded alias endpoint.
- Keep exact-origin/custom-header CSRF checks on every mutation path after moves.
- Enforce staff capabilities across legacy and new paths; one portal is not one admin identity.
- Keep immutable submitted snapshots separate from mutable drafts and public DTOs.
- Couple review decisions, approved pointers, and mandatory audit writes transactionally.
- Reject stale expected revisions rather than silently applying last-write-wins.
- Keep versioned migrations distinct from optional synthetic fixtures and demo seeds.
- Do not mutate existing user data during module import or harmless server startup.
- Keep private values out of public exports, logs, fixtures, and client bundles.
- Preserve the production guard in `server/server.js`; never bypass it for testing.

## Performance guidance without framework drift

- Consult `vercel-react-best-practices` selectively for the changed React concern.
- Read `../../../docs/development-skills.md` for its source and compatibility limits.
- React 18/Vite is not Next.js: use supported React.lazy/import patterns when needed.
- Do not add Next.js, Server Components, SWR, analytics, or new packages by suggestion.
- Do not copy React 19-only Activity/useEffectEvent/async-transition examples here.
- Preserve public typed package entry points; avoid unsupported private deep imports.
- Measure before memoizing or introducing cross-request caches; security comes first.
- Keep authorization and mandatory audit ordering ahead of speculative parallelization.

## Finish with a small reviewable change

- Run the narrow affected tests, client typecheck, then the relevant regression suite.
- Inspect commands for seed writes, real database access, external calls, and deployment.
- Use an isolated synthetic SQLite test database; preserve the working local database.
- Check owner/other-user/admin behavior after moving routes or policy helpers.
- Check pending/private data is absent from public APIs and static preview exports.
- Verify imports and routes still resolve; check case-sensitive paths and circularity.
- Inspect the diff for behavior drift, accidental removals, and unrelated file changes.
- Report the module map, changed behavior, actual test results, and known limitations.
- Do not deploy, commit, add secrets, or broaden the task without authorization.
