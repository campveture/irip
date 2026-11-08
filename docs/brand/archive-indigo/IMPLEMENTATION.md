# Archive Indigo implementation

The later user-approved photo-led homepage and academic masthead/menu refinement is documented in [HOMEPAGE.md](HOMEPAGE.md). It supersedes only the original homepage illustration and segmented-navigation appearance described in the initial migration below.

## Scope and sources

- `design.md` and `IRIP indigo shield logo with ivory falcons.png` are the user's supplied files, copied into this folder without modification.
- This is a visual migration of the existing React/Vite interface, not a rebuild or product expansion. User separately requested deployment to the existing read-only Vercel project.
- The user approved a crest-only crop for compact branding. `prepare-logo.py` records its exact source box and generates the proportional header export. The crop's pixels match the source exactly; the full lockup's file hash matches the supplied PNG. These are raster assets, not a vector master or production-certified print artwork.

## Changed boundaries

| Files | Purpose |
| --- | --- |
| `client/src/index.css`, `client/tailwind.config.js` | Single-source Archive Indigo tokens, typography, surfaces, navigation, tabs, inverse sections, focus, control boundaries and metadata legibility |
| `client/index.html` | Source Serif 4 via existing font-loading mechanism, swap/fallbacks; indigo browser theme color; no favicon redesign |
| Shared `IripMark`, `Footer`, `PublicHero`, `PageHeading`, `Button`, `Badge`, `Alert`, `DemoNotice` | New approved raster crop, editorial type, consistent controls and readable semantic states/notices |
| Public-page and catalog/pricing presentational classes | Serif marketing titles, lavender hero actions, flat indigo emphasis, selected/intake boundaries; existing text/state/handlers retained |
| `client/src/lib/charts.js`, `RingProgress.jsx` | Brand/neutral chart presentation references the existing CSS theme; values and calculation/series logic unchanged |
| Seven program/course SVG illustrations | Audited decorative paint-only edits; coordinates, paths, labels and topic assignments unchanged |
| Preview/palette/header tests | Expectations match the approved visual specification; new rendered-contrast, asset-integrity, responsive and failed-font checks |

No API, database, route, authentication, permission, commercial guard, dataset, business copy, formula, date rule, package/lockfile or deployment configuration is changed. Internal dashboards keep sans-serif headings and shared color styling. No real account, payment, message, booking or submission service is deployed.

## Before/after review

The existing full-app browser suite passed all **70 tests before editing**. Matching 1440/390px captures cover Home, Programs, Research Methods Acceleration Pricing, Courses, About and the hosted Contact guard. Captured headings, link text/targets and pricing matched exactly across all 12 states. Screenshots are in `review/`; full capture records and additional screenshots remain under the approved temporary `opencode/irip-archive-before` and `opencode/irip-archive-after` folders.

The preview tests additionally exercise 320, 360, 390, 768, 1024, 1279, 1280 and 1440px widths across Home, Programs, Research Methods Acceleration Pricing, Courses, About, Projects and Mentors. A 640px CSS viewport checks compact reflow equivalent to a 1280px display at 200% zoom; this is **not** a claim that every OS/browser zoom combination was manually certified. Failed-font testing blocks the existing Google font endpoints and verifies readable fallback layout and keyboard-operable mobile navigation.

### Actual verification outcomes

- `npm run build`: **passed**, including strict frontend typechecking.
- `npm run build:preview`: **passed**, exporting the same 36 allowlisted public synthetic responses, with no database/private account export.
- `npm test`: **passed**: all nine API suites (including the 56-check demo suite) and all **39 client unit tests**.
- `PW_CHANNEL=chrome npm --prefix client run test:e2e`: final build **70/70 passed**. This includes catalog/history/retry/filter dialogs; all four program tabs; both launch intakes and installment targets; date/time/capacity boundaries; local learner/mentor/admin workflows, privacy and authorization; header docking, focus, reduced motion and route/hash scrolling.
- `PW_CHANNEL=chrome npm --prefix client run test:preview`: final build **8/8 passed**. This includes asset byte integrity and proportional rendering; actual rendered foreground/background and control-border contrast; keyboard skip/navigation, hover/selected states, font failure and the responsive matrix; plus all existing preview restrictions, disabled portals, no forms/auth cookies, blocked writes, public-only snapshot and no database/source-map exposure.
- A parsed-AST comparison of **24 changed JSX/TSX files** found identical existing event handlers, hooks, route/link targets, form contracts, ARIA attributes, selection and disabled props. Seven SVG comparisons found identical element structure/text/geometry apart from paint attributes. Twelve captured page states retained identical headings/links/pricing with no page errors or horizontal overflow.
- Both supplied source files are retained intact, including intentional Markdown hard-break whitespace. Implementation whitespace checks exclude that untouched source document.

### Review captures

| View | Before | After |
| --- | --- | --- |
| Home, 1440px | [Desktop before](review/before-home-desktop.png) | [Desktop after](review/after-home-desktop.png) |
| Home, 390px | [Mobile before](review/before-home-mobile.png) | [Mobile after](review/after-home-mobile.png) |
| Programs, 1440px | [Catalog before](review/before-programs-desktop.png) | [Catalog after](review/after-programs-desktop.png) |

The new full-resolution crop matches the source pixels exactly; the compact UI image is a conventional proportional raster export. The unchanged full-name logo and crop are kept alongside the 54kB compact version. No runtime dependency was added for artwork preparation.

## Limitations retained

- No new small-format favicon artwork was approved; existing favicon/home-screen icons remain, as instructed by the guide.
- The source logo is a generated raster concept with slight shading/edge noise. No unauthorized cleanup, tracing, recoloring, bird replacement or claim of a vector master is made.
- Source Serif 4 still depends on the existing external font mechanism; Georgia/system fallbacks remain usable if it is unavailable.
- Existing stock raster photos retain their colors and demo labels. Decorative chart/curriculum illustrations are not evidence of measured outcomes.
- Automated token/rendered-pair contrast checks, keyboard scenarios and screenshots do not constitute a complete accessibility or teaching-quality certification.
- The existing large JavaScript bundle warning remains; a toolchain upgrade, dependency remediation and bundle work are separate from this authorized visual task.
