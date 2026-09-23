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
