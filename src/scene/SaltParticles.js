import * as THREE from 'three';

// More particles for a denser pour; camera descends ~3 units so we need a
// deeper kill floor and longer-lived grains.
const PARTICLE_COUNT = 1400;
const KILL_Y         = -10;   // world Y below which particles are recycled
const GRAVITY        = -5.5;

function makeCircleTexture() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0,   'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(242,240,237,0.85)');
  g.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

export class SaltParticles {
  constructor(scene) {
    this.scene = scene;
    this._spawnRate   = 0;
    this._spawnAccum  = 0;
    this._nextIdx     = 0;

    const pos  = new Float32Array(PARTICLE_COUNT * 3);
    const vel  = new Float32Array(PARTICLE_COUNT * 3);

    // Park all particles below the kill floor initially
    for (let i = 0; i < PARTICLE_COUNT; i++) pos[i * 3 + 1] = KILL_Y - 1;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.055,
      map: makeCircleTexture(),
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      color: 0xffffff,
      sizeAttenuation: true,
    });

    this.points = new THREE.Points(geo, mat);
    scene.add(this.points);

    this._pos   = pos;
    this._vel   = vel;
    this._alive = new Uint8Array(PARTICLE_COUNT); // 0 = dead, 1 = alive
    this._spawnOrigin = new THREE.Vector3();
  }

  setSpawnRate(rate)       { this._spawnRate = Math.max(0, rate); }
  setSpawnOrigin(worldPos) { this._spawnOrigin.copy(worldPos); }

  update(dt) {
    const pos   = this._pos;
    const vel   = this._vel;
    const alive = this._alive;

    // Spawn
    if (this._spawnRate > 0) {
      this._spawnAccum += this._spawnRate * dt;
      while (this._spawnAccum >= 1) {
        this._spawnAccum -= 1;
        this._spawnOne();
      }
    }

    // Integrate
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (!alive[i]) continue;

      vel[i * 3 + 1] += GRAVITY * dt;

      pos[i * 3]     += vel[i * 3]     * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;

      if (pos[i * 3 + 1] < KILL_Y) {
        alive[i] = 0;
        pos[i * 3 + 1] = KILL_Y - 1; // park out of view
      }
    }

    this.points.geometry.attributes.position.needsUpdate = true;
  }

  _spawnOne() {
    // Ring-buffer slot search
    let idx = this._nextIdx;
    for (let t = 0; t < PARTICLE_COUNT; t++) {
      if (!this._alive[idx]) break;
      idx = (idx + 1) % PARTICLE_COUNT;
    }
    this._nextIdx = (idx + 1) % PARTICLE_COUNT;

    this._alive[idx] = 1;

    const o = this._spawnOrigin;
    const s = 0.1; // spread radius
    this._pos[idx * 3]     = o.x + (Math.random() - 0.5) * s;
    this._pos[idx * 3 + 1] = o.y + (Math.random() - 0.5) * s * 0.4;
    this._pos[idx * 3 + 2] = o.z + (Math.random() - 0.5) * s;

    // Initial velocity: mostly downward with slight lateral scatter
    this._vel[idx * 3]     = (Math.random() - 0.5) * 0.7;
    this._vel[idx * 3 + 1] = -0.4 + Math.random() * -0.5;
    this._vel[idx * 3 + 2] = (Math.random() - 0.5) * 0.5;
  }

  dispose() {
    this.points.geometry.dispose();
    this.points.material.map?.dispose();
    this.points.material.dispose();
    this.scene.remove(this.points);
  }
}
