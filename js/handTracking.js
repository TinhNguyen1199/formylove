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

    async start() {
        await this.preload();
        if (typeof Camera === 'undefined') {
            throw new Error('MediaPipe Camera utility not loaded');
        }
        this.camera = new Camera(this.videoEl, {
            onFrame: async () => {
                // Skip the heavy MediaPipe inference while paused. The Camera
                // keeps grabbing frames (cheap) so resuming is instant.
                if (this._paused) return;
                await this.hands.send({ image: this.videoEl });
            },
            width: 640,
            height: 480,
        });
        await this.camera.start();
    }

    // Stop running MediaPipe inference. Use this when entering a non-gesture
    // mode (e.g. game mode) so the model doesn't burn CPU in the background.
    // On pause we push a final null result so the gesture detector / scene
    // clear out — otherwise the last detected gesture would stay "stuck".
    pause() {
        if (this._paused) return;
        this._paused = true;
        this.onResults?.(null);
    }

    resume() {
        this._paused = false;
    }

    stop() {
        if (this.camera) this.camera.stop();
    }
}
