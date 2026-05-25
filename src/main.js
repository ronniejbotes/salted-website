import * as THREE from 'three';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Renderer }             from './scene/Renderer.js';
import { SaltShaker }           from './scene/SaltShaker.js';
import { SaltParticles }        from './scene/SaltParticles.js';
import { ShakeDetector }        from './interactions/ShakeDetector.js';
import { initScrollAnimations } from './animations/scroll.js';

gsap.registerPlugin(ScrollTrigger);

// Strip any URL hash so reloading mid-page always starts the intro from the top
if (window.location.hash) window.history.replaceState(null, '', window.location.pathname);

// ── DOM refs ──────────────────────────────────────────────────────────
const canvas       = document.getElementById('three-canvas');
const shakeHint    = document.getElementById('shake-hint');
const progressDots = document.querySelectorAll('.shake-progress span');
const progressBar  = document.querySelector('.shake-progress');
const brandOverlay = document.getElementById('brand-overlay');
const scrollCue    = document.getElementById('scroll-cue');
const body         = document.body;

// ── Custom cursor ─────────────────────────────────────────────────────
const cursorEl = document.createElement('div');
cursorEl.className = 'cursor';
body.appendChild(cursorEl);
let cursorX = window.innerWidth / 2, cursorY = window.innerHeight / 2;
let targetX = cursorX,              targetY = cursorY;
window.addEventListener('mousemove', e => { targetX = e.clientX; targetY = e.clientY; });

// ── Three.js setup ────────────────────────────────────────────────────
const renderer = new Renderer(canvas);
const { scene, capLight } = renderer;
const camera = renderer.camera;

// ── Shaker inside a PIVOT so rotation happens around shaker's centre ──
//    Shaker body: y = 0 (base) → y ≈ 1.95 (cap top); centre ≈ 0.975
const SHAKER_HALF_H = 0.975;

const shaker = new SaltShaker();          // does NOT add itself to scene
shaker.group.position.set(0, -SHAKER_HALF_H, 0); // shift centre to pivot origin
shaker.group.rotation.y = Math.PI * 0.5;  // 90° — faces NaCl engraving toward camera

const pivot = new THREE.Group();
pivot.position.set(0, 0, 0);
pivot.add(shaker.group);
scene.add(pivot);

// Cap marker — lives in shaker.group coords; cap top ≈ local y 2.2
const capHelper = new THREE.Object3D();
capHelper.position.set(0, 2.2, 0);
shaker.group.add(capHelper);

const particles = new SaltParticles(scene);

// ── State ─────────────────────────────────────────────────────────────
let appState      = 'locked';
let shakeProgress = 0;
let lenis         = null;
let lookAtY       = 0; // smoothly tracks camera.position.y

// ── Block native scroll until unlock ──────────────────────────────────
const _blockScroll = e => e.preventDefault();
window.addEventListener('wheel',     _blockScroll, { passive: false });
window.addEventListener('touchmove', _blockScroll, { passive: false });

// ── Lenis + ScrollTrigger ─────────────────────────────────────────────
function initLenis() {
  window.removeEventListener('wheel',     _blockScroll);
  window.removeEventListener('touchmove', _blockScroll);
  window.scrollTo(0, 0);
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  ScrollTrigger.addEventListener('refresh', () => lenis.resize());
  gsap.ticker.add(time => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  ScrollTrigger.refresh();
}

// ── Work carousel ─────────────────────────────────────────────────────
function initWorkCarousel() {
  const track       = document.querySelector('.work-track');
  const workSection = document.querySelector('.work-section');
  if (!track || !workSection || window.innerWidth < 769) return;

  const getEffDist = () => track.scrollWidth - window.innerWidth * 1.05;

  // Section must be tall enough to scroll the full card distance while sticky.
  function setHeight() {
    workSection.style.height = `${window.innerHeight + getEffDist()}px`;
  }
  ScrollTrigger.addEventListener('refreshInit', setHeight);
  setHeight();

  gsap.set(track, { x: 0 });

  // Drive the track directly from Lenis scroll position using
  // getBoundingClientRect() so there are zero ScrollTrigger measurement
  // issues. scrolled = how far the section top has passed the viewport top.
  // x = -scrolled, clamped to [0, effDist]. No dead zones, no early start.
  lenis.on('scroll', () => {
    const scrolled = -workSection.getBoundingClientRect().top;
    gsap.set(track, { x: -Math.max(0, Math.min(getEffDist(), scrolled)) });
  });
}

// ── Content entrance ──────────────────────────────────────────────────
function initContentEntrance() {
  const siteContent = document.querySelector('.site-content');
  if (siteContent) siteContent.classList.add('unlocked');

  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); });
  }, { threshold: 0.12 });
  document.querySelectorAll('.svc-section, .cta-section, .manifesto-section, .stats-section, .process-section, .why-section, .testimonials-section, .industries-section, .contact-section, .about-section, .pricing-section, .logos-section').forEach(el => io.observe(el));
  initWorkCarousel();

  // Contact form — show success state on submit
  const form    = document.getElementById('contact-form');
  const success = document.getElementById('contact-success');
  if (form && success) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      form.style.opacity = '0';
      form.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        form.style.display = 'none';
        success.classList.add('visible');
      }, 300);
    });
  }

  // Nav: transparent on hero → white on scroll
  const nav = document.getElementById('site-nav');
  if (nav) {
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Mobile nav toggle
  const navToggle = document.getElementById('nav-toggle');
  const navMobile = document.getElementById('nav-mobile');
  if (navToggle && navMobile) {
    navToggle.addEventListener('click', () => {
      navToggle.classList.toggle('active');
      navMobile.classList.toggle('open');
    });
    navMobile.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navToggle.classList.remove('active');
        navMobile.classList.remove('open');
      });
    });
  }
}

// ── Shake detector ────────────────────────────────────────────────────
const shakeDetector = new ShakeDetector({
  onProgress(p) {
    shakeProgress = p;
    progressDots.forEach((d, i) => d.classList.toggle('lit', i < Math.ceil(p * progressDots.length)));
    progressBar.classList.add('visible');
    capLight.intensity = p * 1.2;
  },
  onUnlock: unlock,
});
canvas.addEventListener('mouseenter', () => {
  cursorEl.classList.add('large');
  shakeDetector.setActive(true);
});
canvas.addEventListener('mouseleave', () => {
  cursorEl.classList.remove('large');
  shakeDetector.setActive(false);
});

// ── Unlock sequence ───────────────────────────────────────────────────
function unlock() {
  if (appState !== 'locked') return;
  appState = 'unlocking';

  shakeHint.classList.add('hidden');
  progressBar.classList.remove('visible');
  capLight.intensity = 0;

  // Hide brand text — scroll animation will reveal it after shaker fades
  brandOverlay.style.transition = 'opacity 0.4s ease';
  brandOverlay.style.opacity = '0';

  let count = 0;
  const rattle = setInterval(() => {
    // Jitter on shaker.group (relative to pivot) — pivot stays centred
    shaker.group.rotation.z = (Math.random() - 0.5) * 0.14;
    shaker.group.position.x = (Math.random() - 0.5) * 0.10;

    if (++count >= 8) {
      clearInterval(rattle);
      shaker.resetJitter();
      appState = 'scrolling';

      initLenis();
      initContentEntrance();
      initScrollAnimations({
        pivot,
        shakerGroup: shaker.group,
        particles,
        capHelper,
        camera,
        brandOverlay,
        scrollCue,
      });
      gsap.delayedCall(0.2, () => ScrollTrigger.refresh());
    }
  }, 60);
}

// ── Render loop ───────────────────────────────────────────────────────
const clock = new THREE.Clock();
let elapsed = 0;

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.05);
  elapsed += dt;

  // Cursor lerp
  cursorX += (targetX - cursorX) * 0.85;
  cursorY += (targetY - cursorY) * 0.85;
  cursorEl.style.left = `${cursorX}px`;
  cursorEl.style.top  = `${cursorY}px`;

  // Idle bob (locked/unlocking): move shaker.group Y inside pivot
  if (appState === 'locked' || appState === 'unlocking') {
    shaker.group.position.y = -SHAKER_HALF_H + Math.sin(elapsed * 0.85) * 0.035;
    if (appState === 'locked') shaker.applyShakeJitter(shakeProgress, elapsed);
  }

  // Camera lookAt smoothly follows camera.position.y
  lookAtY += (camera.position.y - lookAtY) * 0.06;
  camera.lookAt(0, lookAtY, 0);

  particles.update(dt);
  renderer.render();
}

tick();
