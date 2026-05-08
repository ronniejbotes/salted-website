const REQUIRED_OSCILLATIONS = 6;
const MIN_SWING_PX = 28;

export class ShakeDetector {
  /**
   * @param {object} callbacks
   * @param {(progress: number) => void} callbacks.onProgress  - 0 to 1
   * @param {() => void}                 callbacks.onUnlock
   */
  constructor({ onProgress, onUnlock }) {
    this._onProgress = onProgress;
    this._onUnlock   = onUnlock;

    this._lastX       = null;
    this._lastDir     = 0;       // 1 = right, -1 = left
    this._swingOrigin = null;
    this._count       = 0;
    this._unlocked    = false;
    this._active      = false;   // only track while mouse is over canvas

    this._mouseHandler = this._onMouseMove.bind(this);
    window.addEventListener('mousemove', this._mouseHandler);
  }

  setActive(active) { this._active = active; }

  _onMouseMove(e) {
    if (this._unlocked || !this._active) return;

    const x = e.clientX;

    if (this._lastX === null) {
      this._lastX = x;
      this._swingOrigin = x;
      return;
    }

    const dx = x - this._lastX;
    this._lastX = x;

    if (Math.abs(dx) < 1.5) return; // ignore micro-jitter

    const dir = dx > 0 ? 1 : -1;

    if (dir !== this._lastDir && this._lastDir !== 0) {
      // Direction reversed — check swing amplitude
      const amplitude = Math.abs(x - this._swingOrigin);
      if (amplitude >= MIN_SWING_PX) {
        this._count++;
        this._swingOrigin = x;
        const progress = Math.min(this._count / REQUIRED_OSCILLATIONS, 1);
        this._onProgress(progress);

        if (this._count >= REQUIRED_OSCILLATIONS) {
          this._unlocked = true;
          this._onUnlock();
        }
      }
    }

    this._lastDir = dir;
  }

  reset() {
    this._lastX       = null;
    this._lastDir     = 0;
    this._swingOrigin = null;
    this._count       = 0;
    this._unlocked    = false;
  }

  destroy() {
    window.removeEventListener('mousemove', this._mouseHandler);
  }
}
