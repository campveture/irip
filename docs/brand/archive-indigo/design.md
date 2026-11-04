# IRIP — design.md
## Archive Indigo visual system and functionality-preserving Codex handoff

**Project:** Institute of Research, Innovation and Practice (IRIP)  
**Demo reviewed:** https://irip.vercel.app/  
**Scope:** Visual theme migration, typography and approved-logo integration. This is not a website rebuild or product expansion.  
**Selected direction:** 01 — Archive Indigo.  
**Status:** Implementation specification; no website code was modified during this review.

---

## 1. Executive design decision

Keep the existing website's information architecture, section order, navigation and interaction model. Replace the current forest-green/teal and gold brand treatment with Archive Indigo, warm ivory and restrained lavender. Retain Inter for interface text and introduce Source Serif 4 selectively for editorial display headings.

The intended personality is **an emerging research institution with intellectual seriousness and contemporary clarity**. The crest supplies the ceremonial character; the website supplies legibility and usefulness. Do not turn the entire interface into a certificate, a fantasy crest presentation, a neon AI dashboard or a luxury retail website.

IRIP is being built around research education, innovation and practical application. Its long-term university ambition is context for a durable identity, not permission to imply university status, accreditation, ranking, institutional partnerships or guaranteed publication. Preserve the site's current factual language and qualification notices.

The design should work for prospective learners, academic mentors and institutional collaborators. It should feel thoughtful enough for faculty and approachable enough for a first-time researcher in Bangladesh.

## 2. What the live review established

### Observed, not inferred

| Area | Observation | Design implication |
|---|---|---|
| Homepage | Dark teal/green hero, ivory surroundings, gold italic accent, two CTAs and three catalog shortcuts | Preserve hierarchy and layout; migrate the palette |
| Header | Floating rounded container, small crest, IRIP wordmark, desktop navigation, More control and disabled Portal unavailable button | Update identity and surface colors; preserve navigation and disabled state |
| Typography | Inter is used for navigation and interface text; desktop navigation measured approximately 13px | Keep Inter; test modest size improvements against available width |
| Catalog | Programs search and Domain/Level filter groups, counts, cards and detail links | Style existing controls without replacing filter logic |
| Filters | Any selected tag within a group; both groups must match | Preserve OR-within / AND-between behavior exactly |
| Bootcamp detail | Overview, Cohorts, Pricing and Courses tabs | Preserve tab roles, selection, panels and navigation behavior |
| Pricing | Two intake choices, selected state, different totals, installment information and demo enrollment link | Preserve all calculations, date rules and targets |
| Contact destination | Explicit read-only notice; no live forms, accounts, submissions or saved data on hosted preview | This is intentional, not a missing feature to repair |
| Footer | Local demonstration and hosted read-only notices; policy, certificate and support links | Preserve notices, destinations and readable contrast |

Current sampled colors included green #245448, dark text #24323A, muted text #626F71, warm background #F5F3ED and soft surface #EAE8DF. These are observations of rendered elements, not a complete source-code token inventory.

The bootcamp Pricing tab was activated during inspection. It displayed January 2027 at BDT 21,000, a following February 2027 intake at BDT 25,000, and a proposed three-installment plan. **These values are evidence of existing behavior, not constants to copy into code.** Dates and eligible intakes may change. The current repository's data and calculation logic remain authoritative.

### Review boundaries

This was a public desktop browser review of the homepage, program catalog, bootcamp detail/pricing and contact preview state, plus navigation/footer destinations. The review did not inspect the source repository, authenticate into portals, submit forms, exercise a live payment service, or verify a backend. Mobile viewports and every route were not exhaustively tested. Do not describe this as a full functional or accessibility certification.

Some navigation captures showed loading states. Do not treat temporary loading opacity as a confirmed permanent visual defect.

### Main design refinements

1. **Unify identity.** The old green/gold theme and current crest direction feel like separate systems. Use one token system across the shared shell, catalog and detail pages.
2. **Give academic character a precise role.** Serif display headings can echo the crest's formal lettering; prices, controls and dense information should stay in Inter.
3. **Reduce competing decorative treatments.** Preserve the existing hero illustration but recolor it where editable. Do not add another large crest, floating symbols, laurels or animated AI particles.
4. **Make states unmistakable.** Active navigation, selected filters and selected intakes need persistent shape/border or weight cues as well as color.
5. **Keep credibility notices readable.** A disclaimer in tiny, faint type undermines the honest presentation already present in the site.
6. **Maintain a light learning interface.** Use indigo for the hero and important emphasis blocks; keep long reading, catalogs and forms on ivory or white.

## 3. Nonnegotiable preservation contract

The coding assistant must preserve:

- Every route, slug, URL parameter, hash anchor, redirect and navigation destination.
- Router configuration, loaders, authentication, authorization, roles, middleware, preview guards and feature flags.
- Existing form submission handlers, field names, IDs, validation, required states, hidden inputs, error mapping and successful submission behavior.
- Search matching, filters, sort order, filter counts, reset behavior, pagination and selected-state persistence.
- Pricing and installment calculations, currency formatting, discount eligibility, dates, timezone handling, capacity logic and cohort availability.
- Checkout/enrollment targets, payment integration boundaries, certificate lookup, learner/mentor/admin flows and restricted states.
- API endpoints, request/response schemas, data models, database migrations, storage keys, analytics events and integrations.
- Existing copy, policies, claims, disclaimers, synthetic-data labels and proposed/pending approval statuses.
- Content order, heading semantics, accessible names, keyboard interaction, focus management, dialog behavior and live announcements.
- Existing translations and locale behavior, if present.
- Existing application framework, package manager, build configuration and deployment configuration.

Do not enable the portal, enrollment, payments, certificate lookup, contact submission or applications merely because their unavailable state looks unfinished. Do not add fake functionality or new mock success responses.

Allowed changes: CSS/theme tokens, font declarations and loading through existing mechanisms, presentational class names, safe visual asset references, and narrowly scoped styling markup where demonstrably necessary. JSX/template files may be touched for those reasons, but event handlers, conditions, props carrying behavior and data expressions must remain intact.

Do not perform global search-and-replace on green or gold. Green may mean success; amber may mean warning; a color may be embedded in a chart or external image. Classify each usage first.

If a visual improvement requires behavior changes, leave that improvement out and report it separately. Continue the authorized visual work.

## 4. Approved brand assets

Use the selected three-falcon woven shield with central book, pen-nib and flame motifs. Preserve its geometry, relative proportions, inset border and illustration. Do not redraw it, replace birds, add a wreath, invent initials, add a crown or reshape it during the website task.

Selected asset:
[IRIP indigo shield logo with ivory falcons.png](https://chatgpt.com/library?file_id=libfile_200ac962fa008191a1693fbfcd93b573&account_id=personal)

Provide the actual downloaded image to the coding assistant. A Library link alone may not be readable by an external coding environment. Do not assume that filename exists in the repository.

This is a raster concept, not a verified vector master. Do not wrap a PNG in SVG and call it vector. Do not claim that curves, print separations or tiny-size detail are production-certified.

### Logo use

- Header: use an approved crest-only asset if one is supplied; pair it with existing live IRIP wordmark/tagline text. Start testing at 40–48px crest height on desktop and 32–40px on mobile.
- If only the stacked full-name lockup exists, do not crush the full institutional name into a 40px-high thumbnail. Keep the current header asset provisionally and report the missing crest-only export, or use an explicitly supplied approved crop.
- Footer/About: use the full lockup only at a size that makes its name legible. Preserve nearby live institutional text for accessibility.
- Use intrinsic aspect ratio, explicit width/height and object-fit: contain. No stretch, skew, CSS tint/filter or blend mode.
- Inspect transparent edges on ivory and dark backgrounds. No white rectangular matte or accidental clipping.
- Use meaningful alternative text where the logo carries identity; avoid repeating identical nearby accessible text.
- Keep space around the crest. Do not crowd it into a decorative pill or place another border flush against its shield.
- No favicon redesign in this pass unless a suitable approved small-format asset already exists.

Exact UI color values below are authoritative. Do not sample antialiased or slightly shaded pixels from generated artwork to derive the UI palette.

## 5. Palette and semantic assignments

| Token role | Hex | Use |
|---|---|---|
| Archive Indigo | #292442 | Main brand, dark hero, primary buttons, headings |
| Indigo hover | #393253 | Hover for primary controls |
| Indigo pressed | #211D35 | Pressed control state |
| Warm Ivory | #F5F1E8 | Main page canvas |
| White | #FFFFFF | Cards, inputs and elevated content |
| Soft Lavender | #A49BCB | Accent on dark indigo; decorative accents |
| Pale Lavender | #EEEAF6 | Selected/hover surfaces on light backgrounds |
| Deep Lavender | #544773 | Text links and accent text on light backgrounds |
| Main text | #292442 | Body and headings |
| Muted text | #5F596C | Supporting text, metadata |
| Subtle border | #D8D2DF | Decorative dividers and card edges |
| Control border | #746D82 | Necessary input/control boundaries |
| Inverse text | #F5F1E8 | Text on indigo |
| Inverse secondary | #D9D3E8 | Supporting text on indigo |
| Success | #22624C | Existing positive status only |
| Success surface | #E8F3EC | Existing positive status background |
| Warning | #79520D | Pending/warning status |
| Warning surface | #FFF3D9 | Pending/warning background |
| Error | #A12C3A | Existing validation/destructive status |
| Error surface | #FCEBED | Error background |

Status colors are functional exceptions, not additional marketing palettes. Keep labels/icons alongside color. Verify each actual status foreground/background pair in the implementation.

### Computed solid-color contrast

Calculated with the WCAG relative-luminance formula; rounded values are informational. These are token-pair checks, not a full-page conformance test.

| Foreground / background | Ratio | Decision |
|---|---:|---|
| Indigo / ivory | 13.07:1 | Body text, headings, navigation |
| White / indigo | 14.73:1 | Primary button labels |
| Lavender / indigo | 5.70:1 | Accent text and hero CTA |
| Lavender / ivory | 2.29:1 | Do not use for text or essential control boundaries |
| Muted text / ivory | 5.95:1 | Secondary text |
| Deep lavender / ivory | 7.38:1 | Links and small accent labels |
| Control border / white | 4.94:1 | Input boundary |

Target at least 4.5:1 for normal text and 3:1 for qualifying large text. Essential control visuals should reach 3:1 against adjacent colors. Test actual hover, focus, selected and disabled presentations; opacity, overlays and gradients can change the result. Disabled controls have exceptions in WCAG, but keep their labels understandable.

### Distribution

As a composition guideline, most long pages should remain ivory/white, with indigo concentrated in text, primary actions and a few meaningful dark sections. Lavender is a small accent. This is not a literal pixel quota.

Avoid gold gradients, metallic effects, glowing purple, vivid violet backgrounds and blue-to-magenta AI gradients. A flat palette is the preferred baseline.

## 6. Implementation token model

Map these into the project's existing theme architecture. Do not add a second competing token system or migrate frameworks. If existing tokens require HSL channels or another format, convert accurately instead of inserting invalid hex values.

```css
:root {
  /* Primitive colors */
  --irip-indigo: #292442;
  --irip-indigo-hover: #393253;
  --irip-indigo-pressed: #211D35;
  --irip-ivory: #F5F1E8;
  --irip-white: #FFFFFF;
  --irip-lavender: #A49BCB;
  --irip-lavender-pale: #EEEAF6;
  --irip-lavender-deep: #544773;
  --irip-muted: #5F596C;
  --irip-border: #D8D2DF;
  --irip-control-border: #746D82;
  --irip-inverse-muted: #D9D3E8;

  /* Semantic aliases */
  --color-canvas: var(--irip-ivory);
  --color-surface: var(--irip-white);
  --color-surface-selected: var(--irip-lavender-pale);
  --color-text: var(--irip-indigo);
  --color-text-muted: var(--irip-muted);
  --color-link: var(--irip-lavender-deep);
  --color-brand: var(--irip-indigo);
  --color-on-brand: var(--irip-ivory);
  --color-border: var(--irip-border);
  --color-control-border: var(--irip-control-border);
  --color-focus: var(--irip-lavender-deep);
  --color-success: #22624C;
  --color-success-surface: #E8F3EC;
  --color-warning: #79520D;
  --color-warning-surface: #FFF3D9;
  --color-error: #A12C3A;
  --color-error-surface: #FCEBED;

  /* Component aliases */
  --button-primary-bg: var(--color-brand);
  --button-primary-fg: var(--irip-white);
  --button-primary-hover-bg: var(--irip-indigo-hover);
  --button-primary-active-bg: var(--irip-indigo-pressed);
  --input-bg: var(--color-surface);
  --input-fg: var(--color-text);
  --input-border: var(--color-control-border);
  --card-bg: var(--color-surface);
  --card-border: var(--color-border);
  --nav-active-bg: var(--color-surface-selected);
  --nav-active-fg: var(--color-text);

  --font-ui: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-editorial: "Source Serif 4", Georgia, "Times New Roman", serif;
}
```

Use scoped inverse-section aliases for existing dark sections rather than changing global semantics through arbitrary descendant selectors. Inverse links/focus can use lavender; inverse body text uses ivory. Do not introduce a theme toggle.

For focus, use an explicit visible outline, normally 2–3px with offset. Indigo/deep lavender works on light surfaces; lavender works on indigo. Ensure the indicator contrasts with adjacent colors and is not clipped by overflow. Do not suppress outlines without a replacement.

## 7. Typography

**Decision: Source Serif 4 + Inter.** Source Serif 4 supplies editorial seriousness without requiring ornate typography across the interface. Inter remains the functional foundation already used on the demo.

| Role | Family | Starting specification |
|---|---|---|
| Homepage display title | Source Serif 4 | 600; 38–44px mobile, 56–64px desktop; line-height 1.08–1.16 |
| Main marketing section heading | Source Serif 4 | 600; 28–32px mobile, 36–44px desktop; 1.15–1.25 |
| Catalog/detail page title | Source Serif 4 | 600; 32–40px mobile, 44–52px desktop; allow natural wrap |
| Card heading, tab label, dashboard heading | Inter | 600; context-appropriate 18–24px for headings |
| Body | Inter | 400; 16px baseline; 1.6–1.7 |
| Hero lead | Inter | 400; 17–20px; 1.55–1.65 |
| Navigation/buttons | Inter | 500–600; generally 14–16px |
| Metadata/helper text | Inter | 400–500; 13–14px; 1.45–1.6 |
| Prices, dates, data tables | Inter | Use tabular numerals where alignment benefits |
| Small eyebrow label | Inter | 600; 12–13px; modest tracking, never essential prose |

These are responsive targets, not permission to break layout. Retain existing spacing and container architecture unless a small change is needed to accommodate fonts. Avoid manual line breaks that fail at intermediate widths.

- Preserve the homepage's two-part sentence. Use Source Serif 4 regular/semibold for the main phrase and its true italic for “Build the answer.” in lavender on indigo.
- Keep card titles and complex pricing interfaces sans serif for scanning.
- Do not use the crest's engraved-looking all-caps wordmark style for paragraphs.
- Load only needed font weights/styles using the current project's font mechanism. Prefer existing local font handling; do not add a new font package or external service unnecessarily.
- Use font-display: swap where applicable. Preserve a readable fallback and test failed/slow font loading.
- Keep licensing files with self-hosted assets as required by the font license.
- Do not fabricate an exact font match for the logo's raster wordmark.
- If Bengali already exists, preserve it and its locale handling. Use the project's established Bengali font; where a choice is needed, Baloo Da 2 is the user's preference. Validate glyphs, line-height and wrapping separately. Do not introduce a translation toggle in this visual pass.
- Avoid letter-spacing on Bengali text. Do not apply English uppercase treatments to it.

## 8. Component-by-component direction

### Shared header and navigation

Keep its present position, sticky/floating behavior, navigation order and More dropdown. Use an opaque or sufficiently legible ivory surface, indigo text and a pale-lavender active item. Reduce unnecessary shadow intensity through existing tokens only; retain spatial separation from the hero.

An active item needs a persistent shape or underline, not color alone. Keep existing aria-current logic. Do not create a second active state from pathname guessing. Maintain dropdown keyboard behavior and mobile menu dismissal.

The Portal unavailable control remains disabled with its explanatory label. Do not replace it with an enabled “Get started” CTA.

### Homepage hero

Use Archive Indigo as the main background. Main heading ivory; italic phrase lavender. Supporting copy ivory or inverse secondary. Primary hero CTA: lavender background with indigo label. Secondary CTA: transparent with an ivory border and ivory label; use a restrained inverse hover surface. Keep their labels, targets and order.

Recolor editable decorative line artwork to lavender/ivory. If it is raster artwork, do not use a whole-image hue filter: retain it temporarily and identify the required replacement. No generated illustration should replace functional HTML or text.

Preserve catalog shortcuts and anchor behavior. Gold shortcut arrows can become lavender on indigo. Maintain keyboard focus on each shortcut.

### Catalog and filters

Canvas ivory; cards white; headings indigo; descriptive copy muted. Tags use pale-lavender surfaces and indigo/deep-lavender labels.

Selected filters use indigo fill with white text, or pale-lavender fill with indigo outline and a clear selected marker if already available. Preserve accessible pressed/checked semantics and counts. Hover must not look identical to selected.

Keep result-count text live, search labels associated and reset behavior unchanged. Keep empty-state content and recovery controls. Do not hide filters on mobile without retaining the existing accessible way to open them.

Catalog cover art may still contain old green/gold colors. Audit whether each is SVG, CSS artwork or raster. Recolor editable decorative assets without changing text/data. Track raster replacements separately; never distort mentor photos or academic diagrams to match the palette.

### Program detail and Pricing

Keep existing tabs, URL/hash integration, selected panels and click handlers. Use one coherent active-tab treatment across the four tabs. Preserve focus vs selected distinction.

Pricing panels: indigo background with ivory text for the principal investment card; white installment cards; selected intake pale lavender with a strong indigo border. Numbers remain Inter. Pending approval warnings retain their actual semantic status and visible text.

The discount, standard fee, selected cohort, installment amounts, due dates and enrollment-link target must update exactly as before. Do not hardcode the prices observed during this audit. Do not convert proposed fees into live offers or enable checkout.

Retain any sticky program navigation and ensure focus/anchor destinations are not hidden behind the header. Scope any scroll-margin adjustment narrowly.

### Courses, projects, mentors and student-value pages

Apply shared card, text, filter and badge tokens to existing components after inspecting the repository. Preserve course prerequisites, project statuses, mentor identity/disclaimers, proposal labels and links. Do not invent qualifications or replace synthetic profiles with real people.

These routes were not fully audited in this browser review; implementation must inspect and test them rather than assume their structure.

### Forms, certificates and portals

In the hosted version, the contact destination intentionally shows a read-only notice. Preserve this guard and its explanatory content. The same principle applies to certificate lookup and account areas.

If a separate local app contains forms or dashboards, only restyle shared presentational elements. Keep all field labels, IDs, validation, roles and submit behavior. Avoid global selectors that accidentally restyle hidden admin widgets or change disabled controls.

Do not replace actual certificates or alter certificate generation layouts in this task. Website theming is not authorization to modify issued documents.

### Footer, policies and notices

Use the existing footer layout. Keep legal and preview notices clearly readable. An ivory footer with indigo text is the safest default; if it is already dark, use inverse tokens consistently.

Policies remain reading-focused with comfortable line length, visible link underlines and intact lists/headings. No promotional serif treatment on dense legal text.

### States and motion

- Loading: preserve skeleton dimensions and loading logic; recolor only.
- Empty: preserve explanation and recovery actions.
- Error: retain red semantic styling, icon/text and focus behavior.
- Success: retain green semantic styling, icon/text.
- Disabled: preserve disabled attributes and prevent accidental hover/click affordance.
- Hover: subtle surface/color change; no layout shift.
- Focus: visible independently of hover.
- Selected: persistent indicator distinct from focus.
- Motion: reuse existing transitions; no new animation dependency, parallax, scroll hijacking or entrance effects that hide content. Respect reduced-motion behavior.

## 9. Responsive and accessibility requirements

Do not redesign breakpoint architecture. Verify at approximately 360, 390, 768, 1024 and 1440 CSS pixels, plus intermediate widths around the actual navigation breakpoint.

Check:
- No horizontal page overflow, clipped headings, displaced icons or truncated essential labels.
- Header logo and name remain legible; mobile navigation remains operable.
- Long program names wrap without forcing buttons offscreen.
- Selected filter chips wrap and remain removable.
- Tabs remain reachable and retain their existing keyboard model.
- Prices, cohort dates and installment terms remain visible on narrow screens.
- Inputs keep associated labels and do not shrink below readable text sizes.
- Aim for comfortable 44px touch areas where practical without overlap.
- At 200% zoom, content reflows and controls remain usable.
- Focus rings remain visible within rounded/overflow containers.
- Contrast is checked in every interactive state; no opacity shortcut for essential text.
- Do not remove the skip link or alter #route-content.
- Do not use color as the sole status indicator.
- Do not set a fixed height on text containers to force visual alignment.

No accessibility compliance claim should be made solely from the token table. Automated checks plus keyboard and visual review are required.

## 10. Safe implementation workflow

1. Read repository instructions and inspect the real stack, file structure, current theme and assets.
2. Record git status and preserve user changes. Do not reset, clean or overwrite unrelated work.
3. Identify current route, component and behavior boundaries before modifying shared styles.
4. Establish baseline screenshots and functional checks. Record pre-existing failures separately.
5. Locate the existing token layer and map old brand roles to the approved roles.
6. Implement theme tokens and font loading first; verify build and font fallbacks.
7. Apply shared shell and control styles; review homepage and catalog.
8. Update program detail and pricing presentation; verify behavior before broadening.
9. Inspect remaining routes and internal surfaces for shared-style regressions.
10. Run existing lint/type/build/test commands appropriate to the repository.
11. Perform functional and visual checks below.
12. Review the final diff for logic, data, route, lockfile and configuration changes.
13. Deliver a concise report with screenshots, files changed, checks performed and remaining limitations.
14. Do not publish, deploy, merge, change DNS or modify production settings unless separately requested.

Do not add dependencies for a color/theme migration unless genuinely necessary and explained. Do not replace the design system with a new component library.

## 11. Regression acceptance matrix

| Area | Required before/after check |
|---|---|
| Shared shell | Same links and targets; home link, More menu, mobile menu and skip link work |
| Programs search | Same query produces same records; clearing restores baseline |
| Filters | Same OR-within / AND-between logic, counts, selected values and resets |
| Program tabs | All four panels reachable; selected/focus/keyboard states preserved |
| Cohort selection | Changing intake updates the same data and intended enrollment target |
| Pricing | Discount, total and installment sum unchanged for same baseline input/time |
| Dates | Same timezone and eligibility rules; no new hardcoded dates |
| Demo enrollment | Same destination and read-only/no-payment boundary |
| Contact | Same read-only explanation; no new collection/submission behavior |
| Portal/certificates | Existing guards remain; disabled state not bypassed |
| FAQ | Same questions/answers and accordion behavior |
| Policies | Same content and destinations; readable and keyboard accessible |
| Responsive | Required widths, zoom and long-content states reviewed |
| Assets | Correct logo, no distortion, no missing fonts/images or unreadable lockup |
| Errors/loading | Existing states still visible and usable |
| Data/network | No unexpected API/schema/storage/analytics changes |
| Build | Existing lint/type/build/relevant tests pass or baseline failures documented |

Use deterministic fixtures/time in existing tests for date-dependent pricing if supported. Do not replace runtime date logic with constants just to make screenshots match. Use local test environments or mocks; never send real payments or personal information to prove a visual change.

A prompt cannot guarantee zero regressions. The preservation boundary, limited diff and before/after checks are the safety mechanism.

---

## 12. COPY-READY CODEX IMPLEMENTATION PROMPT

Copy everything between BEGIN and END into the coding assistant after attaching this design.md and the approved logo asset.

### BEGIN PROMPT

You are working on the existing IRIP website. Read the attached design.md completely and follow the repository's instructions before editing.

Your task is to implement the **Archive Indigo visual identity** across the existing website through a controlled presentation-only change. This is not a rebuild. The user strongly prioritizes retaining all current functionality. Deliver working changes, validation and a reviewable diff; do not stop after producing a plan.

#### Project meaning

IRIP means Institute of Research, Innovation and Practice. It teaches research through structured theory, supervision and practical work, including AI/ML-related learning. The institution wants a credible long-term academic identity while remaining approachable to young learners in Bangladesh.

The selected woven-falcon shield is the identity anchor. Its formal appearance should be balanced by a simple, readable interface. University-level ambition is not an existing accreditation or ranking. Do not invent institutional achievements, partners, guarantees or faculty credentials.

#### Fixed visual decisions

- Brand primary: #292442.
- Canvas: #F5F1E8.
- Cards/inputs: #FFFFFF.
- Accent: #A49BCB, primarily on dark indigo.
- Accent light surface: #EEEAF6.
- Accent text on light backgrounds: #544773.
- Supporting text: #5F596C.
- Decorative borders: #D8D2DF.
- Necessary control boundaries: #746D82.
- Primary hover: #393253.
- Primary pressed: #211D35.
- English editorial headings: Source Serif 4.
- Body, navigation, forms, prices, cards and tables: Inter.
- Keep existing Bengali support if present; no new localization feature.
- No gold/metallic theme, neon purple, glossy gradients, new wreath, new crest or AI illustration.
- Keep the current overall page composition and section order.

Implement these values within the current token/theming system. Do not create a competing styling architecture. Use semantic tokens in components. Do not replace every green with purple: preserve status semantics and meaningful chart colors.

#### Absolute behavior boundary

Preserve every route, URL, query/hash behavior, link target, event handler, form field contract, validation rule, filter algorithm, sorting rule, pricing calculation, installment schedule, cohort eligibility/date rule, authentication/authorization guard, preview restriction, API request, schema, persistence key, analytics event, integration and existing content.

Do not alter databases, services, server actions, middleware, payment configuration, environment variables, deployment settings, package manager or framework. Do not regenerate datasets. Do not change business copy, fees, discounts, seats, dates or policies.

The public demo intentionally disables real services. Preserve “Portal unavailable,” read-only notices and all synthetic/proposed/pending-approval labels. Do not enable contact submissions, enrollment, payment, certificate lookup, accounts or portals.

The bootcamp has four tabs and dynamic intake/pricing presentation. Treat those as functional code, not static marketing elements. Preserve existing selection state, installment calculation, date handling and enrollment destinations exactly.

If a proposed styling improvement would require behavior changes, omit that improvement, document the reason and continue the rest of the visual task. Do not silently broaden scope.

#### First inspect, then edit

1. Read AGENTS.md and other applicable project instructions.
2. Inspect git status. Preserve all user changes; do not use destructive reset/clean commands.
3. Identify the actual app stack, router, theme/tokens, typography, shared components, assets and test scripts.
4. Locate the source of the green/teal/gold brand colors. Classify brand vs semantic status vs image content.
5. Confirm the approved logo file exists locally. Do not fabricate a path or regenerate a missing asset.
6. Record representative baseline screenshots and behavior checks before changes.
7. Report a brief scoped implementation plan, then execute it without waiting for routine cosmetic approval.

#### Implement in this order

A. Add or adapt primitive, semantic and component theme tokens in the existing structure.
B. Load Source Serif 4 through the existing font mechanism and retain Inter. Keep readable fallbacks. Limit weights/styles to actual use.
C. Update shared header/footer, active navigation, buttons, inputs, links, badges, focus states and card surfaces.
D. Update the homepage hero to indigo/ivory/lavender while preserving its text, CTAs, artwork structure, shortcuts and anchors.
E. Update program catalog/filter styling without modifying its logic or data.
F. Update program detail tabs, selected intake and pricing/ installment presentation without touching calculations.
G. Inspect courses, projects, mentors, student-value, FAQ, policy and read-only states for shared-theme consistency.
H. Verify any local-only learner/mentor/admin pages affected by global styles using existing safe test access. Do not add credentials or bypass guards.
I. Run the regression matrix and review the final diff.

Use only small, necessary presentation changes to markup. Retain component identities, state hooks and keying. Do not replace stateful components merely to simplify styling. Do not change button types, disabled attributes, form names, accessible names, roles or label associations.

Do not apply indiscriminate selectors such as button { all: unset }, global fixed heights, broad overflow:hidden, pointer-events changes or z-index overrides that could break menus, dialogs, sticky elements and keyboard focus.

#### Logo handling

Use the supplied approved asset unchanged. Preserve its aspect ratio and transparency. Do not CSS-filter, stretch, redraw or trace it. Use a supplied crest-only version for compact header use; the full name lockup must not be shrunk into illegibility. If a compact export is missing, retain the existing compact asset temporarily and report the requirement rather than inventing a new logo.

Do not modify the logo's birds, book, nib, flame or border. Do not claim a raster file is vector. Ensure header home-link behavior remains unchanged.

#### Typographic and visual finish

Use the supplied type scale as a starting point. Keep editorial serif on major marketing headings, Inter on controls and data. Preserve hierarchy and avoid ornamental all-caps body text. Keep the two-part homepage headline and its italic phrase.

Lavender on ivory has only about 2.29:1 contrast and must not become small text, a placeholder, or an essential boundary. Use deep lavender or indigo there. Lavender on indigo has about 5.70:1 and is suitable for the planned accent treatment.

Use white/ivory text on indigo, restrained shadows and clear surface separation. Keep cards predominantly white on ivory. Retain functional success/error/warning colors with labels and icons. Keep notices legible, not tiny and faint.

Do not add decorative sections, new marketing claims, a theme toggle, new icons, interaction libraries, scroll animations or unnecessary motion. Recolor existing editable artwork carefully; flag raster artwork that cannot be safely updated.

#### Verification required

Use the existing repository test/build tooling. Validate:
- Homepage and shared header/footer.
- Programs search and multi-filter behavior, counts and clear/reset.
- All four bootcamp tabs.
- Both intake selections and resulting totals, installment amounts and link targets.
- Same date/timezone rules with a controlled baseline.
- Read-only contact and existing portal/certificate restrictions.
- FAQ and mobile navigation behavior.
- Relevant local forms with mocks/test fixtures only if they already exist.
- 360, 390, 768, 1024 and 1440px layouts, plus 200% zoom.
- Keyboard tab order, focus visibility, menu/tab/accordion operation and skip link.
- Normal, hover, active, selected, error, loading, empty and disabled states.
- Contrast of actual rendered combinations, not just design tokens.
- No new runtime errors, missing assets or font failures.
- No unexpected changes to API calls, persistence, analytics or business data.

Do not perform real transactions, submit personal data or create production records. Do not treat read-only restrictions as defects.

Use before/after screenshots at matching viewports and states. Do not update failing test snapshots mechanically to conceal a regression. Record pre-existing failures separately. Fix regressions introduced by your changes before concluding.

#### Final delivery

Provide:
1. A brief description of the final visual changes.
2. The files changed and why.
3. Confirmation of whether any behavioral code was touched, with explanation if so.
4. Test/build commands and actual outcomes.
5. Routes, viewport sizes and interactive states checked.
6. Before/after screenshots or a local preview where available.
7. Remaining asset requirements and untested limitations.
8. Any pre-existing issues discovered, clearly separated from this change.

Do not say “all functionality preserved” without evidence. State the checks actually performed. Do not deploy, publish or merge unless the user separately requests it.

### END PROMPT

## 13. Source notes

- Live observations: https://irip.vercel.app/ ; the public program catalog, bootcamp detail and contact destination were inspected directly. These observations describe the reviewed state, not a permanent feature guarantee.
- Source Serif official specimen: https://adobe-fonts.github.io/source-serif/
- Source Serif official repository and licensing/distribution information: https://github.com/adobe-fonts/source-serif
- WCAG text contrast explanation: https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- WCAG 2.2 normative requirements: https://www.w3.org/TR/WCAG22/

The palette assignment, type pairing, component treatment and migration plan are design judgments tailored to IRIP. They are not claims that a color or font guarantees prestige, conversions, accreditation or ranking.

