// Celestial indicator — a small sun/moon that arcs across the top of the
// page based on the current hour. Position updates every minute so the page
// "lives with the day": morning shows the sun rising on the left, noon at
// peak, sunset on the right; night swaps to a moon following the same arc.
//
// Renders into a single <div> appended to <body> (no IDs hard-coded into
// index.html). Honours pause()/resume() like the other ambient layers, but
// since it only updates every 60s the cost is negligible.

const SUN_HOUR_START = 6;     // 6:00 → sun appears on left horizon
const SUN_HOUR_END   = 18;    // 18:00 → sun reaches right horizon, swap to moon
const SUN_GLYPH      = "☀";
const MOON_GLYPH     = "🌙";

function computePosition(now = new Date()) {
    const h = now.getHours() + now.getMinutes() / 60;
    let t, isSun;
    if (h >= SUN_HOUR_START && h < SUN_HOUR_END) {
        t = (h - SUN_HOUR_START) / (SUN_HOUR_END - SUN_HOUR_START);
        isSun = true;
    } else {
        // Night arc: 18:00 → 6:00 (12h). Map to t in [0, 1].
        const nightHours = (h - SUN_HOUR_END + 24) % 24;   // 0..12
        t = Math.min(nightHours / 12, 1);
        isSun = false;
    }
    const angle = t * Math.PI;
    // Horizontal: 5vw → 95vw across the arc.
    const xPct = 50 - 45 * Math.cos(angle);
    // Vertical: 110px at horizon → 30px at peak. Negative sin is up.
    const yPx  = 110 - 80 * Math.sin(angle);
    return { xPct, yPx, isSun, t };
}

export class Celestial {
    constructor() {
        this.el = document.createElement('div');
        this.el.id = 'celestial';
        this.el.setAttribute('aria-hidden', 'true');
        // Inner span so the outer translate isn't fighting the inner glow scale.
        this.glyphEl = document.createElement('span');
        this.glyphEl.className = 'celestial-glyph';
        this.el.appendChild(this.glyphEl);
        document.body.appendChild(this.el);

        this._paused = false;
        this._update();
        // Re-position once a minute. Cheap; no rAF needed.
        this._interval = setInterval(() => {
            if (!this._paused) this._update();
        }, 60_000);
    }

    _update() {
        const { xPct, yPx, isSun, t } = computePosition();
        this.el.style.left = `${xPct}vw`;
        this.el.style.top  = `${yPx}px`;
        this.el.dataset.body = isSun ? 'sun' : 'moon';
        this.glyphEl.textContent = isSun ? SUN_GLYPH : MOON_GLYPH;
        // CSS uses --arc-t to fade the body in/out at the horizon edges so
        // the swap between sun and moon doesn't pop. Edge dwell window = 7%.
        const fadeIn  = Math.min(1, t / 0.07);
        const fadeOut = Math.min(1, (1 - t) / 0.07);
        const alpha   = Math.min(fadeIn, fadeOut);
        this.el.style.setProperty('--arc-alpha', alpha.toFixed(3));
    }

    pause()  { this._paused = true;  }
    resume() { this._paused = false; this._update(); }
}
