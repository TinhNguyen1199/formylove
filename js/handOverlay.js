// Draws the MediaPipe hand skeleton on a canvas overlaid on the webcam preview.
// Confirms to the user that tracking is alive and shows what the model "sees".
//
// Coordinates come from MediaPipe in normalised image space [0..1]. With
// selfieMode: true, the landmarks are already in the user-mirrored frame, so
// drawing them on a non-mirrored canvas placed over the (CSS-mirrored) video
// puts each dot exactly where the user's joint appears on screen.

const HAND_CONNECTIONS = [
    // thumb
    [0, 1], [1, 2], [2, 3], [3, 4],
    // index
    [0, 5], [5, 6], [6, 7], [7, 8],
    // middle
    [5, 9], [9, 10], [10, 11], [11, 12],
    // ring
    [9, 13], [13, 14], [14, 15], [15, 16],
    // pinky
    [13, 17], [17, 18], [18, 19], [19, 20],
    // palm-edge closure
    [0, 17],
];

export class HandOverlay {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this._fade = 0;             // smoothed opacity for graceful drop-off
        this._lastLandmarks = null; // last seen frame, used while fading out
        this._resize();
        window.addEventListener('resize', () => this._resize());
    }

    _resize() {
        // Render at 2× CSS size for crispness on hi-DPI panels.
        const rect = this.canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width  = Math.max(1, Math.round(rect.width  * dpr));
        this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    }

    setLandmarks(landmarks) {
        if (landmarks) this._lastLandmarks = landmarks;
        this._targetFade = landmarks ? 1 : 0;
    }

    // Called every frame from main's render tick — separated from setLandmarks
    // so the fade animation runs smoothly even when MediaPipe sends frames at
    // a different cadence than the display refresh.
    draw() {
        // Smooth fade so the skeleton softly fades in/out instead of popping.
        this._fade += ((this._targetFade ?? 0) - this._fade) * 0.18;
        const ctx = this.ctx;
        const W = this.canvas.width, H = this.canvas.height;
        ctx.clearRect(0, 0, W, H);

        if (this._fade < 0.01 || !this._lastLandmarks) return;

        const lm = this._lastLandmarks;
        const a = this._fade;

        // Bones — soft warm rose, kept slim so the underlying webcam still reads.
        ctx.strokeStyle = `rgba(255, 179, 200, ${0.55 * a})`;
        ctx.lineWidth = 2.0 * (W / 220) * 0.5 + 1;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (const [i, j] of HAND_CONNECTIONS) {
            const p = lm[i], q = lm[j];
            ctx.moveTo(p.x * W, p.y * H);
            ctx.lineTo(q.x * W, q.y * H);
        }
        ctx.stroke();

        // Joints — bright dots at fingertips, dimmer at the rest.
        for (let i = 0; i < lm.length; i++) {
            const isTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
            const r = (isTip ? 3.2 : 2.0) * (W / 220);
            const alpha = (isTip ? 0.95 : 0.7) * a;
            ctx.fillStyle = isTip
                ? `rgba(255, 220, 230, ${alpha})`
                : `rgba(220, 180, 200, ${alpha})`;
            ctx.beginPath();
            ctx.arc(lm[i].x * W, lm[i].y * H, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
