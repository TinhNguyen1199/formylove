// Cursor magnet — a foreground sparkle dust layer that drifts gently and
// leans toward the cursor when it's nearby. Plus a click handler that spawns
// floating hearts at the click point.
//
// Pure 2D canvas + DOM, independent of the Three.js pipeline. Sits between
// the 3D scene canvas and the UI cards via z-index.

const HEART_GLYPHS = ['💗', '💖', '💕', '❤️', '💞'];

export class CursorMagnet {
    constructor({ count = 42 } = {}) {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'cursor-magnet';
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.particles = [];
        this.mouseX = window.innerWidth  / 2;
        this.mouseY = window.innerHeight / 2;
        this._hasMoved = false;

        for (let i = 0; i < count; i++) {
            this.particles.push({
                x:  Math.random() * window.innerWidth,
                y:  Math.random() * window.innerHeight,
                vx: (Math.random() - 0.5) * 0.35,
                vy: (Math.random() - 0.5) * 0.35,
                size:      0.9 + Math.random() * 1.8,
                baseAlpha: 0.18 + Math.random() * 0.30,
                phase:     Math.random() * Math.PI * 2,
            });
        }

        this._resize();
        window.addEventListener('resize', () => this._resize());
        window.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
            this._hasMoved = true;
        }, { passive: true });
        window.addEventListener('mouseleave', () => { this._hasMoved = false; });

        // Click → tiny heart burst at the click point. Listens at the document
        // level so clicks land regardless of which UI element is on top.
        document.addEventListener('click', (e) => this._spawnHearts(e.clientX, e.clientY));

        this._lastT = performance.now();
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
        // Clear once so leftover sparkles aren't frozen on screen.
        this.ctx?.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }

    clear() {
        this.ctx?.clearRect(0, 0, window.innerWidth, window.innerHeight);
        document.querySelectorAll('.click-heart').forEach((el) => el.remove());
    }

    resume() {
        if (!this._paused) return;
        this._paused = false;
        this._lastT = performance.now();
    }

    _tick(t) {
        if (this._paused) {
            // Keep the rAF chain alive so resume is instant; just skip work.
            this._lastT = t;
            requestAnimationFrame((tt) => this._tick(tt));
            return;
        }

        const dt = Math.min(t - this._lastT, 50);
        this._lastT = t;
        const k = dt / 16.66;

        const ctx = this.ctx;
        const W = window.innerWidth;
        const H = window.innerHeight;
        ctx.clearRect(0, 0, W, H);

        const MAGNET_RADIUS   = 200;
        const MAGNET_STRENGTH = 0.045;

        for (const p of this.particles) {
            // Magnet pull (only when cursor is on screen)
            let extra = 1;
            if (this._hasMoved) {
                const dx = this.mouseX - p.x;
                const dy = this.mouseY - p.y;
                const dist = Math.hypot(dx, dy);
                if (dist < MAGNET_RADIUS) {
                    const t01 = 1 - dist / MAGNET_RADIUS;
                    const pull = t01 * MAGNET_STRENGTH;
                    p.vx += dx * pull * 0.05;
                    p.vy += dy * pull * 0.05;
                    extra = 1 + t01 * 1.6;       // brighten + grow
                }
            }

            // Velocity damping + integrate
            p.vx *= Math.pow(0.94, k);
            p.vy *= Math.pow(0.94, k);
            p.x  += p.vx * k;
            p.y  += p.vy * k;

            // Wrap around edges so particles always cover the screen
            if (p.x < -10) p.x = W + 10;
            if (p.x > W + 10) p.x = -10;
            if (p.y < -10) p.y = H + 10;
            if (p.y > H + 10) p.y = -10;

            // Twinkle
            p.phase += 0.04 * k;
            const twinkle = 0.55 + 0.45 * Math.sin(p.phase);
            const alpha   = Math.min(0.9, p.baseAlpha * twinkle * extra);
            const radius  = p.size * extra;

            // Soft glow disc
            ctx.fillStyle = `rgba(255, 220, 235, ${alpha})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        requestAnimationFrame((t) => this._tick(t));
    }

    _spawnHearts(x, y) {
        const count = 4 + Math.floor(Math.random() * 2);
        for (let i = 0; i < count; i++) {
            const heart = document.createElement('span');
            heart.className = 'click-heart';
            heart.textContent = HEART_GLYPHS[(Math.random() * HEART_GLYPHS.length) | 0];
            heart.style.left = `${x}px`;
            heart.style.top  = `${y}px`;
            heart.style.setProperty('--dx',    `${(Math.random() - 0.5) * 90}px`);
            heart.style.setProperty('--dy',    `${-90 - Math.random() * 70}px`);
            heart.style.setProperty('--rot',   `${(Math.random() - 0.5) * 50}deg`);
            heart.style.setProperty('--delay', `${i * 60}ms`);
            heart.style.setProperty('--size',  `${0.85 + Math.random() * 0.4}`);
            document.body.appendChild(heart);
            heart.addEventListener('animationend', () => heart.remove());
        }
    }
}
