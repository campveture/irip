# Vercel read-only preview

This repository is configured to deploy a **synthetic read-only public demo**, not the SQLite-backed academy system.

## GitHub integration

Import `campveture/unknown_academy` into a Vercel account/team that can create projects and access the repository through the Vercel GitHub app. Use the repository root, production branch `main`, and Node.js **22.x**. The committed `vercel.json` supplies the settings:

- Framework: Other (`null`), not Express.
- Install: `npm --prefix client ci --include=dev && npm --prefix server ci`.
- Build: `npm run build:preview`.
- Output: `client/dist-preview`.
- No environment variables, database credentials or API tokens are needed for the site.

Once linked, pushes to `main` trigger production-demo builds; other supported Git branches produce previews according to Vercel project settings. Importing the repository and approving GitHub-app access requires the account owner's permissions. A token that cannot create projects cannot complete that step.

Do **not** deploy `server/server.js` as a Vercel function or select `server/` as the root. Do not disable its production guard, upload `server/data.sqlite`, or set production `NODE_ENV` to development to bypass protections.

## What the build publishes

`build-preview.mjs` type-checks the client, builds it with `VITE_READ_ONLY_PREVIEW=1`, and invokes `server/export-readonly-demo.js`. The exporter **forces a new in-memory synthetic database**, captures only allowlisted public GET responses and closes it. The final output contains static assets plus `demo-snapshot.json`, not a database, account export or running API. Source maps are omitted.

The client displays a hosted read-only notice in addition to the exact existing demo disclaimer. Account, portal, contact, application, certificate-lookup and legacy checkout routes show an explanation instead of interactive services. The narrowly allowlisted `/enrol/research-bootcamp/YYYY-MM` route is only a public **demo checkout summary**, read from the same synthetic snapshot: no forms, credentials, payment collection, provider redirect, order or seat reservation. Public catalog searches only filter synthetic data locally. All server API paths are unavailable and write methods are rejected by the hosting routes. No email, payment, enrollment, private-profile or submission service runs.

The monthly bootcamp launch model is evaluated at build time: two consecutive enrollment-eligible intakes, the next discounted to BDT 21,000 and the following at BDT 25,000, starting with January/February 2027. Deadlines are five calendar days before the first class at 23:59 Bangladesh time. Hosted dates, fees and synthetic seats are **frozen snapshots**, not live inventory/quotes or an automatically advancing enrollment service; rebuild to refresh them. The full local API computes the window on each request without modifying legacy cohorts/orders.

Security headers disable embedding and native form actions; `robots.txt` and `X-Robots-Tag` discourage indexing. These are demo safeguards, not a production security/privacy sign-off. Vercel may retain standard hosting/security logs. No real learner information should be supplied.

## Local verification

```powershell
npm run build:preview
$env:PW_CHANNEL='msedge'
npm run test:preview
```

For a manual static check, run `npm run serve:preview` and open `http://127.0.0.1:43140`. It has no database or authentication service. The four isolated preview browser scenarios check public details, no runtime API calls, blocked private/forms routes, write rejection, snapshot boundaries, deployment headers and mobile navigation.

The full local application is unchanged: `npm run build`, `npm test`, `npm run test:e2e`, and `npm run dev` still use the separate Express/SQLite path. `npm run build` writes `client/dist`; `npm run build:preview` writes `client/dist-preview`.

## Full-system deployment remains separate

Persistent storage and durable sessions, production identity/CSRF/security controls, privacy/retention approval, backups and deployment acceptance are prerequisites for live accounts. The current server intentionally rejects production startup. Payment, streaming, staffing, placements and payouts remain separately gated. A GitHub integration does not resolve those requirements.

Never commit Vercel tokens. Revoke any token shared in chat and prefer a local Vercel CLI sign-in or appropriately scoped credentials supplied outside the repository.
