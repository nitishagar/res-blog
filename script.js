// Mobile Navigation Toggle
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');
const navLinks = document.querySelectorAll('.nav-link');

hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});

navLinks.forEach(link => {
    link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Smooth Scrolling (respect reduced motion)
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const navHeight = document.querySelector('.navbar').offsetHeight;
            const targetPosition = target.offsetTop - navHeight;
            window.scrollTo({
                top: targetPosition,
                behavior: prefersReducedMotion ? 'auto' : 'smooth'
            });
        }
    });
});

// Active Navigation Link
window.addEventListener('scroll', () => {
    let current = '';
    const sections = document.querySelectorAll('section');
    const navHeight = document.querySelector('.navbar').offsetHeight;

    sections.forEach(section => {
        const sectionTop = section.offsetTop - navHeight - 50;
        const sectionBottom = sectionTop + section.offsetHeight;
        if (scrollY >= sectionTop && scrollY <= sectionBottom) {
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

// Typewriter effect
const typewriterEl = document.getElementById('typewriter');
const phrases = [
    'Engineering leader, GoDaddy Commerce',
    'I write about agent reliability',
    'Evals before prompts. Queues before agents.',
    'Org builder: 25 to 120+ engineers'
];
let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;

function typeWrite() {
    if (!typewriterEl) return;
    if (prefersReducedMotion) {
        typewriterEl.textContent = phrases[0];
        return;
    }
    const current = phrases[phraseIndex];
    typewriterEl.textContent = isDeleting
        ? current.slice(0, charIndex - 1)
        : current.slice(0, charIndex + 1);
    isDeleting ? charIndex-- : charIndex++;

    let speed = isDeleting ? 35 : 60;
    if (!isDeleting && charIndex === current.length) {
        speed = 2400;
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        speed = 400;
    }
    setTimeout(typeWrite, speed);
}
typeWrite();

// Scroll reveal (skipped entirely under reduced motion via CSS)
if (!prefersReducedMotion) {
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
} else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('revealed'));
}

// Animated counters
const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && !entry.target.dataset.counted) {
            entry.target.dataset.counted = 'true';
            const target = parseInt(entry.target.dataset.target);
            if (prefersReducedMotion) {
                entry.target.textContent = target;
                return;
            }
            const steps = 45;
            const duration = 1400;
            let step = 0;
            const timer = setInterval(() => {
                step++;
                const progress = step / steps;
                const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
                entry.target.textContent = Math.min(Math.round(eased * target), target);
                if (step >= steps) clearInterval(timer);
            }, duration / steps);
        }
    });
}, { threshold: 0.5 });

document.querySelectorAll('.stat-number').forEach(el => counterObserver.observe(el));
