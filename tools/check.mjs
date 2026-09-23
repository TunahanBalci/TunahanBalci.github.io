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
  // DOMContentLoaded, not window 'load': the legacy markup has an onerror fallback to a
  // now-dead placeholder image host that Chrome's network stack retries for a very long
  // time, so 'load' can hang indefinitely. script.js already runs its init on
  // DOMContentLoaded (window 'load' is only a redundant "double ensure" there), and Chrome
  // blocks script execution on pending head stylesheets, so by DOMContentLoaded the page's
  // own CSS and scripts have already run.
  const loaded = new Promise(done => waiters.push({ method: 'Page.domContentEventFired', done }));
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
