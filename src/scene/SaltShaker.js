import * as THREE from 'three';

function glassMat(params = {}) {
  return new THREE.MeshPhysicalMaterial({
    transparent: true,
    opacity: 1,
    color: 0xD8D6CC,
    roughness: 0.06,
    metalness: 0,
    transmission: 0.42,
    thickness: 0.55,
    envMapIntensity: 1.2,
    ...params,
  });
}

function metalMat(params = {}) {
  return new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 1,
    color: 0xBCBCB8,
    roughness: 0.10,
    metalness: 0.95,
    envMapIntensity: 2.2,
    ...params,
  });
}

export class SaltShaker {
  constructor() {
    this.group = new THREE.Group();
    this._buildGlassBody();
    this._buildCap();
    this._buildSaltFill();
  }

  _buildGlassBody() {
    // Pronounced belly + clear neck — reads immediately as a salt shaker
    const pts = [
      [0.000, 0.000],
      [0.190, 0.000],  // base edge
      [0.218, 0.048],  // base shoulder flare
      [0.240, 0.180],  // lower body
      [0.258, 0.430],  // belly swelling
      [0.265, 0.700],  // widest point
      [0.260, 0.980],  // upper body
      [0.238, 1.210],  // shoulder taper
      [0.196, 1.440],  // neck — clear narrowing
      [0.178, 1.570],  // collar
      [0.178, 1.700],  // top of glass (cap sits here)
    ].map(([x, y]) => new THREE.Vector2(x, y));

    this.group.add(new THREE.Mesh(
      new THREE.LatheGeometry(pts, 96),
      glassMat(),
    ));

    // Base disc
    const base = new THREE.Mesh(
      new THREE.CircleGeometry(0.190, 80),
      glassMat({ roughness: 0.25, transmission: 0.08 }),
    );
    base.rotation.x = -Math.PI / 2;
    this.group.add(base);
  }

  _buildCap() {
    const m = metalMat();

    // Threaded skirt — slightly tapered, wider at base
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.183, 0.190, 0.24, 80),
      m,
    );
    skirt.position.y = 1.700 + 0.12;
    this.group.add(skirt);

    // Dome top
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.183, 80, 40, 0, Math.PI * 2, 0, Math.PI * 0.47),
      m,
    );
    dome.position.y = 1.700 + 0.24;
    this.group.add(dome);

    // Salt holes — 9, on a flat disc just inside the dome top
    const holeMat = metalMat({ color: 0x060708, roughness: 1, metalness: 0 });
    [
      [0, 0],
      [0.068, 0.068], [-0.068, 0.068], [0.068, -0.068], [-0.068, -0.068],
      [0.092, 0], [-0.092, 0], [0, 0.092], [0, -0.092],
    ].forEach(([x, z]) => {
      const h = new THREE.Mesh(new THREE.CircleGeometry(0.018, 10), holeMat);
      h.rotation.x = -Math.PI / 2;
      h.position.set(x, 1.700 + 0.24 + 0.172, z);
      this.group.add(h);
    });
  }

  _buildSaltFill() {
    // Visible salt mass inside the glass — gives depth to the transparent body
    const salt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.172, 0.172, 1.00, 64),
      new THREE.MeshStandardMaterial({
        color: 0xF2F0E8,
        roughness: 0.92,
        metalness: 0,
        transparent: true,
        opacity: 0.88,
      }),
    );
    salt.position.y = 0.54;
    this.group.add(salt);
  }

  applyShakeJitter(progress, time) {
    if (progress <= 0) return;
    const m = progress * 0.09;
    this.group.rotation.z = Math.sin(time * 28) * m;
    this.group.position.x = Math.sin(time * 26 + 0.5) * m * 0.25;
  }

  resetJitter() {
    this.group.rotation.z = 0;
    this.group.position.x = 0;
  }

  dispose() {
    this.group.traverse(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose());
      }
    });
  }
}
