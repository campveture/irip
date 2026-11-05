# Project directory: structured research and industry lists

Initially prepared for local review; the user subsequently authorized publishing this redesign to the existing read-only Vercel demo. No payment, enrollment or project-allocation service is enabled.

## User-facing structure

- Two explicit primary-goal sections: **Publication-focused research** (seven existing outlines) and **Industry-focused projects** (the two inspection/device outlines). These are editorial classifications, not promises of publication or actual client work. Unknown future titles appear under **Other project outlines**, not an inferred category.
- Every collapsed row shows a plain-language title/question, working academic/technical title, subject track, proposed status, planned team size, bootcamp entry explanation and navigable bootcamp/full-detail links. Neither entry information nor detail navigation depends on expanding the toggle.
- Each quick brief expands independently into **Proposed output**, **Useful preparation** and **Before work can start**. The original long summary is not repeated in the listing.
- Detail pages split the existing authored summary into question, proposed differentiation, data/equipment, baselines, metrics and feasibility gate, where those labels actually exist. Unlabelled legacy content remains a normal overview rather than invented technical detail.
- The entry route is **research bootcamp → foundations/readiness → topic request → supervisor-approved matching**. Existing bootcamp routing is unchanged. The page states that no live seat booking, enrollment, publication, authorship or project allocation is guaranteed.
- Team sizes come from the API's capacity, displayed as a **planned team** rather than fabricated remaining availability. Missing/invalid capacities say **To be confirmed**. Existing local records currently provide four learners per project and five for the heavier device project; this frontend revision does not change database records or actual accepted membership.

## Files and boundaries

- `client/src/components/projects/`: strict TypeScript presentation, public response validation, known-title brief metadata, grouped directory, entry panel, quick brief and structured detail content.
- `client/src/pages/public/Projects.jsx`: stable route compatibility export.
- `client/src/pages/public/PublicProjectDetail.jsx`: preserves existing request/cancellation/error routing and delegates content presentation.
- `client/src/index.css`: scoped Archive Indigo editorial-list styling and responsive entry panels.
- `client/tests/projects.test.ts`, `client/tests/e2e/projectsDirectory.spec.ts`: focus/contract/section parsing, collapsed entry visibility, links, keyboard toggles, search/retry and 1440/768/390/320px layouts. The new unit file is included in the existing test command.

Briefs refine the already supplied topic-validation plan into readable proposed outputs and readiness notes. No mentor from its prospect appendix is advertised as appointed. No new claim of novelty, secured data/hardware, journal acceptance or client participation is introduced.

Pre-existing changes to `server/db.js` and `server/server.js`, the older list test edits and the untracked local `data.sqlite` were present at the start; they were not reverted, deleted or migrated by this presentation task. No new backend or persistence change is made here.

## Verification

- Normal production build and strict typechecking pass; existing large-bundle warning remains.
- Original 39 client unit tests and four new project unit tests pass.
- Five focused project/directory browser tests pass, including the new structured details and both focus sections.
- A broader 73-case run passed 70 and exposed two overly broad `header` selector conflicts caused by additional section header elements, plus one intermittent existing portal scroll assertion. The section wrappers were changed to neutral `div` containers without weakening existing tests. A final eight-test rerun, including all three failed scenarios and all project/directory cases, passed **8/8**. The unrelated portal scroll test was not changed.
- The actual running local app at **http://127.0.0.1:5173/projects** shows all nine records. Desktop/390px screenshots, detail navigation and industry search were checked with no page errors or horizontal overflow. Additional focused tests cover 768/320px.
- Initial review had no push/deployment; the user then explicitly requested making it live.

## Authorized release checks

- `npm run build:preview` passes and exports **52** public synthetic responses: the earlier 36 plus ID/slug GET snapshots for eight additional project outlines. The exporter still uses a fresh in-memory database and excludes private records, sessions, source maps and database files.
- `npm test` passes all nine API suites (including 56 demo checks) and **43** client unit tests.
- The full read-only preview browser suite passes **12/12**, including every project detail page, seven/two focus grouping, four/five learner plans, collapsed entry links, keyboard toggles, bootcamp navigation and the existing guards against accounts/forms/writes/private exports.
- Release includes the already-reviewed fresh demo-seed capacity adjustments (four learners generally; five for the heavier device project). The separate pre-existing local-server startup overwrite edit remains outside this release; it and the untracked root `data.sqlite` are not uploaded.
- Destination remains `https://irip.vercel.app/projects`; the prior hostname's permanent redirect is retained. No production hosting configuration, identity policy or payment integration is changed.

Review screenshots are under the approved temporary directory `C:/Users/Sajid/AppData/Local/Temp/opencode/irip-project-directory-local/` (directory, brief, full detail and industry views at desktop/mobile sizes).
