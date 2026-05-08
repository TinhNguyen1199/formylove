// Lightweight 2D confetti burst — paper-rectangle particles that spray inward
// from both sides at the top, gravity-driven fall, soft fade at end-of-life.
// Runs on its own canvas overlay so it doesn't touch the Three.js pipeline.

const COLORS = [
    '#ff6fa3',   // brand rose
    '#ffb3c8',   // soft pink
    '#ffd884',   // champagne gold
    '#7fc9b0',   // mint
    '#b4a4c8',   // lavender
    '#ffffff',   // white pop
];

export class ConfettiBurst {
    constructor() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'confetti-overlay';
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this._running = false;
        this._lastT = 0;
        this._dpr = 1;
        this._resize();
        window.addEventListener('resize', () => this._resize());
    }

    _resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width  = Math.floor(window.innerWidth  * dpr);
        this.canvas.height = Math.floor(window.innerHeight * dpr);
        this.canvas.style.width  = window.innerWidth  + 'px';
        this.canvas.style.height = window.innerHeight + 'px';
        // Setting canvas.width/height resets the transform; re-apply DPR scale
        // so subsequent draws use CSS pixel coordinates.
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this._dpr = dpr;
    }

    clear() {
        this.particles.length = 0;
        const W = window.innerWidth;
        const H = window.innerHeight;
        this.ctx?.clearRect(0, 0, W, H);
    }

    burst({ count = 140, duration = 4500 } = {}) {
        const W = window.innerWidth;
        const H = window.innerHeight;
        for (let i = 0; i < count; i++) {
            const fromLeft = Math.random() < 0.5;
            this.particles.push({
                x: fromLeft ? -10 : W + 10,
                y: H * (0.05 + Math.random() * 0.30),
                // Spray inward and slightly upward; gravity pulls down after.
                vx: (fromLeft ? 1 : -1) * (3.5 + Math.random() * 4.5),
                vy: -3.5 - Math.random() * 3.5,
                gravity: 0.16 + Math.random() * 0.06,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.45,
                width:  6 + Math.random() * 6,
                height: 9 + Math.random() * 7,
                color: COLORS[(Math.random() * COLORS.length) | 0],
                life: 0,
                maxLife: duration + Math.random() * 1500,
            });
        }
        if (!this._running) {
            this._running = true;
            this._lastT = performance.now();
            requestAnimationFrame((t) => this._tick(t));
        }
    }

    _tick(t) {
        const dt = Math.min(t - this._lastT, 50);   // clamp big frame jumps
        this._lastT = t;

        // Scale physics by dt/16.66 so motion is frame-rate independent.
        const k = dt / 16.66;
        const ctx = this.ctx;
        const W = window.innerWidth;
        const H = window.innerHeight;
        ctx.clearRect(0, 0, W, H);

        const live = [];
        for (const p of this.particles) {
            p.life += dt;
            const ratio = p.life / p.maxLife;
            if (ratio >= 1 || p.y > H + 30) continue;

            p.vx *= Math.pow(0.995, k);
            p.vy += p.gravity * k;
            p.x  += p.vx * k;
            p.y  += p.vy * k;
            p.rotation += p.rotSpeed * k;

            // Fade out across last 15% of life.
            const alpha = ratio < 0.85 ? 1 : Math.max(0, 1 - (ratio - 0.85) / 0.15);

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
            ctx.restore();

            live.push(p);
        }
        this.particles = live;

        if (this.particles.length > 0) {
            requestAnimationFrame((t) => this._tick(t));
        } else {
            this._running = false;
            ctx.clearRect(0, 0, W, H);
        }
    }
}
