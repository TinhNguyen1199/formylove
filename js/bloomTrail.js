// Bloom trail — soft pastel flowers bloom under the cursor as it moves, plus
// a larger flower whenever the cursor lingers. Pure 2D canvas with additive
// compositing, sits at the same layer as cursor-magnet.
//
// Trail blooms (~14px) drop every TRAIL_PIXEL_GAP px of cursor travel and
// fade in ~700ms. A "rest bloom" (~38px) drops wherever the cursor has been
// still for STILL_THRESHOLD ms; a cooldown prevents stacking when the user
// just stops to read.

const PALETTE = [
    'rgba(255, 200, 220, ',   // soft pink
    'rgba(220, 200, 255, ',   // lavender
    'rgba(200, 230, 220, ',   // pale mint
    'rgba(255, 220, 180, ',   // warm peach
    'rgba(255, 240, 220, ',   // pearl
];

const TRAIL_PIXEL_GAP    = 26;
const TRAIL_LIFETIME_MS  = 750;
const REST_LIFETIME_MS   = 1900;
const STILL_THRESHOLD_MS = 1500;
const REST_COOLDOWN_MS   = 2200;
const TRAIL_MAX_RADIUS   = 14;
const REST_MAX_RADIUS    = 38;

export class BloomTrail {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'bloom-trail';
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.blooms = [];
        this.mouseX = -1000;
        this.mouseY = -1000;
        this._hasMoved = false;
        this._lastDropX = -1000;
        this._lastDropY = -1000;
        this._lastMoveTime = 0;
        this._lastRestTime = 0;

        this._resize();
        window.addEventListener('resize', () => this._resize());
        window.addEventListener('mousemove', (e) => this._onMove(e), { passive: true });
        window.addEventListener('mouseleave', () => { this._hasMoved = false; });

        requestAnimationFrame((t) => this._tick(t));
    }

    _resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width  = Math.floor(window.innerWidth  * dpr);
        this.canvas.height = Math.floor(window.innerHeight * dpr);
        this.canvas.style.width  = window.innerWidth  + 'px';
        this.canvas.style.height = window.innerHeight + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    pause() {
        if (this._paused) return;
        this._paused = true;
        this.blooms.length = 0;
        this.ctx?.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }

    resume() {
        if (!this._paused) return;
        this._paused = false;
        // Reset stillness timer so we don't immediately fire a rest bloom.
        this._lastMoveTime = performance.now();
    }

    clear() {
        this.blooms.length = 0;
        this.ctx?.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }

    _onMove(e) {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        this._hasMoved = true;
        this._lastMoveTime = performance.now();

        const dx = e.clientX - this._lastDropX;
        const dy = e.clientY - this._lastDropY;
        if (Math.hypot(dx, dy) > TRAIL_PIXEL_GAP) {
            this._dropBloom(e.clientX, e.clientY, false);
            this._lastDropX = e.clientX;
            this._lastDropY = e.clientY;
        }
    }

    _dropBloom(x, y, isRest) {
        this.blooms.push({
            x, y,
            color:    PALETTE[(Math.random() * PALETTE.length) | 0],
            born:     performance.now(),
            life:     isRest ? REST_LIFETIME_MS  : TRAIL_LIFETIME_MS,
            maxR:     isRest ? REST_MAX_RADIUS   : TRAIL_MAX_RADIUS,
            petals:   isRest ? 8 : 5,
            rotation: Math.random() * Math.PI * 2,
            spin:     isRest ? 0.6 : 0.3,
            isRest,
        });
    }

    _tick(t) {
        if (this._paused) {
            requestAnimationFrame((tt) => this._tick(tt));
            return;
        }

        const ctx = this.ctx;
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        // Rest bloom: drop one when the cursor has been still long enough,
        // then again every REST_COOLDOWN_MS while the cursor stays put.
        if (this._hasMoved &&
            t - this._lastMoveTime > STILL_THRESHOLD_MS &&
            t - this._lastRestTime > REST_COOLDOWN_MS) {
            this._dropBloom(this.mouseX, this.mouseY, true);
            this._lastRestTime = t;
        }

        // Additive composite — overlapping petals brighten the centre naturally
        // without a separate "stigma" highlight.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';

        for (let i = this.blooms.length - 1; i >= 0; i--) {
            const b = this.blooms[i];
            const age = t - b.born;
            if (age >= b.life) {
                this.blooms.splice(i, 1);
                continue;
            }
            const p = age / b.life;
            // Grow fast, then plateau — most of the lifetime is spent fading.
            const r = b.maxR * Math.min(1, p * 3);
            // Sin-arch alpha: 0 → peak → 0 across the bloom's life.
            const alpha = Math.sin(p * Math.PI) * (b.isRest ? 0.55 : 0.42);

            ctx.save();
            ctx.translate(b.x, b.y);
            ctx.rotate(b.rotation + p * b.spin);

            for (let k = 0; k < b.petals; k++) {
                const angle = (k / b.petals) * Math.PI * 2;
                const px = Math.cos(angle) * r * 0.45;
                const py = Math.sin(angle) * r * 0.45;

                const grad = ctx.createRadialGradient(px, py, 0, px, py, r * 0.6);
                grad.addColorStop(0,   b.color + (alpha * 0.7) + ')');
                grad.addColorStop(1,   b.color + '0)');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(px, py, r * 0.6, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }

        ctx.restore();

        requestAnimationFrame((tt) => this._tick(tt));
    }
}
