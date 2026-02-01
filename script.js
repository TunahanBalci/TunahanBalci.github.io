// Mobile Menu Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

if (hamburger) {
    hamburger.addEventListener('click', () => {
        navMenu.classList.toggle('active');
        hamburger.classList.toggle('active');
    });
}

// Close mobile menu when clicking on a link
document.querySelectorAll('.nav-menu a').forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
        if (hamburger) hamburger.classList.remove('active');
    });
});

// Smooth Scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Active Navigation State
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-menu a');

window.addEventListener('scroll', () => {
    let current = '';
    
    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.clientHeight;
        if (pageYOffset >= (sectionTop - 300)) {
            current = section.getAttribute('id');
        }
    });
    
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href').slice(1) === current) {
            link.classList.add('active');
        }
    });
});

// Space Background Logic
function initSpaceBackground() {
    const container = document.getElementById('sky-elements');
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Distribution density: ~1 element per 10000px^2
    const area = width * height;
    const count = Math.floor(area / 15000);
    
    // Weights
    const weights = [
        { type: 'star_1.svg', weight: 25, size: [10, 20] },
        { type: 'star_2.svg', weight: 10, size: [8, 15] },
        { type: 'galaxy.svg', weight: 5, size: [30, 60] }
    ];
    
    // Prepare weighted pool
    const pool = [];
    weights.forEach(item => {
        for (let i = 0; i < item.weight; i++) {
            pool.push(item);
        }
    });
    
    // Clear existing
    container.innerHTML = '';
    
    for (let i = 0; i < count; i++) {
        const item = pool[Math.floor(Math.random() * pool.length)];
        const el = document.createElement('img');
        
        el.src = `./assets/bg_elements/${item.type}`;
        el.className = 'space-element';
        
        // Random position
        const left = Math.random() * 100;
        const top = Math.random() * 100;
        
        el.style.left = `${left}%`;
        el.style.top = `${top}%`;
        
        // Random size
        const size = Math.random() * (item.size[1] - item.size[0]) + item.size[0];
        el.style.width = `${size}px`;
        
        // Specific styles per type
        if (item.type === 'meteor.svg') {
            el.style.opacity = 0;
            el.style.animation = `meteorShoot 2s linear infinite`;
            el.style.animationDelay = `${Math.random() * 20}s`; // Random delay up to 20s
        } else {
            // Twinkle animation for stars
             if (item.type.includes('star')) {
                el.style.animation = `twinkle ${2 + Math.random() * 3}s ease-in-out infinite`;
                el.style.animationDelay = `${Math.random() * 5}s`;
             }
             // Rotation for galaxies
             if (item.type.includes('galaxy')) {
                 el.style.transform = `rotate(${Math.random() * 360}deg)`;
                 el.style.opacity = 0.5 + Math.random() * 0.3;
             }
        }
        
        container.appendChild(el);
    }
}

// Init on load with fallback
function runInit() {
    if (!document.getElementById('sky-elements').hasChildNodes()) {
        initSpaceBackground();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInit);
} else {
    runInit();
}
window.addEventListener('load', runInit); // Double ensure

// Re-init on resize (debounced)
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(initSpaceBackground, 500);
});

// Scroll Meteor Logic
function initScrollMeteor() {
    const meteor = document.getElementById('scroll-meteor');
    const workSection = document.getElementById('work');
    const experienceSection = document.getElementById('experience');

    if (!meteor || !workSection || !experienceSection) return;

    let currentProgress = 0;
    let targetProgress = 0;
    let isRequestingInternal = false;

    function updateScrollTarget() {
        const scrollY = window.pageYOffset;
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth; 
        
        const startScroll = workSection.offsetTop - windowHeight;

        const endScroll = experienceSection.offsetTop + experienceSection.offsetHeight; 
        
        const scrollRange = endScroll - startScroll;
        
        // Calculate raw progress target (0 to 1)
        let rawProgress = (scrollY - startScroll) / scrollRange;
        
        // Update target
        targetProgress = rawProgress;
    }

    function render() {
        // Lerp factor: 0.05 - 0.1 for smooth
        const lerpFactor = 0.08; 
        
        // Interpolate
        currentProgress += (targetProgress - currentProgress) * lerpFactor;
        
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        if (currentProgress > -0.2 && currentProgress < 1.2) {
            meteor.style.opacity = 1;

            // X Position: Traverse screen
            const startX = -300;
            const endX = windowWidth + 300;
            const currentX = startX + (currentProgress * (endX - startX));

            // Scale: Grow
            const scale = 1 + (currentProgress * 3);

            // Y Position
            const startY = -windowHeight * 0.2;
            const endY = windowHeight * 0.5;
            const currentY = startY + (currentProgress * (endY - startY));

            meteor.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) rotate(270deg) scale(${scale})`;
        } else {
            meteor.style.opacity = 0;
        }

        requestAnimationFrame(render);
    }

    window.addEventListener('scroll', updateScrollTarget, { passive: true });
    window.addEventListener('resize', updateScrollTarget);
    
    // Kickoff
    updateScrollTarget();
    currentProgress = targetProgress; // Start at correct place immediately to prevent jump
    render();
}

// Hide Sky Elements in Footer
function initFooterObserver() {
    const footer = document.querySelector('footer');
    const skyElements = document.getElementById('sky-elements');
    
    if (!footer || !skyElements) return;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Footer is visible, hide sky
                skyElements.style.opacity = '0';
            } else {
                // Footer is not visible, show sky
                skyElements.style.opacity = '1';
            }
        });
    }, {
        threshold: 0.1
    });
    
    observer.observe(footer);
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initScrollMeteor();
        initFooterObserver();
    });
} else {
    initScrollMeteor();
    initFooterObserver();
}
