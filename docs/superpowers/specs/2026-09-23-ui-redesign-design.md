# UI Redesign: Disciplined Space Theme

Date: 2026-09-23
Status: approved in brainstorming, awaiting spec review

## Goal

Turn the current playful space-themed portfolio into a creative but professional site with a flawless top-to-bottom flow. Keep the space concept, remove the noise, put the strongest work first.

## Constraints

- Plain HTML, CSS and JS. No build step, no libraries.
- All content, links and assets carry over unchanged unless listed under Content changes.
- Full rewrite of `index.html`, `styles.css` and `script.js` (approach A). One image resized in `assets/`.

## Visual system

### Colour

| Token | Role |
|---|---|
| `--bg` | deep space page background, near black |
| `--bg-raised` | slightly lifted section background |
| `--surface` | card surface, translucent white over background so the sky shows faintly |
| `--line` | hairline border, low-opacity white |
| `--text`, `--text-muted` | primary and secondary text, muted checked for WCAG AA on `--bg` |
| `--accent` | cyan, the only interactive colour: links, buttons, active nav, hover borders, focus rings |
| `--gold` | warm gold from the sun, used only for the sun, brand mark, eyebrow labels, year and date labels |

No other hues. Category badges are outlined neutral pills. The old pink, purple, green, orange and blue accents are removed.

### Type

- One family: Inter, loaded once from the HTML head with preconnect. The CSS `@import` and Nunito are removed.
- Headings: weight 800, letter-spacing -0.02em, line-height 1.1.
- Fluid scale with `clamp()`: display (name), h2 (section titles), h3 (card titles), body, small. No per-breakpoint font-size overrides.

### Shape and surface

- Two radii: card and pill.
- Buttons: `.btn-primary` filled cyan with dark text, `.btn-ghost` transparent with hairline border. No solid offset shadows, no bounce easing.
- Cards: `--surface` background, `--line` border, border shifts to `--accent` on hover. No lift or scale.
- Section titles: gold eyebrow label above, no underline bar.
- Wave dividers removed. Sections separate by alternating `--bg` and `--bg-raised` plus generous vertical spacing.

## Page structure

Order: nav, hero, projects, experience, skills, contact, footer. Section ids stay `home`, `work`, `experience`, `skills`, `contact`.

### Navigation

- Fixed. Transparent on load. After scrolling past the hero, gains a translucent blurred background and hairline bottom border via a `.scrolled` class.
- Brand mark in gold left, five links right. Active link tracked with an IntersectionObserver on sections; sets `aria-current="page"`.
- Mobile: hamburger is a `<button>` with `aria-expanded` and `aria-label`. Open menu is a full-height panel that fades and slides in, links stacked large, `body` scroll locked while open. Hamburger animates to a cross. Closes on link click and on Escape.

### Hero

Full viewport height, content left-aligned in the container.

1. Gold eyebrow: "Software Engineer · [location]". Location is a placeholder the owner fills in; ship with "Software Engineer" alone if unset.
2. Name as display heading, plain white.
3. One positioning sentence from the current description, ellipsis removed.
4. Buttons: "View projects" primary linking `#work`, "Get in touch" ghost linking `#contact`.
5. Proof strip pinned to the hero bottom: three tiles for Sepetix, Travela, Fitalyze. Each tile: thumbnail, name, one-line category, arrow. Whole tile links to that project's featured card (`#project-sepetix` etc). Horizontal scroll with snap on mobile.
6. Scroll cue: small "scroll" label and thin line at bottom centre, fades after first scroll.

### Sky

- Sun top right, smaller than today, reduced opacity, soft glow. Rotating rays removed.
- Stars generated once on load, capped count, no regeneration on resize.
- Meteor: one crossing when the page loads, then repeats at a random interval between 20 and 40 seconds. CSS animation toggled by a class, no permanent `requestAnimationFrame` loop.
- Sky sits behind content. Footer observer that hides stars is removed; the footer is opaque.

### Projects

Title "Selected work".

**Featured tier:** Sepetix, Travela, Fitalyze. Wide cards, one per row on desktop, image left and text right, alternating sides per card. Image at 16:10 crop. Text: year in gold, name, one-line description, three to five tech chips, "View on GitHub" link. Each card has an id `project-<slug>`.

**More projects tier:** remaining eight in a compact grid, three columns desktop, two tablet, one phone. Card: image, name, category pill, one line, link.

Which projects are featured is a content decision the owner will revisit later.

### Experience

Vertical timeline, consistent structure for every entry:

- date range in gold
- role as h3
- company below role
- real `<ul>` bullets
- tags

Logo header block removed. Missing `inovako.svg` reference and the dead placeholder fallback removed. Line and markers in the neutral scale; marker turns cyan when its entry is in view (same observer as scroll reveal).

### Skills

Title "Tech stack". Four labelled marquee strips, alternating direction:

1. Languages and frontend
2. Backend and databases
3. ML and AI
4. DevOps, cloud and mobile

Each strip: a track of logo and name pairs, duplicated once so the CSS translate loop is seamless. Pauses on hover and on touch. Track duplicate is `aria-hidden`; strip has an `aria-label`. Under reduced motion each strip becomes a static wrapping row. Icons keep the devicon CDN.

### Contact

Closing statement. Large heading "Let's build something", one sentence on what the owner is open to (placeholder copy, owner edits), email as a large text link, LinkedIn and GitHub as ghost buttons. Colour-branded pills removed.

### Footer

Single row: name, links to Projects, Experience, Contact, correct email `dev.tunahanbalci@gmail.com`, small copyright. Dead Education and Services links removed.

## Motion

- One scroll-reveal pattern: elements with `.reveal` start translated down and transparent; an IntersectionObserver adds `.is-visible` once. Cards inside a grid stagger by a small per-item delay via a CSS variable.
- Hover: colour and border transitions only.
- Continuous animations: marquee, star twinkle, meteor. All disabled under `prefers-reduced-motion: reduce`, along with scroll reveal (elements render visible).

## Performance

- Fonts loaded once from head with preconnect.
- `assets/projects/driver.jpg` resized to match sibling images and compressed to under 100 KB.
- All images have `width`, `height` and `loading="lazy"` except hero-visible ones.
- Star generation runs once; no resize listener.
- No permanent animation frame loop.

## Accessibility

- Visible focus rings on `--accent`.
- Nav: `aria-current`, hamburger `aria-expanded` and label, Escape closes.
- Marquee: `aria-label` on strip, duplicate track `aria-hidden`.
- Muted text meets AA contrast on `--bg`.
- Semantic landmarks: `nav`, `main`, `section` with headings, `footer`.

## Content changes

Only these. Everything else is verbatim.

- Hero description: ellipsis removed.
- Project cards: existing description text reused as the one-liner.
- Footer email fixed from `hello@example.com` to `dev.tunahanbalci@gmail.com`.
- Removed: Inovako logo reference, dead footer links.
- Placeholders for owner to fill: hero location, contact sentence.

Flagged, not changed: first experience entry reads "Aug 2025 - Aug 2025".

## Out of scope

- Rewriting copy beyond the items above.
- Downloading devicon SVGs into the repo.
- Adding sections (about, education, blog).

## Verification

No test harness. Manual checklist before finishing:

1. Open at 375, 768 and 1280 px widths. No horizontal scroll at any width.
2. Every nav, hero button, proof strip tile and footer link lands on the right section.
3. Mobile menu opens, closes on link, closes on Escape, locks body scroll while open.
4. All 11 GitHub links resolve.
5. Devtools reduced-motion emulation: no marquee, twinkle, meteor or reveal animation.
6. Lighthouse: no failed network requests, cumulative layout shift under 0.1, accessibility with no contrast or label errors.
