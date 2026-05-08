// Web Audio synthesis for the Space Cat — meows, purr, snore, celebration.
//
// Shares the AudioContext owned by AudioFX so the browser only has one audio
// graph alive, but routes everything through its own gain bus so the user
// can mute the cat independently of the music box and gesture cues. If no
// context is provided we lazily create one on first use.

export class CatAudio {
    constructor({ ctx = null, master = null, volume = 0.5 } = {}) {
        this.ctx = ctx;
        this._extMaster = master;
        this._volume = volume;

        this.bus = null;
        this.purr = null;        // { osc, lfo, gain }
        this.snore = null;
        this._lastMeow = 0;
    }

    // Either re-use AudioFX's context or stand one up. Safe to call repeatedly.
    // Pass { ctx, master } to share AudioFX's graph; the cat's bus then routes
    // through that master gain so it inherits the global mute.
    async unlock({ ctx = null, master = null } = {}) {
        if (ctx) this.ctx = ctx;
        if (master) this._extMaster = master;
        if (!this.ctx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new Ctx();
        }
        if (this.ctx.state === 'suspended') await this.ctx.resume();
        if (!this.bus) {
            this.bus = this.ctx.createGain();
            this.bus.gain.value = this._volume;
            this.bus.connect(this._extMaster ?? this.ctx.destination);
        }
    }

    setVolume(v) {
        this._volume = Math.max(0, Math.min(1, v));
        if (this.bus) this.bus.gain.value = this._volume;
    }

    // ── meow synthesis ─────────────────────────────────────────────────────
    // A meow is a vowel-like glide: pitch sweeps up then down, formant filter
    // shapes the body. Different "types" tweak the glide, vibrato and decay.

    meow(type = 'happy') {
        if (!this.ctx || !this.bus) return;
        const now = performance.now();
        if (now - this._lastMeow < 140) return;       // throttle
        this._lastMeow = now;

        const presets = {
            happy:   { f0: 540, f1: 760, f2: 480, attack: 0.04, hold: 0.10, release: 0.32, vibrato: 6.0,  vibratoAmt: 8 },
            curious: { f0: 460, f1: 720, f2: 600, attack: 0.06, hold: 0.04, release: 0.40, vibrato: 4.0,  vibratoAmt: 14 },
            sleepy:  { f0: 320, f1: 380, f2: 260, attack: 0.10, hold: 0.16, release: 0.55, vibrato: 3.5,  vibratoAmt: 6 },
            chirp:   { f0: 720, f1: 980, f2: 820, attack: 0.01, hold: 0.04, release: 0.16, vibrato: 12.0, vibratoAmt: 30 },
            yowl:    { f0: 380, f1: 640, f2: 280, attack: 0.05, hold: 0.34, release: 0.55, vibrato: 5.5,  vibratoAmt: 22 },
        };
        const p = presets[type] ?? presets.happy;
        const t0 = this.ctx.currentTime;

        // Carrier: triangle for body warmth.
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';

        // Vibrato.
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = p.vibrato;
        lfoGain.gain.value  = p.vibratoAmt;
        lfo.connect(lfoGain).connect(osc.frequency);

        // Pitch envelope: f0 → f1 (rising) → f2 (falling).
        const total = p.attack + p.hold + p.release;
        osc.frequency.setValueAtTime(p.f0, t0);
        osc.frequency.exponentialRampToValueAtTime(p.f1, t0 + p.attack);
        osc.frequency.exponentialRampToValueAtTime(p.f2, t0 + p.attack + p.hold + p.release);

        // Body filter — vowel-ish bandpass, slowly opens.
        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 4.5;
        bp.frequency.setValueAtTime(p.f0 * 1.6, t0);
        bp.frequency.exponentialRampToValueAtTime(p.f1 * 1.8, t0 + p.attack);
        bp.frequency.exponentialRampToValueAtTime(p.f2 * 1.4, t0 + total);

        // ADSR amp.
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.36, t0 + p.attack);
        g.gain.linearRampToValueAtTime(0.30, t0 + p.attack + p.hold);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + total);

        osc.connect(bp).connect(g).connect(this.bus);
        osc.start(t0);
        lfo.start(t0);
        osc.stop(t0 + total + 0.05);
        lfo.stop(t0 + total + 0.05);

        // Subtle breath layer for "happy" / "chirp" — a touch of filtered noise.
        if (type === 'happy' || type === 'chirp') {
            this._breath(t0, p.attack + p.hold + p.release * 0.6);
        }
    }

    _breath(t0, duration) {
        const len = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
            d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const hp = this.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 1800;
        const g = this.ctx.createGain();
        g.gain.value = 0.06;
        src.connect(hp).connect(g).connect(this.bus);
        src.start(t0);
        src.stop(t0 + duration + 0.02);
    }

    // ── purr loop ──────────────────────────────────────────────────────────
    // Low rumble (≈30Hz) lightly amp-modulated by a 22Hz LFO. Filtered to take
    // the buzz off. start() + stop() control its own gain envelope so callers
    // don't pop it on and off.

    startPurr() {
        if (!this.ctx || !this.bus) return;
        if (this.purr) return;

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 30;

        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 220;
        lp.Q.value = 1.0;

        const trem = this.ctx.createOscillator();
        trem.type = 'sine';
        trem.frequency.value = 22;
        const tremG = this.ctx.createGain();
        tremG.gain.value = 0.5;
        const offset = this.ctx.createConstantSource();
        offset.offset.value = 0.5;

        const amp = this.ctx.createGain();
        amp.gain.value = 0.0001;

        trem.connect(tremG).connect(amp.gain);
        offset.connect(amp.gain);
        osc.connect(lp).connect(amp).connect(this.bus);

        amp.gain.exponentialRampToValueAtTime(0.18, t + 0.4);

        osc.start(t);
        trem.start(t);
        offset.start(t);

        this.purr = { osc, lp, trem, tremG, offset, amp };
    }

    stopPurr() {
        if (!this.purr || !this.ctx) return;
        const { osc, trem, offset, amp } = this.purr;
        const t = this.ctx.currentTime;
        amp.gain.cancelScheduledValues(t);
        amp.gain.setValueAtTime(amp.gain.value, t);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        osc.stop(t + 0.45);
        trem.stop(t + 0.45);
        offset.stop(t + 0.45);
        this.purr = null;
    }

    // ── snore loop ─────────────────────────────────────────────────────────
    // A breathy filter sweep that rises and falls slowly. Built from filtered
    // noise + a slow LFO on the cutoff frequency.

    startSnore() {
        if (!this.ctx || !this.bus) return;
        if (this.snore) return;

        const t = this.ctx.currentTime;

        // Continuous breath noise.
        const len = this.ctx.sampleRate * 2.0;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;

        const bp = this.ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.value = 0.9;
        bp.frequency.value = 320;

        // LFO on cutoff for inhale/exhale shape (~0.2 Hz → 5s cycle).
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.2;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 220;
        lfo.connect(lfoGain).connect(bp.frequency);

        const amp = this.ctx.createGain();
        amp.gain.value = 0.0001;

        src.connect(bp).connect(amp).connect(this.bus);
        amp.gain.exponentialRampToValueAtTime(0.10, t + 0.6);

        // Tremor amp at LFO rate so volume also breathes.
        const tremor = this.ctx.createOscillator();
        tremor.frequency.value = 0.2;
        const tremorGain = this.ctx.createGain();
        tremorGain.gain.value = 0.05;
        tremor.connect(tremorGain).connect(amp.gain);

        src.start(t);
        lfo.start(t);
        tremor.start(t);

        this.snore = { src, bp, lfo, lfoGain, tremor, tremorGain, amp };
    }

    stopSnore() {
        if (!this.snore || !this.ctx) return;
        const { src, lfo, tremor, amp } = this.snore;
        const t = this.ctx.currentTime;
        amp.gain.cancelScheduledValues(t);
        amp.gain.setValueAtTime(amp.gain.value, t);
        amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
        src.stop(t + 0.55);
        lfo.stop(t + 0.55);
        tremor.stop(t + 0.55);
        this.snore = null;
    }

    // ── celebration chime — soft C major arpeggio ─────────────────────────
    chime() {
        if (!this.ctx || !this.bus) return;
        const t0 = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50];   // C5 E5 G5 C6
        notes.forEach((f, i) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = f;
            const harm = this.ctx.createOscillator();
            harm.type = 'sine';
            harm.frequency.value = f * 2;
            const g = this.ctx.createGain();
            const start = t0 + i * 0.10;
            g.gain.setValueAtTime(0.0001, start);
            g.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, start + 1.4);
            const gh = this.ctx.createGain();
            gh.gain.setValueAtTime(0.0001, start);
            gh.gain.exponentialRampToValueAtTime(0.06, start + 0.02);
            gh.gain.exponentialRampToValueAtTime(0.0001, start + 1.0);
            osc.connect(g).connect(this.bus);
            harm.connect(gh).connect(this.bus);
            osc.start(start);
            harm.start(start);
            osc.stop(start + 1.5);
            harm.stop(start + 1.1);
        });
    }
}
