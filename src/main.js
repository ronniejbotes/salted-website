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

// ── Lenis + ScrollTrigger ─────────────────────────────────────────────
function initLenis() {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(time => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}

// ── Content entrance ──────────────────────────────────────────────────
function initContentEntrance() {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in-view'); });
  }, { threshold: 0.12 });
  document.querySelectorAll('.svc-section, .cta-section').forEach(el => io.observe(el));
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
shakeDetector.setActive(true);

canvas.addEventListener('mouseenter', () => cursorEl.classList.add('large'));
canvas.addEventListener('mouseleave', () => cursorEl.classList.remove('large'));

// ── Unlock sequence ───────────────────────────────────────────────────
function unlock() {
  if (appState !== 'locked') return;
  appState = 'unlocking';

  shakeHint.classList.add('hidden');
  progressBar.classList.remove('visible');
  capLight.intensity = 0;

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
        onComplete: initContentEntrance,
      });
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
  cursorX += (targetX - cursorX) * 0.12;
  cursorY += (targetY - cursorY) * 0.12;
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
