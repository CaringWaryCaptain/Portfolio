(function () {
    'use strict';

    /* ─── DOM refs ─── */
    const html    = document.documentElement;
    const body    = document.body;
    const sky     = document.getElementById('sky-canvas');
    const skyBg   = document.getElementById('sky-bg');
    const skyHoriz = document.getElementById('sky-horizon');
    const sunEl   = document.getElementById('sun');
    const sunGlow = document.getElementById('sun-glow');
    const sunRays = document.getElementById('sun-rays-wrap');
    const moonEl  = document.getElementById('moon');
    const moonGlow = document.getElementById('moon-glow');
    const starsWrap = document.getElementById('stars-wrap');
    const navEl   = document.getElementById('main-nav');
    const timeEl  = document.getElementById('sky-time');
    const toggleBtn = document.getElementById('themeToggle');
    const toggleEmj = document.getElementById('themeEmoji');
    const content = document.getElementById('content');

    /* ─── State ─── */
    let isNight = false;
    let manualOverride = null; // null | 'day' | 'night'
    let animFrame;
    let lastHour = -1;

    /* ─── Stars generation ─── */
    (function genStars() {
        const frag = document.createDocumentFragment();
        for (let i = 0; i < 190; i++) {
            const s = document.createElement('div');
            s.className = 'star';
            const sz  = Math.random() * 2.4 + 0.5;
            const x   = Math.random() * 100;
            const y   = Math.random() * 82;
            const dur = (Math.random() * 3.5 + 2).toFixed(1) + 's';
            const del = (Math.random() * 6).toFixed(1) + 's';
            const mx  = (Math.random() * 0.5 + 0.35).toFixed(2);
            s.style.cssText = `width:${sz}px;height:${sz}px;left:${x}%;top:${y}%;--dur:${dur};--del:${del};--mx:${mx}`;
            frag.appendChild(s);
        }
        starsWrap.appendChild(frag);
    })();

    /* ─── Sun rays generation ─── */
    (function genRays() {
        const frag = document.createDocumentFragment();
        const N = 14;
        for (let i = 0; i < N; i++) {
            const r = document.createElement('div');
            r.className = 'sun-ray';
            const angle = (i / N) * 360;
            const len   = 22 + Math.random() * 14;
            const del   = (i * 0.22).toFixed(2) + 's';
            const w     = 1.5 + Math.random() * 2;
            const baseT = `translateX(-50%) rotate(${angle}deg) translateY(-${50 + len}px)`;
            r.style.cssText = `width:${w}px;height:${len}px;transform:${baseT};--base-t:${baseT};animation-delay:${del};`;
            frag.appendChild(r);
        }
        sunRays.appendChild(frag);
    })();

    /* ─── SKY COLOR SYSTEM ─── */
    function celestialPosition(hour) {
        const startH = 5, endH = 19.5;
        const prog = Math.max(0, Math.min(1, (hour - startH) / (endH - startH)));
        const x    = 90 - prog * 85;
        const arcY = Math.sin(prog * Math.PI);
        const y    = 72 - arcY * 62;
        return { x, y };
    }

    function moonPosition(hour) {
        let h = hour;
        if (h < 6) h += 24;
        const startH = 20, endH = 30;
        const prog = Math.max(0, Math.min(1, (h - startH) / (endH - startH)));
        const x    = 90 - prog * 85;
        const arcY = Math.sin(prog * Math.PI);
        const y    = 72 - arcY * 62;
        return { x, y };
    }

    function getSkyColors(hour) {
        if (hour >= 5 && hour < 6.5) {
            return {
                bg: `linear-gradient(180deg,#2d1b69 0%,#8b1a4a 25%,#e8551a 50%,#f5a623 70%,#ffd700 100%)`,
                horizon: `linear-gradient(to top,rgba(255,140,0,0.7),transparent)`,
                horizonOp: 0.8, starsOp: 0.3,
            };
        } else if (hour >= 6.5 && hour < 8) {
            return {
                bg: `linear-gradient(180deg,#1a3a6e 0%,#3d6fa8 30%,#7bbde4 60%,#c8e8f7 100%)`,
                horizon: `linear-gradient(to top,rgba(255,200,100,0.35),transparent)`,
                horizonOp: 0.5, starsOp: 0,
            };
        } else if (hour >= 8 && hour < 16) {
            return {
                bg: `linear-gradient(180deg,#5baee8 0%,#87ceeb 30%,#b8dff5 65%,#ddeef8 100%)`,
                horizon: `linear-gradient(to top,rgba(200,230,255,0.3),transparent)`,
                horizonOp: 0.4, starsOp: 0,
            };
        } else if (hour >= 16 && hour < 17.5) {
            return {
                bg: `linear-gradient(180deg,#4a90d9 0%,#89b8e8 25%,#f4c56b 60%,#f9a825 100%)`,
                horizon: `linear-gradient(to top,rgba(255,160,30,0.55),transparent)`,
                horizonOp: 0.65, starsOp: 0,
            };
        } else if (hour >= 17.5 && hour < 19) {
            return {
                bg: `linear-gradient(180deg,#1a2060 0%,#7b2d8b 20%,#c8472a 45%,#f08030 68%,#fad04b 100%)`,
                horizon: `linear-gradient(to top,rgba(240,100,30,0.8),transparent)`,
                horizonOp: 0.9, starsOp: 0.15,
            };
        } else if (hour >= 19 && hour < 20.5) {
            return {
                bg: `linear-gradient(180deg,#05071c 0%,#1a1060 30%,#3d1060 60%,#7a2540 100%)`,
                horizon: `linear-gradient(to top,rgba(120,40,80,0.5),transparent)`,
                horizonOp: 0.55, starsOp: 0.6,
            };
        } else {
            return {
                bg: `linear-gradient(180deg,#020714 0%,#06091f 25%,#0e1238 55%,#0a0e30 100%)`,
                horizon: `linear-gradient(to top,rgba(20,10,60,0.3),transparent)`,
                horizonOp: 0.3, starsOp: 1,
            };
        }
    }

    function isNightHour(h) {
        return (h >= 20 || h < 5.5);
    }

    /* ─── Apply sky state ─── */
    function applySky(hour, instant) {
        const dur = instant ? '0ms' : '2000ms';
        skyBg.style.transition    = `background ${dur} ease-in-out`;
        skyHoriz.style.transition = `background ${dur} ease-in-out, opacity ${dur}`;
        starsWrap.style.transition = `opacity ${dur} ease-in-out`;

        const c = getSkyColors(hour);
        skyBg.style.background    = c.bg;
        skyHoriz.style.background = c.horizon;
        skyHoriz.style.opacity    = c.horizonOp;
        starsWrap.style.opacity   = c.starsOp;

        // Sun position & visibility
        const sunVis = (hour >= 5 && hour < 19.5);
        const sunPos = celestialPosition(hour);
        const sunOpacity = (() => {
            if (!sunVis) return 0;
            if (hour < 6) return (hour - 5) * 0.8;
            if (hour > 18.5) return (19.5 - hour) * 1.8;
            return 1;
        })();

        sunEl.style.transition = instant ? 'none' : `opacity ${dur} ease-in-out`;
        sunEl.style.opacity    = sunOpacity;
        sunEl.style.left       = sunPos.x + '%';
        sunEl.style.top        = sunPos.y + '%';
        sunEl.style.transform  = 'none';
        sunGlow.style.opacity  = sunOpacity;
        sunRays.style.opacity  = Math.min(1, sunOpacity * 1.2);

        if (hour < 8 || hour > 16) {
            sunEl.style.boxShadow = '0 0 38px 14px rgba(255,140,0,0.6),0 0 75px 28px rgba(255,80,0,0.35),0 0 120px 48px rgba(255,60,0,0.15)';
        } else {
            sunEl.style.boxShadow = '0 0 35px 12px rgba(255,210,0,0.55),0 0 70px 25px rgba(255,160,0,0.3),0 0 110px 45px rgba(255,120,0,0.12)';
        }

        // Moon position & visibility
        const moonVis = (hour >= 19.5 || hour <= 6);
        const moonPos = moonPosition(hour);
        const moonOpacity = (() => {
            if (!moonVis) return 0;
            if (hour >= 19.5 && hour < 21) return (hour - 19.5) / 1.5;
            if (hour >= 5 && hour <= 6) return 1 - (hour - 5);
            return 1;
        })();

        moonEl.style.transition = instant ? 'none' : `opacity ${dur} ease-in-out`;
        moonEl.style.opacity    = moonOpacity;
        moonEl.style.left       = moonPos.x + '%';
        moonEl.style.top        = moonPos.y + '%';
        moonEl.style.transform  = 'none';
        moonGlow.style.opacity  = moonOpacity * 0.85;

        // Cloud opacity
        const cloudOp = (() => {
            if (hour >= 8 && hour < 16) return 0.88;
            if (hour < 5 || hour > 21) return 0.05;
            if (hour >= 5 && hour < 8) return 0.3 + (hour - 5) * 0.19;
            if (hour >= 16 && hour < 19) return 0.88 - (hour - 16) * 0.27;
            if (hour >= 19) return 0.05 + (21 - hour) * 0.1;
            return 0.6;
        })();
        document.querySelectorAll('.cloud').forEach(c => {
            c.style.transition = `opacity ${dur} ease-in-out`;
            c.style.opacity    = cloudOp;
        });

        // Determine day/night for typography
        const night = isNightHour(hour);
        if (night !== isNight) {
            isNight = night;
            updateThemeUI(night);
        }
    }

    function updateThemeUI(night) {
        content.classList.toggle('day-text', !night);
        content.classList.toggle('night-text', night);
        navEl.classList.toggle('nav-bg-day', !night);
        navEl.classList.toggle('nav-bg-night', night);

        toggleBtn.classList.toggle('is-day', !night);
        toggleBtn.classList.toggle('is-night', night);
        toggleBtn.setAttribute('aria-pressed', night ? 'true' : 'false');
        toggleEmj.textContent = night ? '🌙' : '☀️';

        timeEl.classList.toggle('time-day', !night);
        timeEl.classList.toggle('time-night', night);

        document.querySelectorAll('.tc-warm').forEach(el => {
            el.classList.toggle('tc-warm-day', !night);
            el.classList.toggle('tc-warm-night', night);
        });
    }

    /* ─── Clock tick ─── */
    function tick() {
        const now = new Date();
        const h   = now.getHours();
        const m   = now.getMinutes();
        const s   = now.getSeconds();

        const hh = String(h).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        timeEl.textContent = `${hh}:${mm}`;

        const hour = h + m / 60 + s / 3600;

        if (Math.floor(hour * 60) !== Math.floor(lastHour * 60)) {
            lastHour = hour;
            if (!manualOverride) {
                applySky(hour, false);
            }
        }

        requestAnimationFrame(tick);
    }

    /* ─── Parallax on mouse move ─── */
    document.addEventListener('mousemove', e => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const mx = (e.clientX / window.innerWidth  - 0.5) * 2;
        const my = (e.clientY / window.innerHeight - 0.5) * 2;
        const dx = mx * 8, dy = my * 5;
        if (sunEl.style.opacity > 0.1) {
            sunEl.style.marginLeft = dx + 'px';
            sunEl.style.marginTop  = dy + 'px';
        }
        if (moonEl.style.opacity > 0.1) {
            moonEl.style.marginLeft = dx + 'px';
            moonEl.style.marginTop  = dy + 'px';
        }
        document.querySelectorAll('.cloud').forEach((c, i) => {
            const factor = (i + 1) * 0.4;
            c.style.marginTop = (dy * factor) + 'px';
        });
    }, { passive: true });

    /* ─── Manual override toggle ─── */
    toggleBtn.addEventListener('click', () => {
        if (manualOverride === null) {
            manualOverride = isNight ? 'day' : 'night';
        } else if (manualOverride === 'day') {
            manualOverride = 'night';
        } else {
            manualOverride = 'day';
        }

        const targetNight = (manualOverride === 'night');
        const synHour = targetNight ? 23 : 12;
        applySky(synHour, false);
    });

    /* ─── Typing effect ─── */
    (function () {
        const words = ['Cybersecurity', 'Web Development', 'Java Developer', 'Problem Solver', 'DSA Enthusiast', 'Linux Learner'];
        const el = document.getElementById('typing-word');
        let wi = 0, ci = 0, del = false;
        function tick() {
            const w = words[wi];
            if (!del) {
                ci++;
                el.textContent = w.slice(0, ci);
                if (ci === w.length) { del = true; setTimeout(tick, 1900); return; }
            } else {
                ci--;
                el.textContent = w.slice(0, ci);
                if (ci === 0) { del = false; wi = (wi + 1) % words.length; setTimeout(tick, 280); return; }
            }
            setTimeout(tick, del ? 42 : 78);
        }
        setTimeout(tick, 700);
    })();

    /* ─── Scroll reveal ─── */
    (function () {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) { e.target.classList.add('vi'); obs.unobserve(e.target); }
            });
        }, { threshold: 0.1 });
        document.querySelectorAll('.rv').forEach(el => obs.observe(el));
    })();

    /* ─── Achievement counters ─── */
    (function () {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (!e.isIntersecting) return;
                const el     = e.target;
                const target = parseInt(el.dataset.target, 10);
                const suffix = el.dataset.suffix || '';
                let cur = 0;
                const dur   = 1400;
                const start = performance.now();
                function step(now) {
                    const p = Math.min((now - start) / dur, 1);
                    cur = Math.round(p * target);
                    el.textContent = cur + suffix;
                    if (p < 1) requestAnimationFrame(step);
                    else el.textContent = target + suffix;
                }
                requestAnimationFrame(step);
                obs.unobserve(el);
            });
        }, { threshold: 0.5 });
        document.querySelectorAll('[data-target]').forEach(el => obs.observe(el));
    })();

    /* ─── Init ─── */
    content.classList.add('day-text');
    const now = new Date();
    const initHour = now.getHours() + now.getMinutes() / 60;
    applySky(initHour, true);
    tick();

    /* ─── Smooth scroll ─── */
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', function (e) {
            const t = document.querySelector(this.getAttribute('href'));
            if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
        });
    });

    /* ─── Resume placeholder ─── */
    document.getElementById('resumeBtn').addEventListener('click', function (e) {
        if (this.getAttribute('href') === 'resume.pdf') {
            e.preventDefault();
            alert('Replace href="resume.pdf" with your actual resume URL to enable downloads.');
        }
    });

})();
