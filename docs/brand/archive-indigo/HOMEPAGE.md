# Photographic homepage and academic masthead

User-authorized follow-up to `design.md`, 5 November 2026. The later request explicitly permits a photo-led homepage redesign and university-inspired header/menu styling. It supersedes only the earlier homepage's abstract-art composition and the segmented/capsule navigation treatment—not the approved Archive Indigo palette, logo handling, truthful claims or functionality-preservation contract.

## References and interpretation

Official public pages reviewed as references:

- [Harvard](https://www.harvard.edu/): focused editorial themes, strong headline hierarchy and research/learning features rather than app-like promotional dashboards.
- [Princeton](https://www.princeton.edu/): photo-led academic features, separated subject blocks and clear pathways into study/research content.
- [Yale](https://www.yale.edu/): recognizable institutional identity, clear primary navigation and useful topic gateways.

These inspire hierarchy, restraint, editorial image placement and navigation clarity. This is an original IRIP composition, not a pixel copy or claimed university affiliation. No university assets, accomplishments, news, faculty portraits, testimonials, crests or campus imagery are reused.

## Presentation changes

- `components/home/HomeHero.tsx` uses the existing headline, description, two actions and three shortcut targets in an indigo/ivory/lavender split composition with a real stock study photograph. Other pages' `PublicHero` illustrations are unchanged.
- `components/home/homePhotography.ts` contains only local image references and presentational topic-to-photo selection. The API-backed program list, filters, pricing and data contracts are unchanged.
- `Home.jsx` retains its existing fetch/cancellation/error/empty states, program destinations, section order, anchor, three proposed steps and FAQ state/handlers. Homepage program covers now use the existing labelled stock photographs; the practice section pairs a collaboration photograph with the existing three steps. Program detail/catalog artwork elsewhere is unchanged.
- The shared masthead uses a formal live wordmark, persistent underline-style active navigation, restrained dropdowns and larger divided mobile-menu links. Existing header docking, transparent surround, bounded glass/fallback, menu state, keyboard dismissal/focus, destinations and disabled portal conditions remain intact. The program dock shares the 10px navigation corner token and remains in normal document flow.
- New photographic assets are responsive, locally hosted JPEGs with explicit dimensions, no hue filter and no remote runtime image requests. Visible captions explicitly state that stock scenes are not IRIP people or premises; topic photos are labelled illustrations, not results.

## Boundaries

No changes to server/API routes, datasets, business fees/dates/availability, enrollment targets, policies, auth/roles, form behavior, persistence, feature gates, dependencies, build or deployment settings. No real account, contact submission, certificate lookup, payment or enrollment is enabled. Favicon work remains outside this pass as recorded in the main implementation note.

New browser tests cover photo loading/source selection and truthful captions at 320/360/390/768/1024/1440px; preserved program/anchor targets and FAQ access; desktop active underlining/dropdown keyboard behavior; and mobile link touch size, Escape/focus restoration and dismissal on routing. Existing full-app and hosted-preview regression suites remain the acceptance gate.

## Final verification

- Both `npm run build` and `npm run build:preview` pass, including strict TypeScript checking. The read-only export still contains the same 36 public synthetic responses.
- `npm run test:client`: **39/39 unit tests pass**.
- Final `PW_CHANNEL=chrome npm --prefix client run test:e2e`: **70/70 pass**. This includes the homepage's original catalog/FAQ/shortcut functionality and all existing local workflow, authorization, pricing, program-tab, header docking, focus and scrolling regressions.
- Final `PW_CHANNEL=chrome npm --prefix client run test:preview`: **11/11 pass**, including the new photographic-homepage and academic desktop/mobile-menu cases, source image checks, responsive/font-failure/contrast checks and all hosted read-only gates.
- Twelve captured before/after states preserve the original headings, link destinations and displayed pricing. Stock-photo labels deliberately add descriptive text to the homepage cards; no destination changes. The reviewed captures report no page errors or horizontal overflow.
- No backend, router, package/lockfile, data or deployment configuration change. The existing large-bundle warning remains. External font fallbacks and stock-photo/prototype limitations remain as documented in the guide.

## Captures

- [Photographic homepage — desktop](review/photographic-home-desktop.png)
- [Photographic homepage — mobile](review/photographic-home-mobile.png)
- [Academic More dropdown](review/academic-more-menu.png)
- [Mobile menu](review/academic-mobile-menu.png)
