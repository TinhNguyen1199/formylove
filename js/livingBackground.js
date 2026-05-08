// Living background — a low-z canvas that picks one of several ambient
// scenes per session (sakura storm, fireflies, star rain, aurora, soft
// drizzle). Scene selection is weighted by real-world season + time of day,
// so opening the page never feels the same twice.
//
// Sits BEHIND the Three.js gesture canvas (z-index 0 vs three-canvas 1).
// Three.js renders with alpha so the background shows through where the
// gesture object isn't drawing. Honours pause()/resume()/clear() to mirror
// the rest of the ambient layer when gesture tracking is toggled off.

const SCENES = ["sakura", "fireflies", "starrain", "aurora", "drizzle"];

function pickScene() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const hour = now.getHours();

    const weights = {
        sakura: 1, fireflies: 1, starrain: 1, aurora: 1, drizzle: 1,
    };

    // Seasonal favourites — northern hemisphere calendar, since the gift is
    // for Như's May birthday and the rest of the project is built around
    // that timeline.
    if (month >= 3 && month <= 5)        weights.sakura    *= 4;
    if (month >= 6 && month <= 8)        weights.fireflies *= 4;
    if (month >= 9 && month <= 11)     { weights.drizzle   *= 3; weights.starrain *= 2; }
    if (month === 12 || month <= 2)    { weights.aurora    *= 3; weights.starrain *= 2; }

    // Time-of-day boosts: aurora reads better at night; fireflies feel
    // right at dusk; star rain is best in the small hours.
    if (hour >= 20 || hour < 6)          weights.aurora    *= 2;
    if (hour >= 18 && hour < 22)         weights.fireflies *= 1.6;
    if (hour >= 0 && hour < 5)           weights.starrain  *= 2;

    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (const k of SCENES) {
        if (r < weights[k]) return k;
        r -= weights[k];
    }
    return "sakura";
}

export class LivingBackground {
    constructor({ scene } = {}) {
        this.scene = scene ?? pickScene();
        this.canvas = document.createElement("canvas");
        this.canvas.id = "living-bg";
        this.canvas.className = `scene-${this.scene}`;
        // Insert at the very front of <body> so it renders behind everything
        // else stacking-context-wise (low z-index also enforces this).
        document.body.insertBefore(this.canvas, document.body.firstChild);
        this.ctx = this.canvas.getContext("2d");
        this.particles = [];
        this._paused = false;
        this._lastStar = 0;
        this._auroraTime = 0;

        this._resize();
        window.addEventListener("resize", () => this._resize());
        this._init();
        this._lastT = performance.now();
        requestAnimationFrame((t) => this._tick(t));
    }

    _resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.floor(window.innerWidth * dpr);
        this.canvas.height = Math.floor(window.innerHeight * dpr);
        this.canvas.style.width = window.innerWidth + "px";
        this.canvas.style.height = window.innerHeight + "px";
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    _init() {
        const W = window.innerWidth;
        const H = window.innerHeight;

        if (this.scene === "sakura") {
            const count = Math.min(55, Math.floor(W / 28));
            for (let i = 0; i < count; i++) {
                this.particles.push({
                    x: Math.random() * W,
                    y: Math.random() * H,
                    vx: 0.25 + Math.random() * 0.55,
                    vy: 0.45 + Math.random() * 0.65,
                    rot: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 0.04,
                    size: 4 + Math.random() * 4.5,
                    alpha: 0.55 + Math.random() * 0.30,
                    swayPhase: Math.random() * Math.PI * 2,
                });
            }
        } else if (this.scene === "fireflies") {
            const count = Math.min(36, Math.floor(W / 38));
            for (let i = 0; i < count; i++) {
                this.particles.push({
                    x: Math.random() * W,
                    y: Math.random() * H,
                    vx: (Math.random() - 0.5) * 0.35,
                    vy: (Math.random() - 0.5) * 0.35,
                    phase: Math.random() * Math.PI * 2,
                    freq: 0.018 + Math.random() * 0.022,
                    size: 1.6 + Math.random() * 2,
                });
            }
        } else if (this.scene === "drizzle") {
            const count = Math.min(75, Math.floor(W / 20));
            for (let i = 0; i < count; i++) {
                this.particles.push({
                    x: Math.random() * W,
                    y: Math.random() * H,
                    vy: 4 + Math.random() * 3,
                    length: 11 + Math.random() * 9,
                    alpha: 0.22 + Math.random() * 0.20,
                });
            }
        }
        // starrain + aurora spawn / draw without an init particle pool.
    }

    pause() {
        if (this._paused) return;
        this._paused = true;
        this.ctx?.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }

    resume() {
        if (!this._paused) return;
        this._paused = false;
        this._lastT = performance.now();
    }

    clear() {
        this.ctx?.clearRect(0, 0, window.innerWidth, window.innerHeight);
        // For star-rain (the only scene that grows its particle list) flush
        // in-flight stars too, so resume doesn't leak old trails.
        if (this.scene === "starrain") this.particles.length = 0;
    }

    _tick(t) {
        if (this._paused) {
            // Keep the rAF chain alive so resume is instant.
            this._lastT = t;
            requestAnimationFrame((tt) => this._tick(tt));
            return;
        }
        const dt = Math.min(t - this._lastT, 50);
        this._lastT = t;
        const k = dt / 16.66;
        const W = window.innerWidth;
        const H = window.innerHeight;
        this.ctx.clearRect(0, 0, W, H);

        switch (this.scene) {
            case "sakura":    this._drawSakura(W, H, k); break;
            case "fireflies": this._drawFireflies(W, H, k); break;
            case "starrain":  this._drawStarRain(W, H, k, dt); break;
            case "aurora":    this._drawAurora(W, H, k); break;
            case "drizzle":   this._drawDrizzle(W, H, k); break;
        }

        requestAnimationFrame((tt) => this._tick(tt));
    }

    // ── Scene: sakura storm ────────────────────────────────────────────
    _drawSakura(W, H, k) {
        const ctx = this.ctx;
        for (const p of this.particles) {
            p.swayPhase += 0.018 * k;
            p.x += (p.vx + Math.sin(p.swayPhase) * 0.4) * k;
            p.y += p.vy * k;
            p.rot += p.rotSpeed * k;
            if (p.y > H + 14) { p.y = -14; p.x = Math.random() * W; }
            if (p.x > W + 14) p.x = -14;

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = `rgba(255, 198, 215, ${p.alpha})`;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // ── Scene: fireflies ───────────────────────────────────────────────
    _drawFireflies(W, H, k) {
        const ctx = this.ctx;
        for (const p of this.particles) {
            // Soft Brownian drift — small random kick + heavy damping keeps
            // motion gentle without pinning particles to a path.
            if (Math.random() < 0.008 * k) {
                p.vx += (Math.random() - 0.5) * 0.18;
                p.vy += (Math.random() - 0.5) * 0.18;
            }
            p.vx *= Math.pow(0.97, k);
            p.vy *= Math.pow(0.97, k);
            p.x += p.vx * k;
            p.y += p.vy * k;
            p.phase += p.freq * k;
            if (p.x < -10) p.x = W + 10;
            if (p.x > W + 10) p.x = -10;
            if (p.y < -10) p.y = H + 10;
            if (p.y > H + 10) p.y = -10;

            const glow = 0.5 + 0.5 * Math.sin(p.phase);
            const r = p.size * (1 + glow * 0.7);
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 5);
            grad.addColorStop(0, `rgba(255, 235, 130, ${0.42 * glow})`);
            grad.addColorStop(1, "rgba(255, 235, 130, 0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 5, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = `rgba(255, 250, 210, ${0.85 * glow})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // ── Scene: star rain ───────────────────────────────────────────────
    _drawStarRain(W, H, k, dt) {
        // Dynamically spawn streaks every ~600–1000ms. More frequent than the
        // existing AmbientEvents shooting star — this is a continuous shower.
        this._lastStar += dt;
        if (this._lastStar > 600 + Math.random() * 400) {
            this._lastStar = 0;
            this.particles.push({
                x: Math.random() * W,
                y: -20,
                vx: (Math.random() - 0.5) * 1.6,
                vy: 7 + Math.random() * 6,
                life: 0,
                maxLife: 1500 + Math.random() * 800,
                trail: [],
            });
        }

        const ctx = this.ctx;
        const live = [];
        for (const p of this.particles) {
            p.life += dt;
            p.x += p.vx * k;
            p.y += p.vy * k;
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > 12) p.trail.shift();
            if (p.life >= p.maxLife || p.y > H + 40) continue;

            const ratio = p.life / p.maxLife;
            const alpha = ratio < 0.85 ? 1 : Math.max(0, 1 - (ratio - 0.85) / 0.15);

            for (let i = 0; i < p.trail.length; i++) {
                const t01 = i / p.trail.length;
                ctx.fillStyle = `rgba(255, 240, 220, ${alpha * t01 * 0.28})`;
                ctx.beginPath();
                ctx.arc(p.trail[i].x, p.trail[i].y, 1 + t01 * 1.4, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = `rgba(255, 250, 230, ${alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2);
            ctx.fill();

            live.push(p);
        }
        this.particles = live;
    }

    // ── Scene: aurora ──────────────────────────────────────────────────
    _drawAurora(W, H, k) {
        this._auroraTime += k * 0.012;
        const ctx = this.ctx;
        const t = this._auroraTime;

        // Three overlapping wavy bands across the upper third — the band
        // height + alpha keep this subtle so the gesture scene is still the
        // main visual.
        const drawBand = (yCenter, hue, phase, opacity) => {
            const grad = ctx.createLinearGradient(0, yCenter - 90, 0, yCenter + 110);
            grad.addColorStop(0,   `hsla(${hue}, 70%, 55%, 0)`);
            grad.addColorStop(0.5, `hsla(${hue}, 70%, 55%, ${opacity})`);
            grad.addColorStop(1,   `hsla(${hue}, 70%, 55%, 0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(0, yCenter);
            for (let x = 0; x <= W; x += 18) {
                const y =
                    yCenter +
                    Math.sin(x * 0.005 + t + phase) * 28 +
                    Math.sin(x * 0.012 + t * 1.4 + phase) * 16;
                ctx.lineTo(x, y);
            }
            ctx.lineTo(W, H);
            ctx.lineTo(0, H);
            ctx.closePath();
            ctx.fill();
        };

        drawBand(H * 0.30, 150, 0,    0.22);
        drawBand(H * 0.42, 280, 1.5,  0.18);
        drawBand(H * 0.22, 200, 3.2,  0.14);
    }

    // ── Scene: soft drizzle ────────────────────────────────────────────
    _drawDrizzle(W, H, k) {
        const ctx = this.ctx;
        ctx.strokeStyle = "rgba(180, 200, 235, 0.42)";
        ctx.lineWidth = 1;
        for (const p of this.particles) {
            p.y += p.vy * k;
            p.x += p.vy * 0.18 * k;
            if (p.y > H) { p.y = -p.length; p.x = Math.random() * W; }
            if (p.x > W) p.x = 0;
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p.x - p.length * 0.18, p.y - p.length);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }
}
