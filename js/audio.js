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

            // Separate gain bus for the ambient music box so it can fade in/out
            // independently of the gesture cues.
            this.musicBoxGain = this.ctx.createGain();
            this.musicBoxGain.gain.value = 0;
            this.musicBoxGain.connect(this.master);
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
            case 'thumbs_up':    this._playReveal(); break;
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

    _playReveal() {
        // Cinematic reveal — slow pad swell, rising shimmer, warm impact at the
        // moment the heart appears. Timings track LightBeamHeart's phases.
        // Pad swell during gathering (~0.5s..1.5s in scene time)
        [196.00, 293.66, 392.00].forEach((f, i) => {
            this._tone(f, 'sine', 0.5, 2.2, 0.28, i * 0.08);
        });
        // Rising high shimmer as the heart reveals (~1.7s)
        [1318.51, 1567.98, 2093.00].forEach((f, i) => {
            this._tone(f, 'triangle', 0.06, 1.4, 0.12, 1.2 + i * 0.18);
        });
        // Warm bass impact at the pulse moment (~2.7s)
        this._tone(110.00, 'sine', 0.04, 0.7, 0.42, 2.5);
        this._tone(220.00, 'sine', 0.04, 0.7, 0.22, 2.5);
    }

    // ── Ambient music box ───────────────────────────────────────────────────
    // A calm 16-note ostinato in C major, synthesised with a triangle voice
    // plus an octave-up sine for that bell shimmer. Loops indefinitely until
    // stopMusicBox() is called. Routed through musicBoxGain so the volume
    // can fade independently of gesture cues.

    startMusicBox() {
        if (!this.ctx || this._musicBoxRunning) return;
        this._musicBoxRunning = true;

        // Notes in Hz — 16-note ascending/descending arpeggio loop in C major.
        // Soft melodic shape that stays out of the way while still feeling
        // present. Each entry: [frequency, beats].
        const C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46;
        const G5 = 783.99, A5 = 880.00, B5 = 987.77, C6 = 1046.50;
        this._musicBoxMelody = [
            [C5, 1], [E5, 1], [G5, 1], [E5, 1],
            [F5, 1], [A5, 1], [G5, 1], [E5, 1],
            [D5, 1], [F5, 1], [A5, 1], [F5, 1],
            [G5, 1], [B5, 1], [C6, 1], [G5, 1],
        ];
        this._musicBoxBeat = 0.46;   // seconds per beat → ~7.4s loop

        // Fade in over 2.4s for a gentle entrance.
        const t = this._now();
        this.musicBoxGain.gain.cancelScheduledValues(t);
        this.musicBoxGain.gain.setValueAtTime(0.0001, t);
        this.musicBoxGain.gain.linearRampToValueAtTime(1.0, t + 2.4);

        this._scheduleMusicBoxLoop();
    }

    stopMusicBox() {
        if (!this._musicBoxRunning) return;
        this._musicBoxRunning = false;
        if (this._musicBoxTimeout) {
            clearTimeout(this._musicBoxTimeout);
            this._musicBoxTimeout = null;
        }
        // Gentle fade-out so notes already in flight don't cut.
        if (this.musicBoxGain) {
            const t = this._now();
            this.musicBoxGain.gain.cancelScheduledValues(t);
            this.musicBoxGain.gain.setValueAtTime(this.musicBoxGain.gain.value, t);
            this.musicBoxGain.gain.linearRampToValueAtTime(0.0001, t + 1.2);
        }
    }

    _scheduleMusicBoxLoop() {
        if (!this._musicBoxRunning) return;

        let t = 0;
        for (const [freq, beats] of this._musicBoxMelody) {
            this._musicBoxNote(freq, t, beats * this._musicBoxBeat);
            t += beats * this._musicBoxBeat;
        }

        // Schedule the next loop slightly before the current one ends so
        // there's no audible gap.
        this._musicBoxTimeout = setTimeout(
            () => this._scheduleMusicBoxLoop(),
            (t - 0.02) * 1000,
        );
    }

    _musicBoxNote(freq, delay, duration) {
        // Bell-like envelope: instant pluck, gentle decay over `duration`.
        // Triangle voice for body, octave-up sine for shimmer.
        const start = this._now() + delay;
        const peak  = 0.12;

        const osc1 = this.ctx.createOscillator();
        const g1   = this.ctx.createGain();
        osc1.type  = 'triangle';
        osc1.frequency.value = freq;
        osc1.connect(g1).connect(this.musicBoxGain);
        g1.gain.setValueAtTime(0.0001, start);
        g1.gain.exponentialRampToValueAtTime(peak, start + 0.005);
        g1.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc1.start(start);
        osc1.stop(start + duration + 0.05);

        const osc2 = this.ctx.createOscillator();
        const g2   = this.ctx.createGain();
        osc2.type  = 'sine';
        osc2.frequency.value = freq * 2;
        osc2.connect(g2).connect(this.musicBoxGain);
        g2.gain.setValueAtTime(0.0001, start);
        g2.gain.exponentialRampToValueAtTime(peak * 0.35, start + 0.005);
        g2.gain.exponentialRampToValueAtTime(0.0001, start + duration * 0.55);
        osc2.start(start);
        osc2.stop(start + duration + 0.05);
    }
}
