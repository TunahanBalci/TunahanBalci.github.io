# UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the single-page portfolio as a disciplined space theme: two accents, a hero with proof, tiered projects, a consistent timeline, marquee tech strips, and a clean contact close.

**Architecture:** Static site, three source files. `styles.css` is rewritten in Task 1 as a token-based foundation, and each later task appends one commented section block. `index.html` is rewritten one section at a time between its `<!-- ... -->` markers. `script.js` is rewritten in Task 2 as one `init*` function per feature, called from a `// ---------- start ----------` block at the bottom.

**Tech Stack:** HTML, CSS, vanilla JS. No build step, no libraries. Tests: `tools/check.mjs`, a zero-dependency Node script that drives the local Google Chrome over the DevTools protocol.

**Spec:** `docs/superpowers/specs/2026-09-23-ui-redesign-design.md`

## Global Constraints

- Work on a branch named `ui-redesign`, never on `main`.
- No build step, no npm packages, no new libraries. `tools/check.mjs` uses only Node built-ins (Node 22+) and the installed `google-chrome`.
- Files touched: `index.html`, `styles.css`, `script.js`, `assets/projects/driver.jpg`, `tools/check.mjs`. Nothing else.
- Colours come only from the tokens in Task 1. `--accent` `#22d3ee` is for links, buttons, active nav, hover borders and focus rings only. `--gold` `#f5c451` is for the sun, brand mark, eyebrow labels, years and dates only.
- One font: Inter, weights 400 to 800, loaded once from the `<head>`.
- Section ids stay `home`, `work`, `experience`, `skills`, `contact`.
- Copy is verbatim from the current page except the items under "Content changes" in the spec.
- Every continuous animation stops under `prefers-reduced-motion: reduce`.
- Target: current evergreen browsers. `:has()`, `svh`, `mask-image` and `clamp()` are fine.
- Run the whole suite with `node tools/check.mjs` from the repo root. A task is done only when every check, old and new, passes.

## Review Focus

1. **Opening the mobile menu after scrolling.** The panel must cover the whole screen. A `backdrop-filter` on the fixed header would trap the fixed panel inside the 68px bar. Test in Task 3.
2. **Rotating a phone or widening the window with the menu open.** The page must not stay scroll-locked on desktop. Test in Task 3.
3. **Jumping to a section from any in-page link.** The section top must land below the fixed bar, not under it. Test in Task 3.
4. **JavaScript blocked or failing.** Every `.reveal` element must still be visible, because hiding is gated on the `js` class. Test in Task 5.
5. **A 320px phone.** The long email address, proof strip and marquees must not cause sideways page scroll. Tests in Task 8 and Task 9.

## Known limitation to tell the owner

`travela.png` is 250px wide and `fitalyze.png` is 200px wide. Both appear in large featured cards and will look soft. The fix is larger screenshots from the owner, not code.

---

### Task 1: Check harness and visual foundation

**Files:**
- Create: `tools/check.mjs`
- Rewrite: `styles.css`
- Modify: `index.html` (the `<head>`, wave dividers, add `<main>`)

**Interfaces:**
- Produces, in `tools/check.mjs`: `check(name, fn)`, `assert(ok, message)`, `sleep(ms)`, `load({ width = 1280, height = 900, reducedMotion = false })`, `viewport(width, height)`, `js(expression)` returning the value, `cdp(method, params)`, `pageErrors()` returning string array, `brokenImages()` returning a promise of local `src` strings, `contrast(hexA, hexB)` returning a ratio, constants `ROOT`, `readFileSync`, `statSync`. New checks go above the `// ---------- run ----------` line.
- Produces, in `styles.css`: tokens `--bg`, `--bg-raised`, `--bg-footer`, `--surface`, `--surface-hover`, `--line`, `--text`, `--text-muted`, `--accent`, `--accent-ink`, `--gold`, `--font`, `--fs-display`, `--fs-h2`, `--fs-h3`, `--fs-lead`, `--fs-body`, `--fs-small`, `--radius`, `--radius-pill`, `--container`, `--gutter`, `--section-y`, `--nav-h`, `--ease`. Classes `.container`, `.section`, `.section--raised`, `.eyebrow`, `.section-head`, `.section-lead`, `.btn`, `.btn-primary`, `.btn-ghost`, `.chips`, `.pill`, `.link-arrow`, `.year`.
- Produces, in `index.html`: the `js` class on `<html>` before first paint; `<main>` directly before `<!-- Hero Section -->` and `</main>` directly before `<!-- Footer -->`.

- [ ] **Step 1: Create the branch**

```bash
git checkout -b ui-redesign
```

- [ ] **Step 2: Write the harness with the foundation checks**

Create `tools/check.mjs`:

```js
// Browser checks for the portfolio. Zero dependencies: Node 22+ and a local Chrome.
// Run from the repo root:   node tools/check.mjs
// Chrome not on PATH as google-chrome?   CHROME=/path/to/chrome node tools/check.mjs
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = pathToFileURL(join(ROOT, 'index.html')).href;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const checks = [];
const check = (name, fn) => checks.push({ name, fn });

// ---------- browser plumbing ----------
let cdp;
let events = [];
let waiters = [];
let loads = 0;

async function launch() {
  const profile = mkdtempSync(join(tmpdir(), 'portfolio-check-'));
  const chrome = spawn(process.env.CHROME || 'google-chrome', [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' });
  const portFile = join(profile, 'DevToolsActivePort');
  let port = '';
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100);
    if (existsSync(portFile)) port = readFileSync(portFile, 'utf8').split('\n')[0];
  }
  assert(port, 'Chrome did not start. Is google-chrome installed, or CHROME set?');
  const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((ok, fail) => { ws.onopen = ok; ws.onerror = fail; });

  let id = 0;
  const pending = new Map();
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.id) { pending.get(msg.id)?.(msg.result ?? { error: msg.error }); pending.delete(msg.id); return; }
    events.push(msg);
    waiters = waiters.filter(w => (w.method === msg.method ? (w.done(msg), false) : true));
  };
  cdp = (method, params = {}) => new Promise(done => {
    pending.set(++id, done);
    ws.send(JSON.stringify({ id, method, params }));
  });
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  return () => {
    ws.close();
    chrome.kill();
    try { rmSync(profile, { recursive: true, force: true, maxRetries: 5 }); } catch {}
  };
}

async function js(expression) {
  const { result, exceptionDetails } = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
  return result?.value;
}

// mobile: false keeps the layout viewport equal to the width, so overflow is measurable.
const viewport = (width, height) =>
  cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });

async function load({ width = 1280, height = 900, reducedMotion = false } = {}) {
  await viewport(width, height);
  await cdp('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' }],
  });
  events = [];
  const loaded = new Promise(done => waiters.push({ method: 'Page.loadEventFired', done }));
  await cdp('Page.navigate', { url: `${PAGE}?run=${++loads}` }); // query forces a full load every time
  await loaded;
  await sleep(150);
}

const pageErrors = () => events
  .filter(e => e.method === 'Runtime.exceptionThrown')
  .map(e => e.params.exceptionDetails.exception?.description ?? e.params.exceptionDetails.text);

// Local images that finished loading but have no pixels. Remote (CDN) icons are ignored.
const brokenImages = () => js(`[...document.images]
  .filter(i => !/^https?:/.test(i.getAttribute('src')) && i.complete && i.naturalWidth === 0)
  .map(i => i.getAttribute('src'))`);

// WCAG contrast ratio between two #rrggbb colours.
function contrast(a, b) {
  const lum = hex => {
    const [r, g, bl] = hex.trim().slice(1).match(/../g).map(h => parseInt(h, 16) / 255)
      .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ---------- foundation ----------
check('foundation: Inter loads once from the head, no CSS @import', async () => {
  await load();
  const links = await js(`document.querySelectorAll('head link[href*="fonts.googleapis.com/css"]').length`);
  assert(links === 1, `expected 1 font stylesheet link, found ${links}`);
  assert(!readFileSync(join(ROOT, 'styles.css'), 'utf8').includes('@import'), 'styles.css still has an @import');
});

check('foundation: styles.css has no legacy palette, Nunito or bounce easing', () => {
  const css = readFileSync(join(ROOT, 'styles.css'), 'utf8').toLowerCase();
  const legacy = ['#ff007a', '#9d00ff', '#00ff94', '#ff5e00', '#00e5ff', '#394359', 'nunito', '--bounce']
    .filter(s => css.includes(s));
  assert(legacy.length === 0, `legacy styles remain: ${legacy.join(', ')}`);
});

check('foundation: text colours meet WCAG AA on the page background', async () => {
  await load();
  const tokens = await js(`(() => { const s = getComputedStyle(document.documentElement);
    return ['--bg', '--text', '--text-muted', '--gold', '--accent'].map(v => s.getPropertyValue(v).trim()); })()`);
  assert(tokens.every(c => /^#[0-9a-f]{6}$/i.test(c)), `tokens must be #rrggbb, got: ${tokens.join(', ')}`);
  const [bg, ...fg] = tokens;
  fg.forEach(c => assert(contrast(c, bg) >= 4.5, `${c} on ${bg} is only ${contrast(c, bg).toFixed(2)}:1`));
});

check('foundation: wave dividers are gone', async () => {
  await load();
  assert(await js(`document.querySelectorAll('.wave-container').length`) === 0, 'wave dividers remain');
});

check('foundation: sections sit inside one main landmark, in page order', async () => {
  await load();
  const ids = await js(`[...document.querySelectorAll('main > section[id]')].map(s => s.id).join()`);
  assert(ids === 'home,work,experience,skills,contact', `main holds: ${ids || 'nothing'}`);
});

check('foundation: the js class is set in the head before first paint', async () => {
  await load();
  const inHead = await js(`[...document.head.querySelectorAll('script')].some(s => s.textContent.includes("classList.add('js')"))`);
  assert(inHead, 'inline js-class script missing from <head>');
});

check('foundation: no script errors on load', async () => {
  await load();
  assert(pageErrors().length === 0, pageErrors().join(' | '));
});

// ---------- run ----------
const close = await launch();
let failed = 0;
try {
  for (const { name, fn } of checks) {
    try {
      await Promise.race([fn(), sleep(15000).then(() => { throw new Error('timed out after 15s'); })]);
      console.log(`PASS  ${name}`);
    } catch (err) {
      failed++;
      console.log(`FAIL  ${name}\n      ${String(err.message).split('\n')[0]}`);
    }
  }
} finally {
  close();
}
console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
process.exit(failed ? 1 : 0);
```

- [ ] **Step 3: Run it and confirm the foundation checks fail**

Run: `node tools/check.mjs`
Expected: FAIL on the font check (styles.css has `@import`), the legacy palette check, the contrast check (`--bg` is not defined), the wave check, the main landmark check and the js-class check. "no script errors on load" already passes; it guards later tasks.

- [ ] **Step 4: Replace `styles.css` entirely**

```css
/* ============ Tokens ============ */
:root {
    --bg: #05070d;
    --bg-raised: rgba(16, 22, 40, 0.55);
    --bg-footer: #070a14;
    --surface: rgba(255, 255, 255, 0.04);
    --surface-hover: rgba(255, 255, 255, 0.07);
    --line: rgba(255, 255, 255, 0.1);
    --text: #f2f4f8;
    --text-muted: #9aa3b5;
    --accent: #22d3ee;
    --accent-ink: #03141a;
    --gold: #f5c451;

    --font: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
    --fs-display: clamp(2.75rem, 6vw + 1rem, 5.5rem);
    --fs-h2: clamp(2rem, 2.5vw + 1.25rem, 3rem);
    --fs-h3: clamp(1.2rem, 0.6vw + 1rem, 1.5rem);
    --fs-lead: clamp(1.05rem, 0.4vw + 1rem, 1.25rem);
    --fs-body: 1rem;
    --fs-small: 0.875rem;

    --radius: 16px;
    --radius-pill: 999px;
    --container: 1120px;
    --gutter: clamp(16px, 4vw, 32px);
    --section-y: clamp(88px, 11vw, 144px);
    --nav-h: 68px;
    --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
}

/* ============ Base ============ */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; scroll-padding-top: var(--nav-h); -webkit-text-size-adjust: 100%; }
body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font);
    font-size: var(--fs-body);
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
}
img, svg { display: block; max-width: 100%; height: auto; }
a { color: inherit; text-decoration: none; }
ul, ol { list-style: none; }
button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
h1, h2, h3, h4 { font-weight: 800; letter-spacing: -0.02em; line-height: 1.1; text-wrap: balance; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
::selection { background: var(--accent); color: var(--accent-ink); }

/* ============ Layout ============ */
main { position: relative; z-index: 1; }
.container {
    width: 100%;
    max-width: calc(var(--container) + 2 * var(--gutter));
    margin-inline: auto;
    padding-inline: var(--gutter);
}
.section { padding-block: var(--section-y); }
.section--raised {
    background: linear-gradient(180deg, transparent, var(--bg-raised) 12%, var(--bg-raised) 88%, transparent);
}

/* ============ Components ============ */
.eyebrow {
    margin-bottom: 16px;
    color: var(--gold);
    font-size: var(--fs-small);
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
}
.section-head { max-width: 640px; margin-bottom: clamp(40px, 6vw, 64px); }
.section-head h2 { font-size: var(--fs-h2); }
.section-lead { margin-top: 16px; color: var(--text-muted); font-size: var(--fs-lead); }

.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    padding: 0 24px;
    border-radius: var(--radius-pill);
    font-weight: 600;
    transition: background-color 0.2s var(--ease), border-color 0.2s var(--ease), color 0.2s var(--ease);
}
.btn-primary { background: var(--accent); color: var(--accent-ink); }
.btn-primary:hover { background: #67e8f9; }
.btn-ghost { border: 1px solid var(--line); color: var(--text); }
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }

.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chips li, .pill {
    padding: 4px 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    color: var(--text-muted);
    font-size: 0.8125rem;
    font-weight: 500;
}

.link-arrow { display: inline-flex; gap: 6px; color: var(--accent); font-weight: 600; }
.link-arrow span { transition: transform 0.2s var(--ease); }
.link-arrow:hover span { transform: translateX(4px); }

.year { color: var(--gold); font-weight: 600; }

/* ============ Reduced motion (global kill switch) ============ */
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
    html { scroll-behavior: auto; }
}
```

- [ ] **Step 5: Rewrite the head, remove the waves, add `<main>`**

Run from the repo root:

```bash
python3 - <<'PY'
import pathlib, re
p = pathlib.Path('index.html')
html = p.read_text()
head = '''<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="theme-color" content="#05070d">
    <title>Tunahan BALCI | Software Engineer</title>
    <link rel="icon" type="image/png" href="assets/icon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">
    <link rel="stylesheet" href="styles.css">
    <script>document.documentElement.classList.add('js')</script>
</head>'''
html, n = re.subn(r'<head>.*?</head>', head, html, count=1, flags=re.S)
assert n == 1
html, waves = re.subn(r'\s*<div class="wave-container[^"]*">.*?</svg>\s*</div>', '', html, flags=re.S)
print('waves removed:', waves)
assert html.count('    <!-- Hero Section -->') == 1 and html.count('    <!-- Footer -->') == 1
html = html.replace('    <!-- Hero Section -->', '    <main>\n    <!-- Hero Section -->')
html = html.replace('    <!-- Footer -->', '    </main>\n\n    <!-- Footer -->')
p.write_text(html)
PY
```

Expected output: `waves removed: 5`.

- [ ] **Step 6: Run the checks and confirm they pass**

Run: `node tools/check.mjs`
Expected: `7/7 checks passed`. The old sections look unstyled now. That is expected until their tasks replace them.

- [ ] **Step 7: Commit**

```bash
git add tools/check.mjs styles.css index.html
git commit -m "feat: token foundation, browser check harness, remove wave dividers"
```

---

### Task 2: Sky layer

**Files:**
- Modify: `index.html` (block from `<!-- Space Background -->` up to, not including, `<!-- Navigation -->`)
- Modify: `styles.css` (append Sky block)
- Rewrite: `script.js`
- Modify: `tools/check.mjs` (add Sky checks)

**Interfaces:**
- Consumes: `load`, `js`, `viewport`, `sleep`, `assert`, `check` from Task 1; `--gold`, `--ease` tokens.
- Produces: `#stars`, `#meteor`, `.sky`; in `script.js` the constant `reducedMotion` (a `MediaQueryList`), functions `initSky()` and `initMeteor()`, and the `// ---------- start ----------` call block that later tasks append to.

- [ ] **Step 1: Add the failing checks**

Insert above `// ---------- run ----------` in `tools/check.mjs`:

```js
// ---------- sky ----------
check('sky: old sun rays, star images and scroll meteor are gone', async () => {
  await load();
  assert(!(await js(`!!document.querySelector('#sky-elements, #scroll-meteor, .sun-wrapper')`)), 'legacy sky markup remains');
  assert(await js(`document.querySelector('.sky')?.getAttribute('aria-hidden')`) === 'true', '.sky must be aria-hidden');
});

check('sky: stars are generated once and survive a resize', async () => {
  await load();
  const read = `[document.querySelectorAll('#stars .star').length, document.querySelector('#stars .star')?.style.left]`;
  const [count, left] = await js(read);
  assert(count > 20 && count <= 160, `expected 21 to 160 stars, got ${count}`);
  await viewport(800, 600);
  await sleep(700);
  const [count2, left2] = await js(read);
  assert(count2 === count && left2 === left, 'stars were regenerated on resize');
});

check('sky: meteor crosses shortly after load', async () => {
  await load();
  await sleep(1500);
  assert(await js(`document.getElementById('meteor').classList.contains('is-flying')`), 'meteor did not fly');
});

check('sky: meteor stays still with reduced motion', async () => {
  await load({ reducedMotion: true });
  await sleep(1500);
  assert(!(await js(`document.getElementById('meteor').classList.contains('is-flying')`)), 'meteor flew under reduced motion');
});
```

- [ ] **Step 2: Run and confirm the new checks fail**

Run: `node tools/check.mjs`
Expected: the four `sky:` checks FAIL (legacy markup present, `#stars` and `#meteor` missing). The seven foundation checks PASS.

- [ ] **Step 3: Replace the sky markup**

In `index.html`, replace everything from the line `<!-- Space Background -->` up to, not including, `<!-- Navigation -->` with:

```html
    <!-- Space Background -->
    <div class="sky" aria-hidden="true">
        <div class="sun"><img src="./assets/bg_elements/sun.png" alt="" width="1257" height="1287"></div>
        <div class="stars" id="stars"></div>
        <span class="meteor" id="meteor"></span>
    </div>

```

- [ ] **Step 4: Append the Sky block to `styles.css`**

```css
/* ============ Sky ============ */
.sky { position: fixed; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }

.sun {
    position: absolute;
    top: clamp(-160px, -12vw, -60px);
    right: clamp(-160px, -12vw, -60px);
    width: clamp(240px, 32vw, 440px);
    opacity: 0.5;
}
.sun::before {
    content: '';
    position: absolute;
    inset: -35%;
    background: radial-gradient(circle, rgba(245, 196, 81, 0.22), transparent 62%);
    animation: sun-glow 8s ease-in-out infinite alternate;
}
.sun img { position: relative; width: 100%; }
@keyframes sun-glow { to { opacity: 0.55; transform: scale(1.08); } }

.stars { position: absolute; inset: 0; }
.star {
    position: absolute;
    border-radius: 50%;
    background: #fff;
    opacity: 0.7;
    animation: twinkle 5s ease-in-out infinite;
}
@keyframes twinkle { 50% { opacity: 0.2; } }

/* A thin gold streak. tan(14deg) = 0.25, so the path matches the tilt at every width. */
.meteor {
    position: absolute;
    top: 14%;
    left: 0;
    width: 160px;
    height: 2px;
    border-radius: 2px;
    background: linear-gradient(90deg, transparent, rgba(245, 196, 81, 0.9));
    opacity: 0;
    transform: translate3d(-200px, 0, 0) rotate(14deg);
}
.meteor.is-flying { animation: meteor 1.8s var(--ease) forwards; }
@keyframes meteor {
    10% { opacity: 1; }
    to { opacity: 0; transform: translate3d(110vw, 27.5vw, 0) rotate(14deg); }
}
```

- [ ] **Step 5: Replace `script.js` entirely**

```js
// Portfolio behaviour. One init function per feature, called from the start block at the bottom.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Stars are generated once. Positions are percentages, so a resize needs no rebuild.
function initSky() {
    const stars = document.getElementById('stars');
    const count = Math.min(160, Math.round((innerWidth * innerHeight) / 11000));
    for (let i = 0; i < count; i++) {
        const star = document.createElement('span');
        const size = Math.random() < 0.85 ? 1 + Math.random() : 2 + Math.random();
        star.className = 'star';
        star.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;` +
            `width:${size}px;height:${size}px;` +
            `animation-duration:${3 + Math.random() * 4}s;animation-delay:${-Math.random() * 7}s`;
        stars.append(star);
    }
}

// One crossing shortly after load, then again every 20 to 40 seconds.
function initMeteor() {
    if (reducedMotion.matches) return;
    const meteor = document.getElementById('meteor');
    meteor.addEventListener('animationend', () => meteor.classList.remove('is-flying'));
    const fly = () => {
        meteor.classList.add('is-flying');
        setTimeout(fly, 20000 + Math.random() * 20000);
    };
    setTimeout(fly, 1200);
}

// ---------- start ----------
initSky();
initMeteor();
```

- [ ] **Step 6: Run and confirm everything passes**

Run: `node tools/check.mjs`
Expected: `11/11 checks passed`.

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css script.js tools/check.mjs
git commit -m "feat: quiet sky layer with one-time stars and timed meteor"
```

---

### Task 3: Navigation

**Files:**
- Modify: `index.html` (block from `<!-- Navigation -->` up to, not including, `<main>`)
- Modify: `styles.css` (append Navigation block)
- Modify: `script.js` (add `initNav`, call it)
- Modify: `tools/check.mjs` (add Navigation checks)

**Interfaces:**
- Consumes: `load`, `js`, `viewport`, `sleep` from Task 1. Tokens `--nav-h`, `--gold`, `--accent`, `--line`, `--text`, `--text-muted`, `--ease`.
- Produces: the `is-scrolled` class on `<html>` once `scrollY > 8` (Task 4's scroll cue uses it); the `menu-open` class on `<html>` while the mobile panel is open; `.site-nav`, `.nav-inner`, `.nav-toggle`, `#nav-menu` with class `.nav-links`; `aria-current="page"` on the active link.

- [ ] **Step 1: Add the failing checks**

Insert above `// ---------- run ----------`:

```js
// ---------- navigation ----------
const isScrolled = `document.documentElement.classList.contains('is-scrolled')`;
const menuOpen = `document.documentElement.classList.contains('menu-open')`;

check('nav: five links in page order', async () => {
  await load();
  const hrefs = await js(`[...document.querySelectorAll('#nav-menu a')].map(a => a.getAttribute('href')).join()`);
  assert(hrefs === '#home,#work,#experience,#skills,#contact', `nav links: ${hrefs}`);
});

check('nav: bar turns solid once the page scrolls', async () => {
  await load({ reducedMotion: true });
  assert(!(await js(isScrolled)), 'bar is solid at the top');
  await js(`scrollTo(0, 200)`);
  await sleep(100);
  assert(await js(isScrolled), 'bar did not turn solid after scrolling');
});

check('nav: active link follows the section in view', async () => {
  await load({ reducedMotion: true });
  for (const id of ['work', 'experience', 'skills', 'contact']) {
    await js(`document.getElementById('${id}').scrollIntoView()`);
    await sleep(250);
    const current = await js(`document.querySelector('#nav-menu a[aria-current="page"]')?.getAttribute('href')`);
    assert(current === `#${id}`, `at #${id} the active link is ${current}`);
  }
});

check('nav: anchor jumps land below the fixed bar', async () => {
  await load({ reducedMotion: true });
  for (const id of ['work', 'experience', 'skills']) {
    await js(`document.querySelector('#nav-menu a[href="#${id}"]').click()`);
    await sleep(100);
    const [top, barBottom] = await js(`[document.getElementById('${id}').getBoundingClientRect().top,
      document.querySelector('.nav-inner').getBoundingClientRect().bottom]`);
    assert(top >= barBottom - 1, `#${id} starts at ${top}px, under the bar ending at ${barBottom}px`);
  }
});

check('nav: mobile menu covers the screen, locks scroll, closes on Escape and on link', async () => {
  await load({ width: 375, height: 812, reducedMotion: true });
  await js(`scrollTo(0, 600)`); // the blurred bar is showing now
  await sleep(100);
  await js(`document.querySelector('.nav-toggle').click()`);
  const s = await js(`(() => { const m = document.getElementById('nav-menu'); return {
    expanded: document.querySelector('.nav-toggle').getAttribute('aria-expanded'),
    height: m.getBoundingClientRect().height,
    visibility: getComputedStyle(m).visibility,
    overflow: getComputedStyle(document.documentElement).overflow }; })()`);
  assert(s.expanded === 'true', 'aria-expanded is not true');
  assert(s.visibility === 'visible', 'panel is not visible');
  assert(s.height >= 811, `panel is ${s.height}px tall, expected the full 812px screen`);
  assert(s.overflow === 'hidden', 'page scroll is not locked');
  await js(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`);
  assert(await js(`document.querySelector('.nav-toggle').getAttribute('aria-expanded')`) === 'false', 'Escape did not close the menu');
  await js(`document.querySelector('.nav-toggle').click()`);
  await js(`document.querySelector('#nav-menu a[href="#skills"]').click()`);
  assert(!(await js(menuOpen)), 'clicking a link did not close the menu');
});

check('nav: an open menu closes when the viewport grows to desktop', async () => {
  await load({ width: 375, height: 812 });
  await js(`document.querySelector('.nav-toggle').click()`);
  assert(await js(menuOpen), 'menu did not open');
  await viewport(1280, 900);
  await sleep(200);
  assert(!(await js(menuOpen)), 'page is still scroll-locked on desktop');
});
```

- [ ] **Step 2: Run and confirm the new checks fail**

Run: `node tools/check.mjs`
Expected: all six `nav:` checks FAIL because `#nav-menu`, `.nav-toggle` and `.nav-inner` do not exist. Earlier checks PASS.

- [ ] **Step 3: Replace the navigation markup**

In `index.html`, replace everything from `<!-- Navigation -->` up to, not including, `<main>` with:

```html
    <!-- Navigation -->
    <header class="site-nav">
        <nav class="container nav-inner" aria-label="Primary">
            <a class="brand" href="#home">Tunahan BALCI</a>
            <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="nav-menu" aria-label="Open menu">
                <span></span><span></span>
            </button>
            <ul class="nav-links" id="nav-menu">
                <li><a href="#home">Home</a></li>
                <li><a href="#work">Projects</a></li>
                <li><a href="#experience">Experience</a></li>
                <li><a href="#skills">Skills</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
        </nav>
    </header>

```

- [ ] **Step 4: Append the Navigation block to `styles.css`**

```css
/* ============ Navigation ============ */
.site-nav { position: fixed; inset: 0 0 auto; z-index: 100; }
/* The blurred bar lives on a pseudo-element. A backdrop-filter on .site-nav itself would
   make it the containing block for the fixed mobile panel and squash the panel into the bar. */
.site-nav::before {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(5, 7, 13, 0.72);
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--line);
    opacity: 0;
    transition: opacity 0.3s var(--ease);
}
.is-scrolled .site-nav::before { opacity: 1; }

.nav-inner { position: relative; display: flex; align-items: center; justify-content: space-between; height: var(--nav-h); }
.brand { color: var(--gold); font-weight: 800; letter-spacing: -0.01em; }
.nav-links { display: flex; gap: 32px; }
.nav-links a { color: var(--text-muted); font-size: 0.9375rem; font-weight: 500; transition: color 0.2s var(--ease); }
.nav-links a:hover { color: var(--text); }
.nav-links a[aria-current="page"] { color: var(--accent); }

.nav-toggle { display: none; position: relative; z-index: 2; width: 44px; height: 44px; margin-right: -10px; place-content: center; gap: 6px; }
.nav-toggle span { display: block; width: 22px; height: 2px; border-radius: 2px; background: var(--text); transition: transform 0.3s var(--ease); }
.menu-open .nav-toggle span:first-child { transform: translateY(4px) rotate(45deg); }
.menu-open .nav-toggle span:last-child { transform: translateY(-4px) rotate(-45deg); }
.menu-open { overflow: hidden; }

@media (max-width: 767px) {
    .nav-toggle { display: grid; }
    .nav-links {
        position: fixed;
        inset: 0;
        z-index: 1;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 28px;
        background: rgba(5, 7, 13, 0.97);
        opacity: 0;
        visibility: hidden;
        transform: translateY(-12px);
        transition: opacity 0.3s var(--ease), transform 0.3s var(--ease), visibility 0s linear 0.3s;
    }
    .nav-links a { color: var(--text); font-size: 1.75rem; font-weight: 700; }
    .menu-open .nav-links {
        opacity: 1;
        visibility: visible;
        transform: none;
        transition: opacity 0.3s var(--ease), transform 0.3s var(--ease);
    }
}
```

- [ ] **Step 5: Add `initNav` to `script.js`**

Insert above the `// ---------- start ----------` line:

```js
// Fixed nav: solid once the page leaves the top, active link follows the section in view,
// and on mobile the toggle opens a full-screen panel that locks page scroll.
function initNav() {
    const root = document.documentElement;
    const toggle = document.querySelector('.nav-toggle');
    const links = [...document.querySelectorAll('#nav-menu a')];

    const onScroll = () => root.classList.toggle('is-scrolled', scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const setMenu = open => {
        root.classList.toggle('menu-open', open);
        toggle.setAttribute('aria-expanded', open);
        toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
    links.forEach(a => a.addEventListener('click', () => setMenu(false)));
    addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });
    matchMedia('(min-width: 768px)').addEventListener('change', e => { if (e.matches) setMenu(false); });

    // A thin band across the middle of the viewport decides which section is current.
    const spy = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            links.forEach(a => a.getAttribute('href') === `#${entry.target.id}`
                ? a.setAttribute('aria-current', 'page')
                : a.removeAttribute('aria-current'));
        }
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main section[id]').forEach(section => spy.observe(section));
}
```

Append to the start block:

```js
initNav();
```

- [ ] **Step 6: Run and confirm everything passes**

Run: `node tools/check.mjs`
Expected: `17/17 checks passed`.

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css script.js tools/check.mjs
git commit -m "feat: translucent nav with active tracking and full-screen mobile menu"
```

---

### Task 4: Hero with proof strip

**Files:**
- Modify: `index.html` (block from `<!-- Hero Section -->` up to, not including, `<!-- Projects Section -->`)
- Modify: `styles.css` (append Hero block)
- Modify: `tools/check.mjs` (add Hero checks)

**Interfaces:**
- Consumes: `is-scrolled` on `<html>` from Task 3; `.eyebrow`, `.btn`, `.btn-primary`, `.btn-ghost`, `.container` from Task 1.
- Produces: proof tiles linking to `#project-sepetix`, `#project-travela`, `#project-fitalyze`. Task 5 must create those ids.

- [ ] **Step 1: Add the failing checks**

Insert above `// ---------- run ----------`:

```js
// ---------- hero ----------
check('hero: name, one-sentence lead, two actions, three proof tiles', async () => {
  await load();
  const h = await js(`({
    h1: document.querySelector('#home h1')?.textContent.trim(),
    lead: document.querySelector('.hero-lead')?.textContent.trim(),
    actions: [...document.querySelectorAll('.hero-actions a')].map(a => a.getAttribute('href')).join(),
    tiles: [...document.querySelectorAll('.proof-tile')].map(a => a.getAttribute('href')).join() })`);
  assert(h.h1 === 'Tunahan Balcı', `h1 is ${h.h1}`);
  assert(h.lead === "I don't see myself as just a Software Engineer, but as a problem solver.", `lead is ${h.lead}`);
  assert(h.actions === '#work,#contact', `actions: ${h.actions}`);
  assert(h.tiles === '#project-sepetix,#project-travela,#project-fitalyze', `tiles: ${h.tiles}`);
});

for (const [width, height] of [[375, 640], [1280, 600], [1280, 900]]) {
  check(`hero: nothing overlaps at ${width}x${height}`, async () => {
    await load({ width, height });
    const r = await js(`(() => { const b = s => document.querySelector(s).getBoundingClientRect();
      return { actions: b('.hero-actions').bottom, proofTop: b('.proof').top, proofBottom: b('.proof').bottom, cue: b('.scroll-cue').top }; })()`);
    assert(r.actions <= r.proofTop, `buttons (${r.actions}) run into the proof strip (${r.proofTop})`);
    assert(r.proofBottom <= r.cue, `proof strip (${r.proofBottom}) runs into the scroll cue (${r.cue})`);
  });
}

check('hero: scroll cue fades once the page scrolls', async () => {
  await load({ reducedMotion: true });
  await js(`scrollTo(0, 100)`);
  await sleep(100);
  assert(await js(`getComputedStyle(document.querySelector('.scroll-cue')).opacity`) === '0', 'scroll cue still visible');
});
```

- [ ] **Step 2: Run and confirm the new checks fail**

Run: `node tools/check.mjs`
Expected: the five `hero:` checks FAIL (`.hero-lead`, `.proof` and `.scroll-cue` do not exist). Earlier checks PASS.

- [ ] **Step 3: Replace the hero markup**

In `index.html`, replace everything from `<!-- Hero Section -->` up to, not including, `<!-- Projects Section -->` with:

```html
    <!-- Hero Section -->
    <section id="home" class="hero">
        <div class="container hero-inner">
            <!-- owner: add " · City" after the title when ready -->
            <p class="eyebrow">Software Engineer</p>
            <h1 class="hero-title">Tunahan Balcı</h1>
            <p class="hero-lead">I don't see myself as just a Software Engineer, but as a problem solver.</p>
            <div class="hero-actions">
                <a class="btn btn-primary" href="#work">View projects</a>
                <a class="btn btn-ghost" href="#contact">Get in touch</a>
            </div>
        </div>
        <div class="container">
            <ul class="proof" aria-label="Featured projects">
                <li>
                    <a class="proof-tile" href="#project-sepetix">
                        <img src="./assets/projects/shopping_platform.png" alt="" width="1389" height="1242">
                        <span class="proof-text"><strong>Sepetix</strong><span>Full-Stack &amp; DevOps</span></span>
                        <span class="proof-arrow" aria-hidden="true">→</span>
                    </a>
                </li>
                <li>
                    <a class="proof-tile" href="#project-travela">
                        <img src="./assets/projects/travela.png" alt="" width="250" height="228">
                        <span class="proof-text"><strong>Travela</strong><span>Full-Stack · ASP.NET</span></span>
                        <span class="proof-arrow" aria-hidden="true">→</span>
                    </a>
                </li>
                <li>
                    <a class="proof-tile" href="#project-fitalyze">
                        <img src="./assets/projects/fitalyze.png" alt="" width="200" height="150">
                        <span class="proof-text"><strong>Fitalyze</strong><span>Full-Stack · AI</span></span>
                        <span class="proof-arrow" aria-hidden="true">→</span>
                    </a>
                </li>
            </ul>
        </div>
        <a class="scroll-cue" href="#work">Scroll</a>
    </section>

```

- [ ] **Step 4: Append the Hero block to `styles.css`**

```css
/* ============ Hero ============ */
.hero {
    position: relative;
    display: grid;
    grid-template-rows: 1fr auto;
    gap: 48px;
    min-height: 100svh;
    padding-top: calc(var(--nav-h) + 32px);
    padding-bottom: 88px; /* room for the scroll cue */
}
.hero-inner { align-self: center; }
.hero-title { font-size: var(--fs-display); letter-spacing: -0.035em; }
.hero-lead { max-width: 34ch; margin-top: 20px; color: var(--text-muted); font-size: var(--fs-lead); }
.hero-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 36px; }

.proof { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.proof-tile {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 100%;
    padding: 12px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    transition: border-color 0.2s var(--ease), background-color 0.2s var(--ease);
}
.proof-tile:hover { border-color: var(--accent); background: var(--surface-hover); }
.proof-tile img { flex-shrink: 0; width: 56px; height: 56px; border-radius: 10px; object-fit: cover; }
.proof-text { display: grid; min-width: 0; }
.proof-text strong { font-weight: 700; }
.proof-text span { color: var(--text-muted); font-size: var(--fs-small); }
.proof-arrow { margin-left: auto; color: var(--accent); transition: transform 0.2s var(--ease); }
.proof-tile:hover .proof-arrow { transform: translateX(4px); }

.scroll-cue {
    position: absolute;
    left: 50%;
    bottom: 20px;
    display: grid;
    justify-items: center;
    gap: 8px;
    transform: translateX(-50%);
    color: var(--text-muted);
    font-size: 0.75rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    transition: opacity 0.4s var(--ease);
}
.scroll-cue::after { content: ''; width: 1px; height: 32px; background: linear-gradient(var(--text-muted), transparent); }
.is-scrolled .scroll-cue { opacity: 0; pointer-events: none; }

@media (max-width: 767px) {
    .proof {
        grid-template-columns: none;
        grid-auto-flow: column;
        grid-auto-columns: minmax(240px, 82%);
        margin-inline: calc(-1 * var(--gutter));
        padding-inline: var(--gutter);
        overflow-x: auto;
        scroll-snap-type: x mandatory;
        scroll-padding-inline: var(--gutter);
        scrollbar-width: none;
    }
    .proof li { scroll-snap-align: start; }
}
```

- [ ] **Step 5: Run and confirm everything passes**

Run: `node tools/check.mjs`
Expected: `22/22 checks passed`.

- [ ] **Step 6: Commit**

```bash
git add index.html styles.css tools/check.mjs
git commit -m "feat: left-aligned hero with featured-project proof strip"
```

---

### Task 5: Projects and scroll reveal

**Files:**
- Modify: `index.html` (block from `<!-- Projects Section -->` up to, not including, `<!-- Experience Section -->`)
- Modify: `assets/projects/driver.jpg` (resize)
- Modify: `styles.css` (append Projects and Reveal blocks)
- Modify: `script.js` (add `initReveal`, call it)
- Modify: `tools/check.mjs` (add Projects and Reveal checks)

**Interfaces:**
- Consumes: `.section`, `.section--raised`, `.section-head`, `.eyebrow`, `.section-lead`, `.chips`, `.pill`, `.year`, `.link-arrow` from Task 1.
- Produces: ids `project-sepetix`, `project-travela`, `project-fitalyze`. The `.reveal` class: any element with it fades up once and gains `is-visible`. Tasks 6, 7 and 8 rely on `.reveal` and `.is-visible`. The `.meta` row class.

- [ ] **Step 1: Add the failing checks**

Insert above `// ---------- run ----------`:

```js
// ---------- projects ----------
check('projects: three featured cards then eight compact cards, all linking to GitHub', async () => {
  await load();
  const p = await js(`({
    features: [...document.querySelectorAll('#work .feature')].map(f => f.id).join(),
    cards: document.querySelectorAll('#work .card').length,
    links: [...document.querySelectorAll('#work .feature a, #work .card a')].map(a => a.href) })`);
  assert(p.features === 'project-sepetix,project-travela,project-fitalyze', `featured ids: ${p.features}`);
  assert(p.cards === 8, `expected 8 compact cards, got ${p.cards}`);
  assert(p.links.length === 11 && p.links.every(h => h.startsWith('https://github.com/TunahanBalci/')),
    `expected 11 GitHub links, got ${p.links.length}`);
});

check('projects: every image has width, height and lazy loading', async () => {
  await load();
  const bad = await js(`[...document.querySelectorAll('#work img')]
    .filter(i => !i.getAttribute('width') || !i.getAttribute('height') || i.loading !== 'lazy')
    .map(i => i.getAttribute('src'))`);
  assert(bad.length === 0, `missing size or lazy: ${bad.join(', ')}`);
});

check('projects: driver screenshot is under 100 KB', () => {
  const kb = statSync(join(ROOT, 'assets/projects/driver.jpg')).size / 1024;
  assert(kb < 100, `driver.jpg is ${kb.toFixed(0)} KB`);
});

// ---------- reveal ----------
check('reveal: cards fade in only once they scroll into view', async () => {
  await load();
  const shown = `document.querySelector('#work .card.reveal').classList.contains('is-visible')`;
  assert(!(await js(shown)), 'card was revealed before scrolling');
  await js(`document.querySelector('#work .cards').scrollIntoView({ block: 'center', behavior: 'instant' })`);
  await sleep(200);
  assert(await js(shown), 'card never revealed');
});

check('reveal: content stays visible when JavaScript does not run', async () => {
  await load();
  const opacity = await js(`(() => { const el = document.querySelector('#work .card.reveal');
    el.style.transition = 'none';
    document.documentElement.classList.remove('js');
    return getComputedStyle(el).opacity; })()`);
  assert(opacity === '1', `reveal content has opacity ${opacity} without the js class`);
});
```

- [ ] **Step 2: Run and confirm the new checks fail**

Run: `node tools/check.mjs`
Expected: the three `projects:` checks and two `reveal:` checks FAIL. Earlier checks PASS.

- [ ] **Step 3: Resize the driver screenshot**

```bash
python3 -c "
from PIL import Image
im = Image.open('assets/projects/driver.jpg'); im.thumbnail((960, 960))
im.convert('RGB').save('assets/projects/driver.jpg', quality=78, optimize=True, progressive=True)
print(im.size)"
ls -l assets/projects/driver.jpg
```

Expected: `(960, 640)` and a file under 100 KB. If it is still over, rerun with `quality=70`.

- [ ] **Step 4: Replace the projects markup**

In `index.html`, replace everything from `<!-- Projects Section -->` up to, not including, `<!-- Experience Section -->` with:

```html
    <!-- Projects Section -->
    <section id="work" class="section section--raised">
        <div class="container">
            <header class="section-head reveal">
                <p class="eyebrow">Projects</p>
                <h2>Selected work</h2>
                <p class="section-lead">I like to build my projects with love. Here are some of them:</p>
            </header>

            <div class="features">
                <article class="feature reveal" id="project-sepetix">
                    <div class="feature-media">
                        <img src="./assets/projects/shopping_platform.png" alt="Screenshot of Sepetix" width="1389" height="1242" loading="lazy">
                    </div>
                    <div class="feature-body">
                        <p class="meta"><span class="year">2025</span><span class="pill">Full-Stack &amp; DevOps</span></p>
                        <h3>Sepetix</h3>
                        <p>Online shopping platform like Amazon, uses microservices architecture, built in Express.js. Has a complete DevOps backbone.</p>
                        <ul class="chips" aria-label="Technologies"><li>Express.js</li><li>Microservices</li><li>DevOps</li></ul>
                        <a class="link-arrow" href="https://github.com/TunahanBalci/sepetix" target="_blank" rel="noopener noreferrer">View on GitHub <span aria-hidden="true">→</span></a>
                    </div>
                </article>

                <article class="feature reveal" id="project-travela">
                    <div class="feature-media">
                        <img src="./assets/projects/travela.png" alt="Screenshot of Travela" width="250" height="228" loading="lazy">
                    </div>
                    <div class="feature-body">
                        <p class="meta"><span class="year">2024</span><span class="pill">Full-Stack</span></p>
                        <h3>Travela</h3>
                        <p>The first project that made me feel like a Software Engineer. It's an open source travel planning web application built with ASP.NET</p>
                        <ul class="chips" aria-label="Technologies"><li>ASP.NET</li><li>Web app</li><li>Open source</li></ul>
                        <a class="link-arrow" href="https://github.com/TunahanBalci/Travela" target="_blank" rel="noopener noreferrer">View on GitHub <span aria-hidden="true">→</span></a>
                    </div>
                </article>

                <article class="feature reveal" id="project-fitalyze">
                    <div class="feature-media">
                        <img src="./assets/projects/fitalyze.png" alt="Screenshot of Fitalyze" width="200" height="150" loading="lazy">
                    </div>
                    <div class="feature-body">
                        <p class="meta"><span class="year">2025</span><span class="pill">Full-Stack</span></p>
                        <h3>Fitalyze - AI Diet App</h3>
                        <p>My hackhathon project, an open source AI Powered diet planning web application.</p>
                        <ul class="chips" aria-label="Technologies"><li>AI</li><li>Web app</li><li>Hackathon</li></ul>
                        <a class="link-arrow" href="https://github.com/TunahanBalci/fitalyze" target="_blank" rel="noopener noreferrer">View on GitHub <span aria-hidden="true">→</span></a>
                    </div>
                </article>
            </div>

            <h3 class="subhead reveal">More projects</h3>
            <div class="cards">
                <article class="card reveal">
                    <img src="./assets/projects/forum_website.png" alt="" width="200" height="182" loading="lazy">
                    <div class="card-body">
                        <p class="meta"><span class="year">2025</span><span class="pill">Full-Stack</span></p>
                        <h4><a href="https://github.com/TunahanBalci/forum-website" target="_blank" rel="noopener noreferrer">Forum Website</a></h4>
                        <p>Forum app with admin panel, posting, commenting, replying and PM features. Written in PHP &amp; Bootstrap with Apache Server</p>
                    </div>
                </article>
                <article class="card reveal">
                    <img src="./assets/projects/driver.jpg" alt="" width="960" height="640" loading="lazy">
                    <div class="card-body">
                        <p class="meta"><span class="year">2025</span><span class="pill">System Programming</span></p>
                        <h4><a href="https://github.com/TunahanBalci/casper-g911-linux-driver" target="_blank" rel="noopener noreferrer">Casper G911 Linux Driver</a></h4>
                        <p>Linux WMI driver patch for Casper Excalibur G911 laptops ensuring compatibility with modern kernels (6.18+).</p>
                    </div>
                </article>
                <article class="card reveal">
                    <img src="./assets/projects/peer-to-peer.jpg" alt="" width="1062" height="980" loading="lazy">
                    <div class="card-body">
                        <p class="meta"><span class="year">2025</span><span class="pill">Networks</span></p>
                        <h4><a href="https://github.com/TunahanBalci/p2p-network" target="_blank" rel="noopener noreferrer">P2P Network</a></h4>
                        <p>Serverless P2P chat application prioritizing privacy and security with end-to-end encryption.</p>
                    </div>
                </article>
                <article class="card reveal">
                    <img src="./assets/projects/order_manager.png" alt="" width="1034" height="780" loading="lazy">
                    <div class="card-body">
                        <p class="meta"><span class="year">2025</span><span class="pill">Backend</span></p>
                        <h4><a href="https://github.com/TunahanBalci/order-manager" target="_blank" rel="noopener noreferrer">Order Manager</a></h4>
                        <p>Microservices-based Order Management System built with .NET 8 and RabbitMQ.</p>
                    </div>
                </article>
                <article class="card reveal">
                    <img src="./assets/projects/pdf_merger.png" alt="" width="250" height="292" loading="lazy">
                    <div class="card-body">
                        <p class="meta"><span class="year">2025</span><span class="pill">Full-Stack</span></p>
                        <h4><a href="https://github.com/TunahanBalci/pdf-merger" target="_blank" rel="noopener noreferrer">PDF Merger</a></h4>
                        <p>A fun serverless project of mine which I created to merge multiple lecture notes to a single file in any order I desire.</p>
                    </div>
                </article>
                <article class="card reveal">
                    <img src="./assets/projects/machine_learning.jpg" alt="" width="980" height="980" loading="lazy">
                    <div class="card-body">
                        <p class="meta"><span class="year">2025</span><span class="pill">Machine Learning</span></p>
                        <h4><a href="https://github.com/TunahanBalci/creditworthiness-prediction-pipeline" target="_blank" rel="noopener noreferrer">Creditworthiness Prediction Pipeline</a></h4>
                        <p>A full machine learning pipeline with an API for real-time predictions. Model runs are automated, registered, and logged within MLFlow.</p>
                    </div>
                </article>
                <article class="card reveal">
                    <img src="./assets/projects/machine_learning.jpg" alt="" width="980" height="980" loading="lazy">
                    <div class="card-body">
                        <p class="meta"><span class="year">2025</span><span class="pill">Machine Learning</span></p>
                        <h4><a href="https://github.com/TunahanBalci/customer-segmentation" target="_blank" rel="noopener noreferrer">Customer Segmentation</a></h4>
                        <p>An open source project that categorizes customers based on their data regarding behavior and demographics.</p>
                    </div>
                </article>
                <article class="card reveal">
                    <img src="./assets/projects/machine_learning.jpg" alt="" width="980" height="980" loading="lazy">
                    <div class="card-body">
                        <p class="meta"><span class="year">2025</span><span class="pill">Machine Learning</span></p>
                        <h4><a href="https://github.com/TunahanBalci/spam-mail-classifier" target="_blank" rel="noopener noreferrer">Spam Mail Classifier</a></h4>
                        <p>An open source project that classifies sent mails as spam or not spam based on used words.</p>
                    </div>
                </article>
            </div>
        </div>
    </section>

```

- [ ] **Step 5: Append the Projects and Reveal blocks to `styles.css`**

```css
/* ============ Projects ============ */
.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: var(--fs-small); }

.features { display: grid; gap: clamp(20px, 3vw, 32px); }
.feature {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    align-items: center;
    gap: clamp(24px, 4vw, 56px);
    padding: clamp(16px, 2vw, 24px);
    border: 1px solid var(--line);
    border-radius: calc(var(--radius) + 8px);
    background: var(--surface);
    transition: border-color 0.25s var(--ease);
}
.feature:hover { border-color: rgba(34, 211, 238, 0.45); }
.feature:nth-child(even) .feature-media { order: 2; }
.feature-media { aspect-ratio: 16 / 10; overflow: hidden; border-radius: var(--radius); background: rgba(255, 255, 255, 0.03); }
.feature-media img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.6s var(--ease); }
.feature:hover .feature-media img { transform: scale(1.03); }
.feature-body { display: grid; justify-items: start; gap: 16px; }
.feature-body h3 { font-size: clamp(1.5rem, 1.5vw + 1rem, 2.25rem); }
.feature-body > p:not(.meta) { color: var(--text-muted); }

.subhead { margin: clamp(64px, 8vw, 96px) 0 24px; font-size: var(--fs-h3); }
.cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.card {
    position: relative;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    transition: border-color 0.25s var(--ease), background-color 0.25s var(--ease);
}
.card:hover { border-color: rgba(34, 211, 238, 0.45); background: var(--surface-hover); }
.card img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; }
.card-body { display: grid; gap: 10px; padding: 20px; }
.card h4 { font-size: 1.125rem; font-weight: 700; letter-spacing: -0.01em; }
.card h4 a::after { content: ''; position: absolute; inset: 0; } /* the whole card is the link */
.card h4 a:focus-visible { outline: none; }
.card:has(a:focus-visible) { outline: 2px solid var(--accent); outline-offset: 3px; }
.card-body > p:not(.meta) { color: var(--text-muted); font-size: 0.9375rem; }

@media (max-width: 960px) { .cards { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 767px) {
    .feature { grid-template-columns: 1fr; }
    .feature:nth-child(even) .feature-media { order: 0; }
}
@media (max-width: 560px) { .cards { grid-template-columns: 1fr; } }

/* ============ Reveal ============ */
/* Hidden only when the js class is present, so content never disappears if scripts fail. */
.js .reveal {
    opacity: 0;
    transform: translateY(24px);
    transition: opacity 0.7s var(--ease), transform 0.7s var(--ease);
    transition-delay: calc(var(--i, 0) * 80ms);
}
.js .reveal.is-visible { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
    .js .reveal { opacity: 1; transform: none; }
}
```

- [ ] **Step 6: Add `initReveal` to `script.js`**

Insert above the `// ---------- start ----------` line:

```js
// Elements with .reveal fade up once when they enter the viewport.
// Siblings in the same row stagger through the --i custom property.
function initReveal() {
    const io = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
        }
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(el => {
        const siblings = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
        el.style.setProperty('--i', siblings.indexOf(el) % 3);
        io.observe(el);
    });
}
```

Append to the start block:

```js
initReveal();
```

- [ ] **Step 7: Run and confirm everything passes**

Run: `node tools/check.mjs`
Expected: `27/27 checks passed`.

- [ ] **Step 8: Commit**

```bash
git add index.html styles.css script.js tools/check.mjs assets/projects/driver.jpg
git commit -m "feat: tiered projects section and scroll reveal"
```

---

### Task 6: Experience timeline

**Files:**
- Modify: `index.html` (block from `<!-- Experience Section -->` up to, not including, `<!-- Skills Section -->`)
- Modify: `styles.css` (append Experience block)
- Modify: `tools/check.mjs` (add Experience checks)

**Interfaces:**
- Consumes: `.reveal` and `.is-visible` from Task 5; `.chips`, `.section-head`, `.eyebrow` from Task 1.
- Produces: nothing later tasks depend on.

- [ ] **Step 1: Add the failing checks**

Insert above `// ---------- run ----------`:

```js
// ---------- experience ----------
check('experience: three entries with the same parts and real bullet lists', async () => {
  await load();
  const entries = await js(`[...document.querySelectorAll('#experience .timeline-item')].map(i => ({
    date: !!i.querySelector('.timeline-date'), role: !!i.querySelector('h3'),
    company: !!i.querySelector('.timeline-company'),
    points: i.querySelectorAll('.timeline-points li').length, chips: i.querySelectorAll('.chips li').length }))`);
  assert(entries.length === 3, `expected 3 entries, got ${entries.length}`);
  entries.forEach((e, n) => assert(e.date && e.role && e.company && e.points > 0 && e.chips > 0,
    `entry ${n + 1} is missing a part: ${JSON.stringify(e)}`));
  assert(!(await js(`document.getElementById('experience').innerHTML.includes('•')`)), 'typed bullet characters remain');
});

check('experience: no missing logo and no dead placeholder service', async () => {
  await load();
  assert(!(await js(`document.documentElement.outerHTML.includes('via.placeholder')`)), 'placeholder fallback remains');
  assert(await js(`document.querySelectorAll('#experience img').length`) === 0, 'timeline still has logo images');
});

check('experience: marker turns cyan once its entry is in view', async () => {
  await load({ reducedMotion: true });
  await js(`document.querySelector('#experience .timeline-item').scrollIntoView({ block: 'center' })`);
  await sleep(200);
  const colour = await js(`getComputedStyle(document.querySelector('#experience .timeline-item'), '::before').borderTopColor`);
  assert(colour === 'rgb(34, 211, 238)', `marker colour is ${colour}`);
});
```

- [ ] **Step 2: Run and confirm the new checks fail**

Run: `node tools/check.mjs`
Expected: the three `experience:` checks FAIL. Earlier checks PASS.

- [ ] **Step 3: Replace the experience markup**

In `index.html`, replace everything from `<!-- Experience Section -->` up to, not including, `<!-- Skills Section -->` with:

```html
    <!-- Experience Section -->
    <section id="experience" class="section">
        <div class="container">
            <header class="section-head reveal">
                <p class="eyebrow">Experience</p>
                <h2>Professional Experience</h2>
            </header>

            <ol class="timeline">
                <li class="timeline-item reveal">
                    <p class="timeline-date">Aug 2025 - Aug 2025</p>
                    <h3>Deep Learning Engineer - Intern</h3>
                    <p class="timeline-company">Inovako</p>
                    <ul class="timeline-points">
                        <li>Researched MLOps platforms and integrated AI models into pipelines</li>
                        <li>Performed data annotation tasks using CVAT</li>
                        <li>Trained YOLO deep learning models for various use cases</li>
                        <li>Created algorithms for surface area detection and automated cropping from segmentation areas</li>
                    </ul>
                    <ul class="chips" aria-label="Technologies">
                        <li>YOLO</li><li>MLOps</li><li>Data Annotation</li><li>Python</li><li>OpenCV</li>
                    </ul>
                </li>

                <li class="timeline-item reveal">
                    <p class="timeline-date">Jun 2025 - Aug 2025</p>
                    <h3>Machine Learning &amp; DevOps Engineer - Intern</h3>
                    <p class="timeline-company">TURKSAT</p>
                    <ul class="timeline-points">
                        <li>Participated in DevOps processes for E-Government Portal project</li>
                        <li>Containerized applications with Docker and deployed to Kubernetes</li>
                        <li>Wrote comprehensive Kubernetes deployment configs. Integrated clusters with Helm charts, Prometheus and Grafana</li>
                        <li>Implemented secure storage with HashiCorp Vault and Harbor registry</li>
                        <li>Developed ML pipelines with feature engineering and hyperparameter optimization. Used Random Forest, XGBoost, Logistic Regression with MLFlow integration</li>
                        <li>Created full-stack microservices e-commerce platform on Kubernetes that uses Kafka for async messaging, Loki centralized logging, comprehensive monitoring</li>
                    </ul>
                    <ul class="chips" aria-label="Technologies">
                        <li>Kubernetes</li><li>Docker</li><li>Helm</li><li>Prometheus</li><li>Grafana</li><li>MLFlow</li><li>Kafka</li><li>Machine Learning</li><li>Python</li>
                    </ul>
                </li>

                <li class="timeline-item reveal">
                    <p class="timeline-date">May 2025 - Jun 2025</p>
                    <h3>Software Engineer - Intern</h3>
                    <p class="timeline-company">Edukare Inc.</p>
                    <ul class="timeline-points">
                        <li>Developed a full-stack data entry application from scratch</li>
                        <li>Enabled company IT team and clients to input school/campus data efficiently</li>
                    </ul>
                    <ul class="chips" aria-label="Technologies">
                        <li>.NET Core</li><li>MSSQL Server</li>
                    </ul>
                </li>
            </ol>
        </div>
    </section>

```

- [ ] **Step 4: Append the Experience block to `styles.css`**

```css
/* ============ Experience ============ */
.timeline { position: relative; display: grid; gap: 24px; max-width: 820px; padding-left: 36px; }
.timeline::before { content: ''; position: absolute; left: 7px; top: 8px; bottom: 8px; width: 2px; background: var(--line); }
.timeline-item {
    position: relative;
    display: grid;
    gap: 8px;
    padding: clamp(20px, 3vw, 32px);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
}
.timeline-item::before {
    content: '';
    position: absolute;
    left: -36px;
    top: 34px;
    width: 16px;
    height: 16px;
    border: 2px solid var(--text-muted);
    border-radius: 50%;
    background: var(--bg);
    transition: border-color 0.4s var(--ease), box-shadow 0.4s var(--ease);
}
.timeline-item.is-visible::before { border-color: var(--accent); box-shadow: 0 0 0 4px rgba(34, 211, 238, 0.15); }
.timeline-date { color: var(--gold); font-size: var(--fs-small); font-weight: 600; }
.timeline-item h3 { font-size: var(--fs-h3); }
.timeline-company { font-weight: 600; }
.timeline-points { display: grid; gap: 8px; margin: 8px 0 12px; color: var(--text-muted); }
.timeline-points li { position: relative; padding-left: 18px; }
.timeline-points li::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.7em;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.5;
}
```

- [ ] **Step 5: Run and confirm everything passes**

Run: `node tools/check.mjs`
Expected: `30/30 checks passed`.

- [ ] **Step 6: Commit**

```bash
git add index.html styles.css tools/check.mjs
git commit -m "feat: consistent experience timeline"
```

---

### Task 7: Tech stack marquees

**Files:**
- Modify: `index.html` (block from `<!-- Skills Section -->` up to, not including, `<!-- Contact Section -->`)
- Modify: `styles.css` (append Skills block)
- Modify: `script.js` (add `initMarquees`, call it)
- Modify: `tools/check.mjs` (add Skills checks)

**Interfaces:**
- Consumes: `.reveal` from Task 5; `.section--raised`, `.section-head` from Task 1.
- Produces: `.marquee` with `aria-labelledby`, `.marquee-track`, `.tech`; the `is-animated` and `is-paused` classes on `.marquee`.

- [ ] **Step 1: Add the failing checks**

Insert above `// ---------- run ----------`:

```js
// ---------- skills ----------
check('skills: four labelled strips holding all 54 tools once', async () => {
  await load();
  const s = await js(`({
    strips: document.querySelectorAll('#skills .marquee').length,
    tools: [...document.querySelectorAll('#skills .marquee-track:not([aria-hidden]) .tech')].map(t => t.textContent.trim()),
    labelled: [...document.querySelectorAll('#skills .marquee')].every(m => document.getElementById(m.getAttribute('aria-labelledby') || '-')) })`);
  assert(s.strips === 4, `expected 4 strips, got ${s.strips}`);
  assert(s.tools.length === 54 && new Set(s.tools).size === 54, `expected 54 unique tools, got ${s.tools.length} (${new Set(s.tools).size} unique)`);
  assert(s.labelled, 'a strip is not labelled by a visible heading');
});

check('skills: each strip loops with a hidden duplicate and no gap at 1440px', async () => {
  await load({ width: 1440 });
  const strips = await js(`[...document.querySelectorAll('#skills .marquee')].map(m => {
    const [a, b] = m.querySelectorAll('.marquee-track');
    return { anim: getComputedStyle(a).animationName, hidden: b?.getAttribute('aria-hidden'),
      same: b?.children.length === a.children.length, wide: a.getBoundingClientRect().width >= m.clientWidth }; })`);
  strips.forEach((x, n) => assert(x.anim === 'marquee' && x.hidden === 'true' && x.same && x.wide, `strip ${n + 1}: ${JSON.stringify(x)}`));
});

check('skills: strips stand still and wrap with reduced motion', async () => {
  await load({ reducedMotion: true });
  const strips = await js(`[...document.querySelectorAll('#skills .marquee')].map(m => {
    const t = m.querySelector('.marquee-track');
    return { anim: getComputedStyle(t).animationName,
      clone: getComputedStyle(m.querySelector('.marquee-track[aria-hidden]')).display,
      fits: t.getBoundingClientRect().width <= m.clientWidth + 1 }; })`);
  strips.forEach((x, n) => assert(x.anim === 'none' && x.clone === 'none' && x.fits, `strip ${n + 1}: ${JSON.stringify(x)}`));
});
```

- [ ] **Step 2: Run and confirm the new checks fail**

Run: `node tools/check.mjs`
Expected: the three `skills:` checks FAIL. Earlier checks PASS.

- [ ] **Step 3: Replace the skills markup**

In `index.html`, replace everything from `<!-- Skills Section -->` up to, not including, `<!-- Contact Section -->` with:

```html
    <!-- Skills Section -->
    <section id="skills" class="section section--raised">
        <div class="container">
            <header class="section-head reveal">
                <p class="eyebrow">Skills</p>
                <h2>Tech stack</h2>
                <p class="section-lead">Programming languages I know, tools I'm using and familiar with.</p>
            </header>

            <div class="stack">
                <div class="stack-row reveal">
                    <h3 class="stack-label" id="stack-languages">Languages &amp; frontend</h3>
                    <div class="marquee" aria-labelledby="stack-languages">
                        <ul class="marquee-track">
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg" alt="" width="32" height="32" loading="lazy"><span>Python</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg" alt="" width="32" height="32" loading="lazy"><span>JavaScript</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" alt="" width="32" height="32" loading="lazy"><span>TypeScript</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/csharp/csharp-original.svg" alt="" width="32" height="32" loading="lazy"><span>C#</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg" alt="" width="32" height="32" loading="lazy"><span>Java</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/php/php-original.svg" alt="" width="32" height="32" loading="lazy"><span>PHP</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/dart/dart-original.svg" alt="" width="32" height="32" loading="lazy"><span>Dart</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" alt="" width="32" height="32" loading="lazy"><span>React</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/html5/html5-original.svg" alt="" width="32" height="32" loading="lazy"><span>HTML &amp; CSS</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tailwindcss/tailwindcss-original.svg" alt="" width="32" height="32" loading="lazy"><span>Tailwind CSS</span></li>
                        </ul>
                    </div>
                </div>

                <div class="stack-row reveal">
                    <h3 class="stack-label" id="stack-backend">Backend &amp; databases</h3>
                    <div class="marquee" data-direction="right" aria-labelledby="stack-backend">
                        <ul class="marquee-track">
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/nodejs/nodejs-original.svg" alt="" width="32" height="32" loading="lazy"><span>Node.js</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/express/express-original.svg" alt="" width="32" height="32" loading="lazy"><span>Express.js</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/dotnetcore/dotnetcore-original.svg" alt="" width="32" height="32" loading="lazy"><span>.NET Core</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/spring/spring-original.svg" alt="" width="32" height="32" loading="lazy"><span>Spring Boot</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/flask/flask-original.svg" alt="" width="32" height="32" loading="lazy"><span>Flask</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/fastapi/fastapi-original.svg" alt="" width="32" height="32" loading="lazy"><span>FastAPI</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/selenium/selenium-original.svg" alt="" width="32" height="32" loading="lazy"><span>Selenium</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/apachekafka/apachekafka-original.svg" alt="" width="32" height="32" loading="lazy"><span>Kafka</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rabbitmq/rabbitmq-original.svg" alt="" width="32" height="32" loading="lazy"><span>RabbitMQ</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/jest/jest-plain.svg" alt="" width="32" height="32" loading="lazy"><span>Jest</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/junit/junit-original.svg" alt="" width="32" height="32" loading="lazy"><span>Junit</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg" alt="" width="32" height="32" loading="lazy"><span>PostgreSQL</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/mongodb/mongodb-original.svg" alt="" width="32" height="32" loading="lazy"><span>MongoDB</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/microsoftsqlserver/microsoftsqlserver-plain.svg" alt="" width="32" height="32" loading="lazy"><span>MSSQL</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/firebase/firebase-plain.svg" alt="" width="32" height="32" loading="lazy"><span>Firebase</span></li>
                        </ul>
                    </div>
                </div>

                <div class="stack-row reveal">
                    <h3 class="stack-label" id="stack-ml">Machine learning &amp; AI</h3>
                    <div class="marquee" aria-labelledby="stack-ml">
                        <ul class="marquee-track">
                            <li class="tech"><img src="./assets/logos/yolo.svg" alt="" width="32" height="32" loading="lazy"><span>YOLO</span></li>
                            <li class="tech"><img src="./assets/logos/cvat.svg" alt="" width="32" height="32" loading="lazy"><span>CVAT</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/tensorflow/tensorflow-original.svg" alt="" width="32" height="32" loading="lazy"><span>TensorFlow</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/pytorch/pytorch-original.svg" alt="" width="32" height="32" loading="lazy"><span>PyTorch</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/opencv/opencv-original.svg" alt="" width="32" height="32" loading="lazy"><span>OpenCV</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/pandas/pandas-original.svg" alt="" width="32" height="32" loading="lazy"><span>Pandas</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/scikitlearn/scikitlearn-original.svg" alt="" width="32" height="32" loading="lazy"><span>Scikit-learn</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/numpy/numpy-original.svg" alt="" width="32" height="32" loading="lazy"><span>NumPy</span></li>
                            <li class="tech"><img src="./assets/logos/seaborn.svg" alt="" width="32" height="32" loading="lazy"><span>Seaborn</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/keras/keras-original.svg" alt="" width="32" height="32" loading="lazy"><span>Keras</span></li>
                            <li class="tech"><img src="./assets/logos/clearml.svg" alt="" width="32" height="32" loading="lazy"><span>ClearML</span></li>
                            <li class="tech"><img src="./assets/logos/mlflow.svg" alt="" width="32" height="32" loading="lazy"><span>MLFlow</span></li>
                        </ul>
                    </div>
                </div>

                <div class="stack-row reveal">
                    <h3 class="stack-label" id="stack-devops">DevOps, cloud &amp; mobile</h3>
                    <div class="marquee" data-direction="right" aria-labelledby="stack-devops">
                        <ul class="marquee-track">
                            <li class="tech"><img src="./assets/logos/google_cloud.svg" alt="" width="32" height="32" loading="lazy"><span>Google Cloud</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/docker/docker-original.svg" alt="" width="32" height="32" loading="lazy"><span>Docker</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/kubernetes/kubernetes-plain.svg" alt="" width="32" height="32" loading="lazy"><span>Kubernetes</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/git/git-original.svg" alt="" width="32" height="32" loading="lazy"><span>Git</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/helm/helm-original.svg" alt="" width="32" height="32" loading="lazy"><span>Helm</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/harbor/harbor-original.svg" alt="" width="32" height="32" loading="lazy"><span>Harbor</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rancher/rancher-original.svg" alt="" width="32" height="32" loading="lazy"><span>Rancher</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/prometheus/prometheus-original.svg" alt="" width="32" height="32" loading="lazy"><span>Prometheus</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/grafana/grafana-original.svg" alt="" width="32" height="32" loading="lazy"><span>Grafana</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vault/vault-original.svg" alt="" width="32" height="32" loading="lazy"><span>Vault</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/k3s/k3s-original.svg" alt="" width="32" height="32" loading="lazy"><span>K3S</span></li>
                            <li class="tech"><img src="./assets/logos/rke.svg" alt="" width="32" height="32" loading="lazy"><span>RKE2</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/jenkins/jenkins-original.svg" alt="" width="32" height="32" loading="lazy"><span>Jenkins</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/githubactions/githubactions-original.svg" alt="" width="32" height="32" loading="lazy"><span>Github Actions</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/flutter/flutter-original.svg" alt="" width="32" height="32" loading="lazy"><span>Flutter</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/android/android-original.svg" alt="" width="32" height="32" loading="lazy"><span>Android</span></li>
                            <li class="tech"><img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/apple/apple-original.svg" alt="" width="32" height="32" loading="lazy"><span>iOS</span></li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    </section>

```

- [ ] **Step 4: Append the Skills block to `styles.css`**

```css
/* ============ Skills ============ */
.stack { display: grid; gap: 28px; }
.stack-label {
    margin-bottom: 12px;
    color: var(--text-muted);
    font-size: var(--fs-small);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}
.marquee {
    display: flex;
    overflow: hidden;
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
    mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
}
/* Two identical tracks side by side, each sliding its own width, so the loop has no seam. */
.marquee-track { display: flex; flex-shrink: 0; gap: 12px; padding-right: 12px; }
.marquee.is-animated .marquee-track { animation: marquee var(--duration, 40s) linear infinite; }
.marquee[data-direction="right"] .marquee-track { animation-direction: reverse; }
.marquee:hover .marquee-track, .marquee.is-paused .marquee-track { animation-play-state: paused; }
@keyframes marquee { to { transform: translateX(-100%); } }

.tech {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px 8px 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    background: var(--surface);
    font-size: 0.9375rem;
    font-weight: 500;
    white-space: nowrap;
}
/* A light circle keeps dark logos (Express, Flask, Apple, Vault) visible. */
.tech img { width: 32px; height: 32px; padding: 5px; border-radius: 50%; background: var(--text); object-fit: contain; }

@media (prefers-reduced-motion: reduce) {
    .marquee { -webkit-mask-image: none; mask-image: none; }
    .marquee-track { flex-shrink: 1; flex-wrap: wrap; padding-right: 0; }
    .marquee-track[aria-hidden] { display: none; }
}
```

- [ ] **Step 5: Add `initMarquees` to `script.js`**

Insert above the `// ---------- start ----------` line:

```js
// Each strip's track is cloned once so the CSS loop has no seam.
// Duration scales with item count so every strip moves at the same speed.
// Mouse hover pauses through CSS; a tap toggles pause on touch screens.
function initMarquees() {
    document.querySelectorAll('.marquee').forEach(marquee => {
        const track = marquee.querySelector('.marquee-track');
        const clone = track.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        marquee.append(clone);
        marquee.style.setProperty('--duration', `${track.children.length * 3.5}s`);
        marquee.classList.add('is-animated');
        marquee.addEventListener('pointerdown', e => {
            if (e.pointerType !== 'mouse') marquee.classList.toggle('is-paused');
        });
    });
}
```

Append to the start block:

```js
initMarquees();
```

- [ ] **Step 6: Run and confirm everything passes**

Run: `node tools/check.mjs`
Expected: `33/33 checks passed`. If the 1440px gap check fails for one strip, that strip is shorter than 1120px. Raise `.tech` padding to `8px 20px 8px 8px` and rerun rather than adding a third track.

- [ ] **Step 7: Commit**

```bash
git add index.html styles.css script.js tools/check.mjs
git commit -m "feat: tech stack as four seamless marquee strips"
```

---

### Task 8: Contact and footer

**Files:**
- Modify: `index.html` (block from `<!-- Contact Section -->` up to, not including, `    </main>`; and block from `<!-- Footer -->` up to, not including, `<script src="script.js"></script>`)
- Modify: `styles.css` (append Contact and Footer blocks)
- Modify: `script.js` (add `initYear`, call it)
- Modify: `tools/check.mjs` (add Contact and Footer checks)

**Interfaces:**
- Consumes: `.reveal` from Task 5; `.btn`, `.btn-ghost`, `.eyebrow`, `.brand` from Tasks 1 and 3.
- Produces: `#year`.

- [ ] **Step 1: Add the failing checks**

Insert above `// ---------- run ----------`:

```js
// ---------- contact and footer ----------
check('contact: email, LinkedIn and GitHub, and the email fits a 320px phone', async () => {
  await load({ width: 320, height: 640 });
  const c = await js(`({ hrefs: [...document.querySelectorAll('#contact a')].map(a => a.href),
    right: document.querySelector('.contact-email')?.getBoundingClientRect().right })`);
  assert(c.hrefs.includes('mailto:dev.tunahanbalci@gmail.com'), 'email link missing');
  assert(c.hrefs.some(h => h.includes('linkedin.com/in/tunahan-balci')), 'LinkedIn link missing');
  assert(c.hrefs.includes('https://github.com/TunahanBalci'), 'GitHub link missing');
  assert(c.right !== undefined && c.right <= 320, `email runs off screen to ${c.right}px`);
});

check('footer: only live links, the real email and the current year', async () => {
  await load();
  const hrefs = await js(`[...document.querySelectorAll('footer a')].map(a => a.getAttribute('href'))`);
  assert(!hrefs.includes('#education') && !hrefs.includes('#services'), 'dead section links remain');
  assert(hrefs.includes('mailto:dev.tunahanbalci@gmail.com'), 'real email missing');
  assert(!(await js(`document.documentElement.outerHTML.includes('hello@example.com')`)), 'placeholder email remains');
  assert(await js(`document.getElementById('year')?.textContent`) === String(new Date().getFullYear()), 'year is not current');
});
```

- [ ] **Step 2: Run and confirm the new checks fail**

Run: `node tools/check.mjs`
Expected: both new checks FAIL (`.contact-email` and `#year` do not exist; footer has `#education`). Earlier checks PASS.

- [ ] **Step 3: Replace the contact markup**

In `index.html`, replace everything from `<!-- Contact Section -->` up to, not including, the line `    </main>` with:

```html
    <!-- Contact Section -->
    <section id="contact" class="section">
        <div class="container contact-inner reveal">
            <p class="eyebrow">Contact</p>
            <h2 class="contact-title">Let's build something</h2>
            <!-- owner: edit this sentence to say what you're open to -->
            <p class="contact-lead">I'm open to software engineering roles and interesting projects. The fastest way to reach me is email.</p>
            <a class="contact-email" href="mailto:dev.tunahanbalci@gmail.com">dev.tunahanbalci@gmail.com</a>
            <div class="contact-actions">
                <a class="btn btn-ghost" href="https://www.linkedin.com/in/tunahan-balci-584320318/" target="_blank" rel="noopener noreferrer">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
                    LinkedIn
                </a>
                <a class="btn btn-ghost" href="https://github.com/TunahanBalci" target="_blank" rel="noopener noreferrer">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                    GitHub
                </a>
            </div>
        </div>
    </section>
```

- [ ] **Step 4: Replace the footer markup**

In `index.html`, replace everything from `<!-- Footer -->` up to, not including, `<script src="script.js"></script>` with:

```html
    <!-- Footer -->
    <footer class="site-footer">
        <div class="container footer-inner">
            <a class="brand" href="#home">Tunahan BALCI</a>
            <ul class="footer-links">
                <li><a href="#work">Projects</a></li>
                <li><a href="#experience">Experience</a></li>
                <li><a href="#contact">Contact</a></li>
            </ul>
            <a class="footer-email" href="mailto:dev.tunahanbalci@gmail.com">dev.tunahanbalci@gmail.com</a>
            <p>© <span id="year">2026</span> Tunahan Balcı</p>
        </div>
    </footer>

```

- [ ] **Step 5: Append the Contact and Footer blocks to `styles.css`**

```css
/* ============ Contact ============ */
.contact-inner { display: grid; justify-items: center; max-width: 720px; text-align: center; }
.contact-title { font-size: clamp(2.5rem, 5vw + 1rem, 4.5rem); letter-spacing: -0.03em; }
.contact-lead { max-width: 48ch; margin-top: 20px; color: var(--text-muted); font-size: var(--fs-lead); }
.contact-email {
    max-width: 100%;
    margin-top: 36px;
    overflow-wrap: anywhere;
    color: var(--accent);
    font-size: clamp(1.25rem, 2.5vw + 0.75rem, 2rem);
    font-weight: 700;
    background: linear-gradient(currentColor, currentColor) 0 100% / 0 2px no-repeat;
    transition: background-size 0.3s var(--ease);
}
.contact-email:hover { background-size: 100% 2px; }
.contact-actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 32px; }
.btn svg { width: 18px; height: 18px; }

/* ============ Footer ============ */
.site-footer {
    position: relative;
    z-index: 1;
    padding-block: 32px;
    border-top: 1px solid var(--line);
    background: var(--bg-footer);
    color: var(--text-muted);
    font-size: var(--fs-small);
}
.footer-inner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px 32px; }
.footer-links { display: flex; gap: 24px; }
.footer-links a:hover, .footer-email:hover { color: var(--text); }
```

- [ ] **Step 6: Add `initYear` to `script.js`**

Insert above the `// ---------- start ----------` line:

```js
function initYear() {
    document.getElementById('year').textContent = new Date().getFullYear();
}
```

Append to the start block:

```js
initYear();
```

- [ ] **Step 7: Run and confirm everything passes**

Run: `node tools/check.mjs`
Expected: `35/35 checks passed`.

- [ ] **Step 8: Commit**

```bash
git add index.html styles.css script.js tools/check.mjs
git commit -m "feat: closing contact statement and single-row footer"
```

---

### Task 9: Whole-page checks and final review

**Files:**
- Modify: `tools/check.mjs` (add whole-page checks)
- Modify: whichever section file a failing check points at

**Interfaces:**
- Consumes: everything above.
- Produces: the finished branch.

- [ ] **Step 1: Add the whole-page checks**

Insert above `// ---------- run ----------`:

```js
// ---------- whole page ----------
for (const width of [320, 375, 768, 1280]) {
  check(`page: no sideways scroll at ${width}px`, async () => {
    await load({ width, height: 800 });
    const [scroll, client] = await js(`[document.documentElement.scrollWidth, document.documentElement.clientWidth]`);
    assert(scroll <= client, `page is ${scroll}px wide in a ${client}px viewport`);
  });
}

check('page: every in-page link has a target', async () => {
  await load();
  const missing = await js(`[...document.querySelectorAll('a[href^="#"]')].map(a => a.getAttribute('href'))
    .filter(h => !document.getElementById(h.slice(1)))`);
  assert(missing.length === 0, `links without targets: ${missing.join(', ')}`);
});

check('page: scrolling top to bottom reveals everything, loads every local image, throws nothing', async () => {
  await load();
  await js(`(async () => { for (let y = 0; y <= document.documentElement.scrollHeight; y += innerHeight / 2) {
    scrollTo({ top: y, behavior: 'instant' }); await new Promise(r => setTimeout(r, 80)); } })()`);
  await sleep(400);
  const hidden = await js(`[...document.querySelectorAll('.reveal:not(.is-visible)')].map(e => e.id || e.className)`);
  assert(hidden.length === 0, `never revealed: ${hidden.join(', ')}`);
  const broken = await brokenImages();
  assert(broken.length === 0, `broken local images: ${broken.join(', ')}`);
  assert(pageErrors().length === 0, `script errors: ${pageErrors().join(' | ')}`);
});

check('page: layout shift stays under 0.1', async () => {
  await load();
  const cls = await js(`new Promise(r => { let s = 0;
    new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) s += e.value; }))
      .observe({ type: 'layout-shift', buffered: true });
    setTimeout(() => r(s), 800); })`);
  assert(cls < 0.1, `cumulative layout shift is ${cls.toFixed(3)}`);
});

check('page: reduced motion stops every continuous animation', async () => {
  await load({ reducedMotion: true });
  await sleep(1500);
  const moving = await js(`[...document.querySelectorAll('*')].filter(el =>
    getComputedStyle(el).animationName !== 'none' || getComputedStyle(el, '::before').animationName !== 'none')
    .map(el => el.className || el.tagName)`);
  assert(moving.length === 0, `still animating: ${moving.slice(0, 5).join(', ')}`);
  assert(!(await js(`document.getElementById('meteor').classList.contains('is-flying')`)), 'meteor flew');
});
```

- [ ] **Step 2: Run the full suite**

Run: `node tools/check.mjs`
Expected: `43/43 checks passed`. These checks guard the combined page, so they should pass on arrival. If one fails, the message names the element. Fix it in the section block that owns it, rerun, and do not loosen the check.

- [ ] **Step 3: Check every GitHub link resolves**

```bash
grep -o 'https://github.com/TunahanBalci[^"]*' index.html | sort -u | while read u; do
  printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' -L "$u")" "$u"; done
```

Expected: every line starts with `200`. Report any other code to the owner. Do not change the URL yourself.

- [ ] **Step 4: Visual walk-through in a real browser**

Open `index.html` in Chrome. In DevTools device toolbar, walk the page top to bottom at 375, 768 and 1280 wide and confirm:

1. Only cyan and gold stand out. No pink, purple, green or orange anywhere.
2. The hero proof strip sits at the bottom of the first screen, with the scroll cue below it.
3. Featured cards alternate image side on desktop and stack on phone.
4. Every tech logo is visible on its light circle, including Express, Flask, Apple and Vault.
5. The mobile menu slides in, the cross closes it, and the page behind does not scroll.
6. With DevTools Rendering set to "prefers-reduced-motion: reduce", nothing moves.

Then run Lighthouse from DevTools on the desktop and mobile presets. Expected: no failed requests, no contrast errors, no missing labels.

- [ ] **Step 5: Commit**

```bash
git add tools/check.mjs
git commit -m "test: whole-page checks for overflow, links, reveal, layout shift and reduced motion"
```
