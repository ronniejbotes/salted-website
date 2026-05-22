import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class SaltShaker {
  constructor() {
    this.group = new THREE.Group();
    this._model = null;
    this._load();
  }

  _load() {
    const loader = new GLTFLoader();
    loader.load('/salt-shaker.glb', (gltf) => {
      const model = gltf.scene;

      // Auto-scale to ~2 units tall and centre at y=0
      const box = new THREE.Box3().setFromObject(model);
      const size = new THREE.Vector3();
      box.getSize(size);
      const scale = 2.0 / size.y;
      model.scale.setScalar(scale);

      // Shift so base sits at y=0
      box.setFromObject(model);
      model.position.y -= box.min.y;

      // Enable transparency on all materials so opacity can be animated
      model.traverse(obj => {
        if (obj.isMesh && obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(m => { m.transparent = true; m.needsUpdate = true; });
        }
      });

      this._model = model;
      this.group.add(model);
    });
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
