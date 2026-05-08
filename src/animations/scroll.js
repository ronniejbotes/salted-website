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
 *  0.00–0.45  shaker rotates 0 → –180° (fully inverted)
 *  0.00–0.30  brand overlay fades out
 *  0.38–0.92  camera descends (follows falling salt)
 *  0.45–0.50  spawn rate ramps to 300/s
 *  0.50–0.88  steady salt pour at 300/s
 *  0.88–1.00  spawn tapers to 0
 *  0.80–1.00  shaker fades to invisible
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

  ScrollTrigger.create({
    trigger: '#pin-scene',
    start:   'top top',
    end:     '+=500%',      // 5 viewport-heights of scroll drive the animation
    pin:     true,
    scrub:   2.0,
    onUpdate(self) {
      const p = self.progress;

      // 1. Rotate pivot — full 180° inversion by 45% scroll
      pivot.rotation.z = -Math.PI * clamp01(p / 0.45);

      // 2. Camera descent — starts at 38%, reaches bottom at 92%
      const camT = clamp01((p - 0.38) / 0.54);
      camera.position.y = CAM_START_Y + (CAM_END_Y - CAM_START_Y) * camT;

      // 3. Particle spawn rate
      let rate = 0;
      if (p >= 0.45 && p < 0.50) {
        rate = clamp01((p - 0.45) / 0.05) * 300;   // ramp up
      } else if (p >= 0.50 && p < 0.88) {
        rate = 300;                                   // steady pour
      } else if (p >= 0.88) {
        rate = clamp01(1 - (p - 0.88) / 0.12) * 300; // taper off
      }
      particles.setSpawnRate(rate);

      // 4. Keep spawn origin at cap world position
      capHelper.getWorldPosition(_wp);
      particles.setSpawnOrigin(_wp);

      // 5. Shaker fade — disappears from 80% → 100%
      const shakerOpacity = 1 - clamp01((p - 0.80) / 0.20);
      shakerGroup.traverse(obj => {
        if (obj.isMesh && obj.material) obj.material.opacity = shakerOpacity;
      });

      // 6. Brand overlay fades by 30%
      brandOverlay.style.opacity = String(clamp01(1 - p / 0.30));
    },
    onLeave() {
      // Pin released — content sections animate in via IntersectionObserver
      onComplete?.();
    },
  });
}
