// Heart Catcher — paddle (mouse X) at the bottom catches falling items.
// 4 item tiers: heart (1pt) · petal (2pt) · star (3pt) · "Như" diamond (10pt rare).
// 3 misses → game over with high-score screen + restart button. Spawn rate
// accelerates over time. No-miss streak grows a multiplier.

const STORAGE_KEY = 'heart_catcher_high';

const ITEM_TYPES = [
    { glyph: '♥',  size: 28, value: 1,  weight: 60, color: '#ff9bbe' },
    { glyph: '✿',  size: 32, value: 2,  weight: 25, color: '#d8b6c5' },
    { glyph: '✦',  size: 26, value: 3,  weight: 12, color: '#ffd884' },
    { glyph: 'Như', size: 36, value: 10, weight: 3,  color: '#fff', rare: true },
];

function pickItem() {
    const total = ITEM_TYPES.reduce((s, t) => s + t.weight, 0);
    let r = Math.random() * total;
    for (const t of ITEM_TYPES) { r -= t.weight; if (r <= 0) return t; }
    return ITEM_TYPES[0];
}

export class HeartCatcher {
    constructor({ stage, stats }) {
        this.stage = stage;
        this.stats = stats;

        this.items   = [];
        this.score   = 0;
        this.misses  = 0;
        this.streak  = 0;
        this.multi   = 1;
        this.elapsed = 0;
        this.spawnAccum = 0;
        this._running = false;

        this.high = Number(localStorage.getItem(STORAGE_KEY) || 0);
    }

    start() {
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'game-canvas';
        this.stage.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.overlay = document.createElement('div');
        this.overlay.className = 'game-overlay';
        this.stage.appendChild(this.overlay);

        this._resize();
        this._onResize = () => this._resize();
        window.addEventListener('resize', this._onResize);

        this.mouseX = this.W / 2;
        this._onMouseMove = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = Math.max(0, Math.min(this.W, e.clientX - rect.left));
        };
        this.canvas.addEventListener('mousemove', this._onMouseMove);

        this.stats.innerHTML = `
            <div><span class="stat-key">Điểm:</span><span class="stat-val" data-k="score">0</span></div>
            <div><span class="stat-key">Hụt:</span><span class="stat-val" data-k="misses">0/3</span></div>
            <div><span class="stat-key">High:</span><span class="stat-val" data-k="high">${this.high}</span></div>
            <span class="stat-multi" data-k="multi" hidden>x1</span>
        `;
        this._scoreEl  = this.stats.querySelector('[data-k="score"]');
        this._missEl   = this.stats.querySelector('[data-k="misses"]');
        this._highEl   = this.stats.querySelector('[data-k="high"]');
        this._multiEl  = this.stats.querySelector('[data-k="multi"]');

        this._running = true;
        this._lastT = performance.now();
        requestAnimationFrame((t) => this._tick(t));
    }

    stop() {
        this._running = false;
        window.removeEventListener('resize', this._onResize);
        this.canvas?.removeEventListener('mousemove', this._onMouseMove);
        this.canvas?.remove();
        this.overlay?.remove();
        this.stats.innerHTML = '';
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

    _spawnRate() {
        // Spawn interval shortens over time, capped.
        const base = 1100;
        return Math.max(380, base - this.elapsed * 0.025);
    }

    _itemFallSpeed() {
        return 1.4 + this.elapsed * 0.00012;
    }

    _spawnItem() {
        const type = pickItem();
        this.items.push({
            x: 30 + Math.random() * (this.W - 60),
            y: -type.size,
            vy: this._itemFallSpeed() * (0.85 + Math.random() * 0.4),
            type,
            wobble: Math.random() * Math.PI * 2,
        });
    }

    _updateMulti() {
        let multi = 1;
        if      (this.streak >= 25) multi = 4;
        else if (this.streak >= 15) multi = 3;
        else if (this.streak >= 7)  multi = 2;
        this.multi = multi;
        if (multi > 1) {
            this._multiEl.textContent = `x${multi}`;
            this._multiEl.hidden = false;
        } else {
            this._multiEl.hidden = true;
        }
    }

    _gameOver() {
        if (this.score > this.high) {
            this.high = this.score;
            localStorage.setItem(STORAGE_KEY, String(this.high));
        }
        this._running = false;
        const isNewHigh = this.score === this.high && this.score > 0;
        this.overlay.innerHTML = `
            <div class="game-overlay-card">
                <div class="game-overlay-title">${isNewHigh ? 'High score mới! 🎉' : 'Hết lượt rồi'}</div>
                <div class="game-overlay-body">
                    Điểm: <strong>${this.score}</strong><br/>
                    Best: <strong>${this.high}</strong>
                </div>
                <button class="game-overlay-btn" data-act="retry">Chơi lại</button>
            </div>
        `;
        this.overlay.classList.add('show');
        this.overlay.querySelector('[data-act="retry"]').addEventListener('click', () => this._restart());
    }

    _restart() {
        this.items.length = 0;
        this.score   = 0;
        this.misses  = 0;
        this.streak  = 0;
        this.multi   = 1;
        this.elapsed = 0;
        this.spawnAccum = 0;
        this._scoreEl.textContent = '0';
        this._missEl.textContent  = '0/3';
        this._multiEl.hidden = true;
        this.overlay.classList.remove('show');
        this.overlay.innerHTML = '';
        this._running = true;
        this._lastT = performance.now();
        requestAnimationFrame((t) => this._tick(t));
    }

    _tick(t) {
        if (!this._running) return;
        const dt = Math.min(t - this._lastT, 50);
        this._lastT = t;
        const k = dt / 16.66;
        this.elapsed += dt;

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.W, this.H);

        // Spawn loop.
        this.spawnAccum += dt;
        if (this.spawnAccum >= this._spawnRate()) {
            this.spawnAccum = 0;
            this._spawnItem();
        }

        // Paddle position.
        const paddleW = 110;
        const paddleH = 18;
        const paddleY = this.H - 50;
        const paddleX = Math.max(paddleW / 2, Math.min(this.W - paddleW / 2, this.mouseX));

        // Update items.
        for (let i = this.items.length - 1; i >= 0; i--) {
            const it = this.items[i];
            it.wobble += 0.04 * k;
            it.y  += it.vy * k;
            it.x  += Math.sin(it.wobble) * 0.4 * k;

            // Caught?
            if (
                it.y + it.type.size * 0.5 >= paddleY &&
                it.y - it.type.size * 0.5 <= paddleY + paddleH &&
                it.x >= paddleX - paddleW / 2 &&
                it.x <= paddleX + paddleW / 2
            ) {
                this.streak += 1;
                this._updateMulti();
                this.score += it.type.value * this.multi;
                this._scoreEl.textContent = this.score;
                this.items.splice(i, 1);
                continue;
            }

            // Missed?
            if (it.y - it.type.size > this.H) {
                this.streak = 0;
                this._updateMulti();
                this.misses += 1;
                this._missEl.textContent = `${this.misses}/3`;
                this.items.splice(i, 1);
                if (this.misses >= 3) {
                    this._drawPaddle(ctx, paddleX, paddleY, paddleW, paddleH);
                    this._gameOver();
                    return;
                }
                continue;
            }

            // Draw item.
            ctx.font = `${it.type.size}px 'Cormorant Garamond', serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = it.type.color;
            ctx.shadowColor = it.type.color;
            ctx.shadowBlur = it.type.rare ? 18 : 8;
            ctx.fillText(it.type.glyph, it.x, it.y);
            ctx.shadowBlur = 0;
        }

        // Draw paddle.
        this._drawPaddle(ctx, paddleX, paddleY, paddleW, paddleH);

        requestAnimationFrame((t) => this._tick(t));
    }

    _drawPaddle(ctx, x, y, w, h) {
        const grad = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        grad.addColorStop(0,   'rgba(255, 155, 190, 0.4)');
        grad.addColorStop(0.5, 'rgba(255, 155, 190, 1.0)');
        grad.addColorStop(1,   'rgba(255, 155, 190, 0.4)');
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(255, 155, 190, 0.7)';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y, w, h, h / 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}
