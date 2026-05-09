// Heat aura — a soft warm glow that follows the cursor with a touch of lag,
// blended additively so anything underneath looks lit. As a bonus, whisper
// elements caught inside the aura get a 'whisper--warm' class that brightens
// and slightly enlarges them, so the cursor literally illuminates them.
//
// No effect on the Three.js scene shaders — this is a CSS-only overlay. If
// you want particles to react too, hook into the same mouseX/mouseY in a
// scene-side uniform later.

const RADIUS_PX        = 110;     // visual radius of the heat aura
const HIGHLIGHT_REACH  = 130;     // radius for whisper highlight detection
const FOLLOW_LERP      = 0.18;    // fraction of remaining distance per frame

export class HeatAura {
    constructor() {
        this.el = document.createElement('div');
        this.el.id = 'heat-aura';
        this.el.style.width  = (RADIUS_PX * 2) + 'px';
        this.el.style.height = (RADIUS_PX * 2) + 'px';
        document.body.appendChild(this.el);

        this.x = window.innerWidth  / 2;
        this.y = window.innerHeight / 2;
        this.targetX = this.x;
        this.targetY = this.y;
        this._hasMoved = false;
        this._warmedWhispers = new Set();

        window.addEventListener('mousemove', (e) => {
            this.targetX = e.clientX;
            this.targetY = e.clientY;
            this._hasMoved = true;
        }, { passive: true });
        window.addEventListener('mouseleave', () => { this._hasMoved = false; });

        requestAnimationFrame(() => this._tick());
    }

    pause() {
        if (this._paused) return;
        this._paused = true;
        this.el.style.opacity = '0';
        // Drop any 'warm' classes we set so paused state isn't sticky.
        for (const w of this._warmedWhispers) w.classList.remove('whisper--warm');
        this._warmedWhispers.clear();
    }

    resume() {
        if (!this._paused) return;
        this._paused = false;
    }

    _tick() {
        if (this._paused) {
            requestAnimationFrame(() => this._tick());
            return;
        }

        // Smooth follow — lerp current position toward cursor each frame.
        this.x += (this.targetX - this.x) * FOLLOW_LERP;
        this.y += (this.targetY - this.y) * FOLLOW_LERP;

        const offsetX = this.x - RADIUS_PX;
        const offsetY = this.y - RADIUS_PX;
        this.el.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
        this.el.style.opacity = this._hasMoved ? '1' : '0';

        // Highlight whispers under the aura. Whispers come and go (~1 at a
        // time), so a fresh querySelectorAll each frame is cheap.
        const whispers = document.querySelectorAll('.whisper');
        const stillWarm = new Set();
        for (const w of whispers) {
            const rect = w.getBoundingClientRect();
            const cx = rect.left + rect.width  / 2;
            const cy = rect.top  + rect.height / 2;
            const dist = Math.hypot(this.x - cx, this.y - cy);
            if (dist < HIGHLIGHT_REACH) {
                if (!this._warmedWhispers.has(w)) w.classList.add('whisper--warm');
                stillWarm.add(w);
            }
        }
        // Remove the class from any whisper that left the aura (or vanished).
        for (const w of this._warmedWhispers) {
            if (!stillWarm.has(w)) w.classList.remove('whisper--warm');
        }
        this._warmedWhispers = stillWarm;

        requestAnimationFrame(() => this._tick());
    }
}
