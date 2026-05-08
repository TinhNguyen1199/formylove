// Heart Catcher — 5-lane mouse-follow paddle. Items spawn in one of 5 fixed
// lanes inside a narrow central band (~40% of screen width) and fall straight
// down. The paddle follows mouse X, clamped to the band, so the player never
// has to chase items into the corners. 4 item tiers:
// heart (1pt) · petal (2pt) · star (3pt) · "Như" diamond (10pt rare).
// 3 misses → game over. No-miss streak grows a multiplier.

const STORAGE_KEY  = 'heart_catcher_high';
const LANE_COUNT   = 5;
const BAND_FRACTION = 0.40;          // catchable band as a fraction of W
const PADDLE_H     = 18;
const PADDLE_BOTTOM_OFFSET = 50;
const PADDLE_LANE_COVERAGE = 1.7;    // paddle width = laneW * this (clamped)
const PADDLE_W_MIN = 110;
const PADDLE_W_MAX = 200;
// Minimum vertical clearance (px) between two items in the same lane. A new
// spawn is only allowed in a lane whose topmost in-flight item has already
// fallen further than this — guarantees no two hearts ever appear stacked
// or visually overlapping in the same column at the same time.
const LANE_CLEAR_DISTANCE = 180;
// Minimum vertical clearance (px) between ANY two items, regardless of lane.
// Without this, two items in different lanes spawned close in time fall at
// almost the same y and read as a horizontal "row" — even though they're in
// separate columns. A new spawn is held until the most-recently-spawned item
// (the one with the smallest y) has fallen past this threshold, so items
// always appear staggered down the column.
const GLOBAL_STAGGER_DISTANCE = 130;

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
        this.bursts  = [];     // catch-effect particles
        this.score   = 0;
        this.misses  = 0;
        this.streak  = 0;
        this.multi   = 1;
        this.elapsed = 0;
        this.spawnAccum = 0;
        this._lastLane = -1;
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

        // Recompute lane + paddle geometry on every resize so the play area
        // adapts cleanly to window changes mid-game.
        const bandW = this.W * BAND_FRACTION;
        this._bandLeft  = (this.W - bandW) / 2;
        this._bandRight = this._bandLeft + bandW;
        this._laneW     = bandW / LANE_COUNT;
        this._paddleW = Math.max(
            PADDLE_W_MIN,
            Math.min(PADDLE_W_MAX, this._laneW * PADDLE_LANE_COVERAGE),
        );
    }

    _laneCenter(i) {
        return this._bandLeft + (i + 0.5) * this._laneW;
    }

    _spawnRate() {
        // Steady, lively cadence inside the narrow band — items shouldn't
        // pile up but also shouldn't leave dead air.
        const base = 620;
        return Math.max(240, base - this.elapsed * 0.025);
    }

    _itemFallSpeed() {
        return 1.2 + this.elapsed * 0.00012;
    }

    _spawnItem() {
        // Walk all in-flight items once to collect (a) the global topmost y
        // — used for the cross-lane stagger that prevents "horizontal rows"
        // of items at the same height — and (b) the topmost y per lane —
        // used to keep a single column from stacking on itself.
        let globalTopY = Infinity;
        const topY = new Array(LANE_COUNT).fill(Infinity);
        for (const it of this.items) {
            if (it.y < globalTopY) globalTopY = it.y;
            if (it.y < topY[it.lane]) topY[it.lane] = it.y;
        }

        // Hard global stagger gate. Until the most recent spawn (in ANY
        // lane) has fallen past GLOBAL_STAGGER_DISTANCE, no new spawn is
        // allowed anywhere. This is what kills the "hàng ngang" effect.
        if (globalTopY < GLOBAL_STAGGER_DISTANCE) return false;

        // Build the candidate list: lanes whose own topmost item has cleared
        // the (looser) same-lane buffer. Prefer to avoid the immediately
        // previous lane for variety; fall back if that leaves nothing.
        const clearLanes = [];
        const clearNonRepeat = [];
        for (let i = 0; i < LANE_COUNT; i++) {
            if (topY[i] >= LANE_CLEAR_DISTANCE) {
                clearLanes.push(i);
                if (i !== this._lastLane) clearNonRepeat.push(i);
            }
        }

        const pool = clearNonRepeat.length > 0 ? clearNonRepeat : clearLanes;
        if (pool.length === 0) return false;

        const lane = pool[Math.floor(Math.random() * pool.length)];
        this._lastLane = lane;

        const type = pickItem();
        this.items.push({
            lane,
            x: this._laneCenter(lane),
            y: -type.size,
            vy: this._itemFallSpeed() * (0.9 + Math.random() * 0.2),
            type,
        });
        return true;
    }

    _spawnBurst(x, y, color) {
        const n = 8;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
            const speed = 1.2 + Math.random() * 1.4;
            this.bursts.push({
                x, y,
                vx: Math.cos(a) * speed,
                vy: Math.sin(a) * speed - 0.6,
                life: 1,
                color,
            });
        }
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
        this.items.length  = 0;
        this.bursts.length = 0;
        this.score   = 0;
        this.misses  = 0;
        this.streak  = 0;
        this.multi   = 1;
        this.elapsed = 0;
        this.spawnAccum = 0;
        this._lastLane = -1;
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

        // Draw the catch-zone band first so items + paddle render on top.
        this._drawBand(ctx);

        // Spawn loop. When every lane is currently occupied, _spawnItem()
        // returns false and we leave spawnAccum untouched — that way the
        // moment a lane clears on a later frame, the next tick spawns
        // immediately instead of waiting another full interval.
        this.spawnAccum += dt;
        if (this.spawnAccum >= this._spawnRate()) {
            if (this._spawnItem()) this.spawnAccum = 0;
        }

        // Paddle position — mouse X clamped to the band so the paddle can't
        // wander into the dead zones outside the play column.
        const paddleW = this._paddleW;
        const paddleY = this.H - PADDLE_BOTTOM_OFFSET;
        const minX = this._bandLeft  + paddleW / 2;
        const maxX = this._bandRight - paddleW / 2;
        const paddleX = Math.max(minX, Math.min(maxX, this.mouseX));

        // Update items.
        for (let i = this.items.length - 1; i >= 0; i--) {
            const it = this.items[i];
            it.y += it.vy * k;

            // Caught?
            if (
                it.y + it.type.size * 0.5 >= paddleY &&
                it.y - it.type.size * 0.5 <= paddleY + PADDLE_H &&
                it.x >= paddleX - paddleW / 2 &&
                it.x <= paddleX + paddleW / 2
            ) {
                this.streak += 1;
                this._updateMulti();
                this.score += it.type.value * this.multi;
                this._scoreEl.textContent = this.score;
                this._spawnBurst(it.x, paddleY, it.type.color);
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
                    this._drawPaddle(ctx, paddleX, paddleY, paddleW);
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

        // Update + draw catch bursts.
        for (let i = this.bursts.length - 1; i >= 0; i--) {
            const b = this.bursts[i];
            b.x += b.vx * k;
            b.y += b.vy * k;
            b.vy += 0.12 * k;
            b.life -= 0.05 * k;
            if (b.life <= 0) { this.bursts.splice(i, 1); continue; }
            ctx.globalAlpha = Math.max(0, b.life);
            ctx.fillStyle = b.color;
            ctx.beginPath();
            ctx.arc(b.x, b.y, 2.2 + b.life * 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        // Draw paddle on top.
        this._drawPaddle(ctx, paddleX, paddleY, paddleW);

        requestAnimationFrame((t) => this._tick(t));
    }

    _drawBand(ctx) {
        // Soft column gradient — anchors the eye on the play area.
        const grad = ctx.createLinearGradient(this._bandLeft, 0, this._bandRight, 0);
        grad.addColorStop(0,    'rgba(255, 155, 190, 0.00)');
        grad.addColorStop(0.5,  'rgba(255, 155, 190, 0.07)');
        grad.addColorStop(1,    'rgba(255, 155, 190, 0.00)');
        ctx.fillStyle = grad;
        ctx.fillRect(this._bandLeft, 0, this._bandRight - this._bandLeft, this.H);

        // Lane separators — very faint vertical lines so the 5 columns read
        // as a structured grid rather than a uniform band.
        ctx.strokeStyle = 'rgba(255, 155, 190, 0.10)';
        ctx.lineWidth = 1;
        for (let i = 1; i < LANE_COUNT; i++) {
            const x = this._bandLeft + i * this._laneW;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.H);
            ctx.stroke();
        }

        // Soft glow strip along the bottom of the band — invites the eye down
        // to the paddle row.
        const grad2 = ctx.createLinearGradient(0, this.H - 70, 0, this.H);
        grad2.addColorStop(0, 'rgba(255, 155, 190, 0.00)');
        grad2.addColorStop(1, 'rgba(255, 155, 190, 0.10)');
        ctx.fillStyle = grad2;
        ctx.fillRect(this._bandLeft, this.H - 70, this._bandRight - this._bandLeft, 70);
    }

    _drawPaddle(ctx, x, y, w) {
        const grad = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        grad.addColorStop(0,   'rgba(255, 155, 190, 0.4)');
        grad.addColorStop(0.5, 'rgba(255, 155, 190, 1.0)');
        grad.addColorStop(1,   'rgba(255, 155, 190, 0.4)');
        ctx.fillStyle = grad;
        ctx.shadowColor = 'rgba(255, 155, 190, 0.7)';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.roundRect(x - w / 2, y, w, PADDLE_H, PADDLE_H / 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}
