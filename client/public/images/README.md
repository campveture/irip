# Illustrative demo images

These locally hosted assets are visual placeholders, not evidence of IRIP people, premises, courses or project results. Stock portraits are used only on synthetic demo profiles with a visible **Stock model / Demo portrait** label. Replace them with approved portraits before launch.

## Original program artwork

`program-research.svg`, `program-statistics.svg` and `program-writing.svg` are custom vector compositions created for this prototype. Their notebooks, charts and manuscripts are illustrations, not measured outcomes or actual course materials. Artwork is selected by program topic, not list position, so filtering preserves the correct cover.

## Current identity: Archive Indigo — 5 November 2026

The authoritative supplied guide and untouched raster source are kept in `docs/brand/archive-indigo/`. This supersedes the earlier Fieldwork crest below.

- `irip-falcon-lockup.png` is a byte-identical copy of **IRIP indigo shield logo with ivory falcons.png**. The full-name lockup is displayed at reading size on About, on ivory, with meaningful alternative text.
- `irip-falcon-crest.png` is the **user-approved crest-only crop**, box `(183, 102, 1071, 1034)` from the 1254px source. Pixels inside the crop are unchanged; only the surrounding canvas/name is excluded.
- `irip-falcon-crest-192.png` is a proportional 183×192px compact PNG export used by `IripMark` across header/footer/portals. It avoids loading the 657kB full-resolution crop into a 40–48px slot. No bird, border, book, nib, flame, color or geometry is redesigned; no tint, trace or SVG wrapper is used. These are raster assets, not a verified vector master.
- Reproduce these files with `python docs/brand/archive-indigo/prepare-logo.py` (Pillow is an artwork tool, not a website dependency).
- The existing favicon and Apple touch icon remain unchanged, per the guide's exclusion of favicon redesign without a suitable approved small-format master. The previous crest exports remain historical assets, not the current site identity.
- Seven editable `program-*.svg` / `course-*.svg` covers were individually recolored to indigo/ivory/lavender. Their paths, text, coordinates and topic assignment are unchanged. Stock photos, portraits, curriculum content and business data were not recolored or replaced.

UI colors come from the design guide, **not sampled logo pixels**. Canonical RGB-channel tokens live in `client/src/index.css`; Tailwind, charts and shared controls reference them. Status green/amber/red remain semantic exceptions. Source Serif 4 is loaded through the existing Google Fonts mechanism; the app retains Inter, Baloo Da 2 and system/Georgia fallbacks.

## Earlier institution crest — superseded by Archive Indigo

The user-selected shield replaces the earlier discovery-book mark. The uploaded PNG is preserved at `docs/brand/irip-logo-original.png`. It is user-supplied artwork; authorship and rights have not been independently verified.

- `irip-mark.svg`: standalone vector-traced crest, with a transparent exterior and no tiny embedded lettering. Used by the shared `IripMark` component (header, footer and portals) and the favicon. No embedded raster, external resources or scripts.
- `irip-crest.png`: transparent high-resolution crest export.
- `irip-logo-lockup.png`: transparent full-name version retaining the supplied lettering; use on light surfaces at larger sizes, not in compact navigation.
- `irip-apple-touch-icon.png`: opaque 180px warm-paper mobile home-screen icon.

Colours match the existing Fieldwork tokens: midnight `#122B39` shield, paper `#F5F3ED` figures/inset, brass `#C5A46D` rim/spark/cube top, evergreen `#245448` cube face. The original silhouette, quill, hands, spark and cube are retained. The full institution name remains readable HTML beside/below the mark on the site. Asset URLs carry `?v=crest-1` to avoid reusing the old cached book logo.

Rebuild with `python docs/brand/build-logo.py` after installing Pillow, numpy and opencv-python-headless in a separate Python environment. These are artwork-generation tools, not application dependencies. The script expects the supplied 1254px source; do not substitute a differently cropped image without updating the traced component mapping.

## Current stock photography

Locally resized images from Unsplash; see the [Unsplash license](https://unsplash.com/license). No endorsement or institutional affiliation is implied.

### Photographic homepage follow-up

`home-study-800.jpg` and `home-study-1600.jpg` are proportional JPEG derivatives of [Unsplash image photo-1523240795612-9a054b0db644](https://images.unsplash.com/photo-1523240795612-9a054b0db644). They are real stock photography, not AI-generated scenes or IRIP members/premises. Both are hosted locally; the homepage uses a responsive `srcset`, eager lead-image loading and intrinsic dimensions. No Unsplash API or new image service is integrated.

The homepage also reuses the existing `digital-learning.jpg`, `data-analysis.jpg`, `writing-desk.jpg` and `team-workshop.jpg` photographs below. Visible captions distinguish stock study/collaboration/topic scenes from IRIP people, results or facilities. Natural photo colours are retained; no theme tint, hue filter or blend mode is applied. Contributor identity is not guessed from a CDN filename. No photographs, logos, achievements, faculty names or text were copied from the university reference sites.

| File | Source image | Purpose |
| --- | --- | --- |
| `team-workshop.jpg` | [photo-1522071820081-009f0129c71c](https://images.unsplash.com/photo-1522071820081-009f0129c71c) | Team collaboration / About |
| `digital-learning.jpg` | [photo-1516321318423-f06f85e504b3](https://images.unsplash.com/photo-1516321318423-f06f85e504b3) | Guided digital learning |
| `writing-desk.jpg` | [photo-1434030216411-0b793f4b4173](https://images.unsplash.com/photo-1434030216411-0b793f4b4173) | Writing and inquiry |
| `data-analysis.jpg` | [photo-1551288049-bebda4e38f71](https://images.unsplash.com/photo-1551288049-bebda4e38f71) | Data-analysis topic imagery, not research findings |
| `mentor-professional.jpg` | [photo-1573496359142-b8d87734a5a2](https://images.unsplash.com/photo-1573496359142-b8d87734a5a2) | Clearly labelled stock-model demo portrait |
| `mentor-model.jpg` | [photo-1531123897727-8f129e1688ce](https://images.unsplash.com/photo-1531123897727-8f129e1688ce) | Unused alternative model photo |

## Earlier assets (no longer displayed)

| File | Source | License |
| --- | --- | --- |
| `study-group.jpg` | [Sias Library — Students Studying 2017](https://commons.wikimedia.org/wiki/File:Sias_Library_-_Students_Studying_2017.jpg), Gary Todd | CC0 |
| `research-mentoring.jpg` | [Argonne National Laboratory researcher talks with students](https://commons.wikimedia.org/wiki/File:Argonne_National_Laboratory_researcher_talks_with_students_about_fuel_cell_development_at_the_2005_Science_Careers_in_Search_of_Women_Conference.jpg), U.S. Department of Energy | Public domain |
| `library-books.jpg` | [International books at Kent Library](https://commons.wikimedia.org/wiki/File:International_books_at_Kent_Library.jpg), Roc0ast3r | CC0 |

Earlier photos are retained to avoid removing existing assets, but are not selected by the current design.
