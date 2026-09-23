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

// ---------- start ----------
initSky();
initMeteor();
initNav();
