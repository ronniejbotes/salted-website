import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initEnvironment();
    this._initLights();
    this._initComposer();
    this._bindResize();
  }

  _size() {
    // Read from the wrapping div, not the canvas pixel attrs
    const el = this.canvas.parentElement || document.body;
    return { w: el.clientWidth || window.innerWidth, h: el.clientHeight || window.innerHeight };
  }

  _initRenderer() {
    const { w, h } = this._size();
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0B0C0F);
  }

  _initCamera() {
    const { w, h } = this._size();
    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    this.camera.position.set(0, 0.7, 6.5);
    this.camera.lookAt(0, 0.7, 0);
  }

  _initEnvironment() {
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  }

  _initLights() {
    // Gentle ambient so nothing is pitch black
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.7));

    // Key — upper left, soft warm
    const key = new THREE.DirectionalLight(0xEDE8E0, 1.4);
    key.position.set(-3, 4, 3);
    this.scene.add(key);

    // Fill — right, cool
    const fill = new THREE.DirectionalLight(0xB8CCE0, 0.5);
    fill.position.set(4, 1, 2);
    this.scene.add(fill);

    // Rim — behind for edge separation only
    const rim = new THREE.DirectionalLight(0xB8CCE0, 0.9);
    rim.position.set(0, 3, -5);
    this.scene.add(rim);

    // Cap accent (only on during shake)
    this.capLight = new THREE.PointLight(0xffffff, 0, 4);
    this.capLight.position.set(0, 2.4, 1.2);
    this.scene.add(this.capLight);
  }

  _initComposer() {
    const { w, h } = this._size();
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // Subtle bloom — only very bright highlights catch it
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.18, 0.4, 0.92);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());
  }

  _bindResize() {
    this._doResize = () => {
      const { w, h } = this._size();
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
      this.composer.setSize(w, h);
    };

    // ResizeObserver fires whenever the canvas-wrap changes size (including
    // during the CSS unlock transition — window 'resize' would miss that)
    this._ro = new ResizeObserver(this._doResize);
    this._ro.observe(this.canvas.parentElement || document.body);
  }

  render() { this.composer.render(); }

  destroy() {
    this._ro.disconnect();
    this.renderer.dispose();
    // Explicitly release the WebGL context so browsers don't accumulate zombie
    // contexts across refreshes and hit the per-origin limit (~8–16).
    const gl  = this.renderer.getContext();
    const ext = gl?.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
  }
}
