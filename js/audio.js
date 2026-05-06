// Lightweight Web Audio sound design — synthesised, no asset downloads.

export class AudioFX {
    constructor() {
        this.ctx = null;
        this.master = null;
        this._lastPlay = 0;
    }

    async unlock() {
        if (!this.ctx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new Ctx();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.35;
            this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') await this.ctx.resume();
    }

    _now() { return this.ctx.currentTime; }

    playGestureCue(gesture) {
        if (!this.ctx) return;
        const now = performance.now();
        if (now - this._lastPlay < 120) return;
        this._lastPlay = now;

        switch (gesture) {
            case 'fist':         this._playEarth(); break;
            case 'open_palm':    this._playShatter(); break;
            case 'peace':        this._playChime([523.25, 659.25, 783.99]); break;
            case 'finger_heart': this._playHeart(); break;
        }
    }

    _envelope(gain, attack, decay, peak = 1) {
        const t = this._now();
        gain.gain.cancelScheduledValues(t);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(peak, t + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }

    _tone(freq, type, attack, decay, peak = 0.4, delay = 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        osc.connect(gain).connect(this.master);
        const start = this._now() + delay;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(peak, start + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
        osc.start(start);
        osc.stop(start + attack + decay + 0.05);
    }

    _playEarth() {
        // Deep cinematic swell.
        this._tone(110, 'sine', 0.25, 1.2, 0.5);
        this._tone(220, 'sine', 0.4, 1.4, 0.25, 0.05);
        this._tone(55,  'sine', 0.6, 1.5, 0.4, 0.1);
    }

    _playShatter() {
        // Glassy noise burst + sparkle.
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.6, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2);
        }
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 2000;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.5;
        noise.connect(filter).connect(gain).connect(this.master);
        noise.start(this._now());

        [1568, 1975, 2349, 3136].forEach((f, i) => {
            this._tone(f, 'sine', 0.005, 0.6 - i * 0.08, 0.18, i * 0.03);
        });
    }

    _playChime(notes) {
        notes.forEach((n, i) => {
            this._tone(n, 'triangle', 0.01, 0.9, 0.32, i * 0.08);
            this._tone(n * 2, 'sine', 0.01, 0.6, 0.12, i * 0.08);
        });
    }

    _playHeart() {
        // Warm major chord, soft attack — feels like a heartbeat into a hug.
        [261.63, 329.63, 392.00, 523.25].forEach((f, i) => {
            this._tone(f, 'sine', 0.08, 1.6, 0.3, i * 0.04);
        });
        // sub thump
        this._tone(82.41, 'sine', 0.02, 0.4, 0.5, 0.05);
        this._tone(82.41, 'sine', 0.02, 0.4, 0.4, 0.45);
    }
}
