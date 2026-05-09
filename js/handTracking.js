// Wraps MediaPipe Hands. Loaded as a global (window.Hands, window.Camera) via <script> tags.

export class HandTracker {
    constructor({ videoEl, onResults }) {
        this.videoEl = videoEl;
        this.onResults = onResults;
        this.hands = null;
        this.camera = null;
        this._ready = false;
    }

    async preload() {
        if (this._ready) return;
        if (typeof Hands === 'undefined') {
            throw new Error('MediaPipe Hands script not loaded');
        }
        this.hands = new Hands({
            locateFile: (file) =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        this.hands.setOptions({
            maxNumHands: 1,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.6,
            selfieMode: true,
        });
        this.hands.onResults((results) => {
            const list = results.multiHandLandmarks ?? [];
            this.onResults(list[0] ?? null);
        });
        await this.hands.initialize();
        this._ready = true;
    }

    async start({ startCamera = true } = {}) {
        await this.preload();
        if (typeof Camera === 'undefined') {
            throw new Error('MediaPipe Camera utility not loaded');
        }
        this.camera = new Camera(this.videoEl, {
            onFrame: async () => {
                // No-op while paused. Camera is also fully stopped on pause
                // (see below), so onFrame won't even fire — this guard just
                // covers any in-flight frame already queued at stop time.
                if (this._paused) return;
                await this.hands.send({ image: this.videoEl });
            },
            width: 640,
            height: 480,
        });
        if (startCamera) {
            await this.camera.start();
        } else {
            // Bring the tracker up in paused state — MediaPipe model is loaded
            // and the Camera object is constructed, but the webcam stream is
            // not yet acquired. resume() spins it up on demand (and that's
            // when the permission prompt fires for first-time visitors).
            this._paused = true;
        }
    }

    // Pause MediaPipe inference AND release the webcam — camera light goes
    // off, the device is freed for other apps. Push a final null landmark so
    // the gesture detector + scene clear out; otherwise the last detected
    // gesture would stay "stuck" in the UI.
    pause() {
        if (this._paused) return;
        this._paused = true;
        this.onResults?.(null);
        if (this.camera) {
            try { this.camera.stop(); }
            catch (e) { console.warn('[HandTracker] camera.stop failed:', e); }
        }
    }

    // Re-acquire the webcam and resume inference. First call after a stop
    // takes ~500ms–1s while getUserMedia spins the device back up; the
    // browser usually has the permission cached so no prompt re-fires.
    async resume() {
        if (!this._paused) return;
        this._paused = false;
        if (this.camera) {
            try { await this.camera.start(); }
            catch (e) {
                console.warn('[HandTracker] camera.start failed:', e);
                // Roll back paused flag so a subsequent resume() will retry.
                this._paused = true;
            }
        }
    }

    stop() {
        if (this.camera) this.camera.stop();
    }
}
