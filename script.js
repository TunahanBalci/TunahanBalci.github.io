// Portfolio behaviour. One init function per feature, called from the start block at the bottom.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const $ = s => document.querySelector(s);

// Content and UI strings live in data.json. Localized values are either a plain string
// (same in every language) or { "en": ..., "tr": ... }.
let data;
let lang = 'en';
const L = v => (v && typeof v === 'object' && !Array.isArray(v) ? v[lang] ?? v.en : v);
const T = (key, vars = {}) => (data?.ui[lang][key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k]);
const esc = s => String(s).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

// A saved choice wins. Otherwise Turkey, which has a single time zone, gets Turkish:
// the zone stands in for the visitor's country without a geo-IP service.
function detectLang() {
    let saved = null;
    try { saved = localStorage.getItem('lang'); } catch {}
    if (saved === 'en' || saved === 'tr') return saved;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone === 'Europe/Istanbul' || zone === 'Asia/Istanbul' ? 'tr' : 'en';
}

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
        toggle.setAttribute('aria-label', T(open ? 'menuClose' : 'menuOpen'));
        document.querySelector('main').inert = open;
        document.querySelector('.site-footer').inert = open;
    };
    toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
    links.forEach(a => a.addEventListener('click', () => setMenu(false)));
    addEventListener('keydown', e => {
        if (e.key !== 'Escape' || toggle.getAttribute('aria-expanded') !== 'true') return;
        setMenu(false);
        toggle.focus();
    });
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

// Elements with .reveal fade up once when they enter the viewport.
// Siblings in the same row stagger through the --i custom property.
// Called again after every render, so it only picks up elements not yet shown.
const revealer = new IntersectionObserver(entries => {
    for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        revealer.unobserve(entry.target);
    }
}, { rootMargin: '0px 0px -8% 0px' });
function initReveal() {
    document.querySelectorAll('.reveal:not(.is-visible)').forEach(el => {
        const siblings = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
        el.style.setProperty('--i', siblings.indexOf(el) % 3);
        revealer.observe(el);
    });
}

// Each strip's track is cloned once so the CSS loop has no seam.
// Duration scales with item count so every strip moves at the same speed.
// Mouse hover pauses through CSS; a tap toggles pause on touch screens.
function initMarquees() {
    document.querySelectorAll('.marquee:not(.is-animated)').forEach(marquee => {
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

// ---------- content ----------
const ext = 'target="_blank" rel="noopener noreferrer"';
const img = (i, alt, lazy = true) =>
    `<img src="${esc(i.src)}" alt="${esc(alt)}" width="${i.width}" height="${i.height}"${lazy ? ' loading="lazy"' : ''}>`;
const meta = p => `<p class="meta"><span class="year">${p.year}</span><span class="pill">${esc(L(p.category))}</span></p>`;
const chips = tags => `<ul class="chips" aria-label="${esc(T('technologies'))}">${tags.map(t => `<li>${esc(L(t))}</li>`).join('')}</ul>`;
const icon = src => (src.startsWith('devicon:')
    ? `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/${src.slice(8)}.svg` : src);

function render() {
    const root = document.documentElement;
    const other = lang === 'tr' ? 'en' : 'tr';
    const toggle = $('#lang-toggle');
    root.lang = lang;
    document.title = T('title');
    document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = T(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-label]').forEach(el => el.setAttribute('aria-label', T(el.dataset.i18nLabel)));
    $('.nav-toggle').setAttribute('aria-label', T(root.classList.contains('menu-open') ? 'menuClose' : 'menuOpen'));
    toggle.hidden = false;
    toggle.lang = other;
    toggle.textContent = other.toUpperCase();
    toggle.setAttribute('aria-label', T('switchLang'));

    const { email } = data.contact;
    document.querySelectorAll('[data-email]').forEach(a => { a.href = `mailto:${email}`; a.textContent = email; });
    document.querySelectorAll('[data-link]').forEach(a => { a.href = data.contact[a.dataset.link]; });

    const featured = data.projects.filter(p => p.featured);
    const name = p => L(p.shortTitle ?? p.title);
    $('#proof').innerHTML = featured.map(p => `<li><a class="proof-tile" href="#project-${esc(p.id)}">
        ${img(p.image, '', false)}
        <span class="proof-text"><strong>${esc(name(p))}</strong><span>${esc(L(p.tagline))}</span></span>
        <span class="proof-arrow" aria-hidden="true">→</span></a></li>`).join('');

    $('#features').innerHTML = featured.map(p => `<article class="feature reveal" id="project-${esc(p.id)}">
        <div class="feature-media">${img(p.image, T('work.screenshot', { name: name(p) }))}</div>
        <div class="feature-body">
            ${meta(p)}
            <h3>${esc(L(p.title))}</h3>
            <p>${esc(L(p.description))}</p>
            ${chips(p.tags)}
            <a class="link-arrow" href="${esc(p.url)}" ${ext} aria-label="${esc(T('work.githubLabel', { name: name(p) }))}">${esc(T('work.github'))} <span aria-hidden="true">→</span></a>
        </div></article>`).join('');

    $('#cards').innerHTML = data.projects.filter(p => !p.featured).map(p => `<article class="card reveal">
        ${img(p.image, '')}
        <div class="card-body">
            ${meta(p)}
            <h4><a href="${esc(p.url)}" ${ext}>${esc(L(p.title))}</a></h4>
            <p>${esc(L(p.description))}</p>
        </div></article>`).join('');

    // "2025-08" parses as UTC midnight, so format in UTC too or the month can slip back.
    const month = new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric', timeZone: 'UTC' });
    const date = ym => month.format(new Date(ym));
    $('#timeline').innerHTML = data.experience.map(e => `<li class="timeline-item reveal">
        <p class="timeline-date">${esc(date(e.start))} - ${esc(date(e.end))}</p>
        <h3>${esc(L(e.role))}</h3>
        <p class="timeline-company">${esc(L(e.company))}</p>
        <ul class="timeline-points">${L(e.points).map(pt => `<li>${esc(pt)}</li>`).join('')}</ul>
        ${chips(e.tags)}</li>`).join('');

    // Strips alternate direction, starting leftward.
    $('#stack').innerHTML = data.skills.map((row, i) => `<div class="stack-row reveal">
        <h3 class="stack-label" id="stack-${i}">${esc(L(row.label))}</h3>
        <div class="marquee" role="group" tabindex="0"${i % 2 ? ' data-direction="right"' : ''} aria-labelledby="stack-${i}">
            <ul class="marquee-track">${row.tools.map(t => `<li class="tech"><img src="${esc(icon(t.icon))}" alt="" width="32" height="32" loading="lazy"><span>${esc(t.name)}</span></li>`).join('')}</ul>
        </div></div>`).join('');

    initMarquees();
    initReveal();
}

function initLangToggle() {
    $('#lang-toggle').addEventListener('click', () => {
        lang = lang === 'tr' ? 'en' : 'tr';
        try { localStorage.setItem('lang', lang); } catch {}
        render();
    });
}

function initYear() {
    document.getElementById('year').textContent = new Date().getFullYear();
}

// ---------- start ----------
setTimeout(() => document.documentElement.classList.add('is-ready'));
initSky();
initMeteor();
initNav();
initYear();
// The page stays hidden (html:not(.is-loaded) in CSS) until content is in, so there is no
// flash of the wrong language and nothing shifts. On failure the static English shell shows.
fetch('data.json')
    .then(r => r.json())
    .then(json => {
        data = json;
        lang = detectLang();
        render();
        initLangToggle();
        // Deep links point at content that did not exist when the browser tried to scroll.
        if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' });
    })
    .catch(err => {
        console.error('Could not load data.json', err);
        initReveal();
    })
    .finally(() => document.documentElement.classList.add('is-loaded'));
