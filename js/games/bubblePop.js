// Bubble Pop Zen — heart bubbles rise from the bottom; click to pop.
// No fail state, no timer. Lifetime counter persists across sessions.
// Combo system: 3+ pops within 1.5s gives a multiplier flash.

const STORAGE_KEY = 'bubble_pop_lifetime';

const BUBBLE_COLORS = [
    '#ff9bbe', '#ffb3c8', '#d8b6c5', '#b4a4c8',
    '#a3c3d0', '#f5d0e0', '#ffd884', '#ffffff',
];

export class BubblePop {
    constructor({ stage, stats }) {
        this.stage = stage;
        this.stats = stats;

        this.bubbles    = [];
        this.particles  = [];
        this.spawnAccum = 0;
        this.session    = 0;
        this.combo      = 0;
        this.comboUntil = 0;
        this.multi      = 1;
        this._running   = false;

        this.lifetime = Number(localStorage.getItem(STORAGE_KEY) || 0);
    }

    start() {
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'game-canvas';
        this.stage.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this._resize();
        this._onResize = () => this._resize();
        window.addEventListener('resize', this._onResize);

        this._onClick = (e) => this._handleClick(e);
        this.canvas.addEventListener('click', this._onClick);

        this.stats.innerHTML = `
            <div><span class="stat-key">Session:</span><span class="stat-val" data-k="session">0</span></div>
            <div><span class="stat-key">Lifetime:</span><span class="stat-val" data-k="lifetime">${this.lifetime}</span></div>
            <span class="stat-multi" data-k="multi" hidden>x1</span>
        `;
        this._sessionEl  = this.stats.querySelector('[data-k="session"]');
        this._lifetimeEl = this.stats.querySelector('[data-k="lifetime"]');
        this._multiEl    = this.stats.querySelector('[data-k="multi"]');

        this._running = true;
        this._lastT = performance.now();
        requestAnimationFrame((t) => this._tick(t));
    }

    stop() {
        this._running = false;
        window.removeEventListener('resize', this._onResize);
        this.canvas?.removeEventListener('click', this._onClick);
        this.canvas?.remove();
        this.stats.innerHTML = '';
        // Persist the lifetime counter.
        localStorage.setItem(STORAGE_KEY, String(this.lifetime));
    }

    _resize() {
        const dpr = window.devicePixelRatio || 1;
        const r = this.canvas.getBoundingClientRect();
        this.W = r.width;
        this.H = r.height;
        this.canvas.width  = Math.floor(this.W * dpr);
        this.canvas.height = Math.floor(this.H * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    _spawnBubble() {
        const isRare = Math.random() < 0.03;
        const size = isRare ? 38 + Math.random() * 8 : 18 + Math.random() * 22;
        this.bubbles.push({
            x: 30 + Math.random() * (this.W - 60),
            y: this.H + size,
            r: size,
            vy: -(0.7 + Math.random() * 1.0) - size * 0.012,
            vx: (Math.random() - 0.5) * 0.4,
            wobble: Math.random() * Math.PI * 2,
            color: BUBBLE_COLORS[(Math.random() * BUBBLE_COLORS.length) | 0],
            rare: isRare,
        });
    }

    _handleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Hit test (back-to-front so newest bubble pops first).
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];
            const dx = x - b.x;
            const dy = y - b.y;
            if (dx * dx + dy * dy <= b.r * b.r) {
                this._pop(b);
                this.bubbles.splice(i, 1);
                return;
            }
        }
    }

    _pop(b) {
        const now = performance.now();

        // Combo bookkeeping.
        if (now <= this.comboUntil) this.combo += 1;
        else this.combo = 1;
        this.comboUntil = now + 1500;

        let multi = 1;
        if (this.combo >= 8)      multi = 4;
        else if (this.combo >= 5) multi = 3;
        else if (this.combo >= 3) multi = 2;
        this.multi = multi;

        if (multi > 1) {
            this._multiEl.textContent = `x${multi}`;
            this._multiEl.hidden = false;
        } else {
            this._multiEl.hidden = true;
        }

        const value = b.rare ? 50 : 1;
        const gained = value * multi;
        this.session  += gained;
        this.lifetime += gained;
        this._sessionEl.textContent  = this.session;
        this._lifetimeEl.textContent = this.lifetime;

        // Particle splash.
        const particleCount = b.rare ? 20 : 10;
        for (let i = 0; i < particleCount; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = 1 + Math.random() * 3;
            this.particles.push({
                x: b.x, y: b.y,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s,
                life: 0,
                maxLife: 600 + Math.random() * 300,
                size: 2 + Math.random() * 3,
                color: b.color,
            });
        }

        // Rare bubble flash.
        if (b.rare) {
            this._rareFlashUntil = now + 600;
        }
    }

    _tick(t) {
        if (!this._running) return;
        const dt = Math.min(t - this._lastT, 50);
        this._lastT = t;
        const k = dt / 16.66;

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.W, this.H);

        // Subtle background tint when a rare bubble was just popped.
        if (this._rareFlashUntil && t < this._rareFlashUntil) {
            const alpha = (this._rareFlashUntil - t) / 600 * 0.20;
            ctx.fillStyle = `rgba(255, 220, 180, ${alpha})`;
            ctx.fillRect(0, 0, this.W, this.H);
        }

        // Combo timeout → reset.
        if (t > this.comboUntil) {
            this.combo = 0;
            this.multi = 1;
            this._multiEl.hidden = true;
        }

        // Spawn bubbles.
        this.spawnAccum += dt;
        const spawnInterval = 700 + Math.random() * 400;
        if (this.spawnAccum >= spawnInterval) {
            this.spawnAccum = 0;
            this._spawnBubble();
        }

        // Update + draw bubbles.
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];
            b.wobble += 0.05 * k;
            b.x += (b.vx + Math.sin(b.wobble) * 0.4) * k;
            b.y += b.vy * k;
            if (b.y < -b.r * 2) {
                this.bubbles.splice(i, 1);
                continue;
            }
            // Bubble body.
            const grad = ctx.createRadialGradient(
                b.x - b.r * 0.3, b.y - b.r * 0.4, b.r * 0.1,
                b.x, b.y, b.r,
            );
            grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            grad.addColorStop(0.4, b.color);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0.05)');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
            ctx.fill();

            // Heart glyph in centre.
            ctx.font = `${Math.floor(b.r * 0.9)}px serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = b.rare ? '#fff' : 'rgba(255,255,255,0.55)';
            ctx.fillText(b.rare ? 'Như' : '♥', b.x, b.y + b.r * 0.05);
        }

        // Update + draw particles.
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life += dt;
            if (p.life >= p.maxLife) {
                this.particles.splice(i, 1);
                continue;
            }
            p.vy += 0.05 * k;
            p.x  += p.vx * k;
            p.y  += p.vy * k;
            const a = 1 - p.life / p.maxLife;
            ctx.fillStyle = `rgba(255, 220, 235, ${a * 0.85})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }

        requestAnimationFrame((t) => this._tick(t));
    }
}
