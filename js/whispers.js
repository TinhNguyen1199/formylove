// Whispers — every 30–60s a random short phrase fades in/out at a random
// safe-zone position on the page. Adds an emotional layer on top of the
// ambient events without competing for attention.

export class Whispers {
    constructor({ phrases = [], minDelay = 30_000, maxDelay = 60_000 } = {}) {
        this.phrases  = phrases;
        this.minDelay = minDelay;
        this.maxDelay = maxDelay;
        this._lastIndex = -1;
        if (this.phrases.length > 0) this._scheduleNext();
    }

    stop() {
        if (this._timeout) clearTimeout(this._timeout);
        this._timeout = null;
    }

    pause() {
        if (this._paused) return;
        this._paused = true;
        if (this._timeout) {
            clearTimeout(this._timeout);
            this._timeout = null;
        }
    }

    resume() {
        if (!this._paused) return;
        this._paused = false;
        if (this.phrases.length > 0) this._scheduleNext();
    }

    _scheduleNext() {
        const delay = this.minDelay + Math.random() * (this.maxDelay - this.minDelay);
        this._timeout = setTimeout(() => {
            this._showWhisper();
            this._scheduleNext();
        }, delay);
    }

    _pickIndex() {
        if (this.phrases.length === 1) return 0;
        let i;
        do {
            i = (Math.random() * this.phrases.length) | 0;
        } while (i === this._lastIndex);
        this._lastIndex = i;
        return i;
    }

    _safePosition() {
        // Avoid the corners that hold UI cards (gesture indicator top-left,
        // webcam top-right, legend bottom-left, countdown bottom-right) plus
        // the centre of the screen which is reserved for gesture content.
        // Use a band around the middle vertically and 18%–82% horizontally.
        const W = window.innerWidth;
        const H = window.innerHeight;
        const x = W * (0.18 + Math.random() * 0.64);
        const y = H * (0.22 + Math.random() * 0.56);
        return { x, y };
    }

    _showWhisper() {
        const idx  = this._pickIndex();
        const text = this.phrases[idx];

        const el = document.createElement('div');
        el.className = 'whisper';
        el.textContent = text;
        const { x, y } = this._safePosition();
        el.style.left = `${x}px`;
        el.style.top  = `${y}px`;

        document.body.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
    }
}
