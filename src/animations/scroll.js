import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';

const _wp = new THREE.Vector3();

function clamp01(v) { return Math.min(1, Math.max(0, v)); }

/**
 * Single ScrollTrigger that pins #pin-scene for 5 scroll-heights.
 * All animation state is computed directly from self.progress — no
 * intermediate GSAP tweens so there are zero onUpdate reliability issues.
 *
 * Timeline (progress 0 → 1):
 *  0.00–0.30  brand overlay fades out
 *  0.00–0.55  shaker fades to invisible (dissolves in place)
 *  0.20–0.30  spawn rate ramps to 300/s
 *  0.30–0.85  steady salt pour at 300/s
 *  0.85–1.00  spawn tapers to 0
 *  0.15–0.90  camera descends (follows falling salt)
 */
export function initScrollAnimations({
  pivot,
  shakerGroup,
  particles,
  capHelper,
  camera,
  brandOverlay,
  scrollCue,
  onComplete,
}) {
  const CAM_START_Y =  0.3;
  const CAM_END_Y   = -2.4;

  scrollCue.classList.add('visible');

  // ── Manifesto word-by-word highlight ────────────────────────────
  const manifestoEl = document.querySelector('.manifesto-text');
  if (manifestoEl) {
    const words = manifestoEl.textContent.trim().split(/\s+/);
    manifestoEl.innerHTML = words.map(w => `<span class="mf-word">${w}</span>`).join(' ');
    const wordEls = Array.from(manifestoEl.querySelectorAll('.mf-word'));
    ScrollTrigger.create({
      trigger: '.manifesto-section',
      start: 'top 10%',
      end: 'bottom 10%',
      scrub: 1,
      onUpdate(self) {
        const lit = Math.round(self.progress * wordEls.length);
        wordEls.forEach((w, i) => w.classList.toggle('lit', i < lit));
      },
    });
  }

  ScrollTrigger.create({
    trigger: '#pin-scene',
    start:   'top top',
    end:     '+=80%',
    pin:     true,
    scrub:   0.8,
    onUpdate(self) {
      const p = self.progress;

      // 1. Shaker dissolves + spins — fades and rotates from 0% → 20% scroll
      const fadeT = clamp01(p / 0.20);
      const shakerOpacity = 1 - fadeT;
      shakerGroup.traverse(obj => {
        if (obj.isMesh && obj.material) obj.material.opacity = shakerOpacity;
      });
      pivot.rotation.y = Math.PI * 3 * fadeT; // 1.5 Y-axis spins as it fades (25% slower)

      // 2. Camera descent — starts at 15%, reaches bottom at 90%
      const camT = clamp01((p - 0.15) / 0.75);
      camera.position.y = CAM_START_Y + (CAM_END_Y - CAM_START_Y) * camT;

      // 3. Particle spawn rate — starts as shaker begins to fade
      let rate = 0;
      if (p >= 0.20 && p < 0.30) {
        rate = clamp01((p - 0.20) / 0.10) * 300;    // ramp up
      } else if (p >= 0.30 && p < 0.85) {
        rate = 300;                                    // steady pour
      } else if (p >= 0.85) {
        rate = clamp01(1 - (p - 0.85) / 0.15) * 300; // taper off
      }
      particles.setSpawnRate(rate);

      // 4. Keep spawn origin at cap world position
      capHelper.getWorldPosition(_wp);
      particles.setSpawnOrigin(_wp);

      // 5. Brand overlay: fades in right after shaker is gone (22%→40%)
      brandOverlay.style.transition = 'none';
      brandOverlay.style.opacity = String(clamp01((p - 0.22) / 0.18));
    },
    onLeave() {
      onComplete?.();
    },
  });
}
