// Game audio — synthesised BGM loops + action SFX, no external assets.
// Built on the same AudioContext that AudioFX (audio.js) uses, so volume
// and unlock state are shared. Each game gets its own short looped melody
// + a small set of action SFX called from inside the game's update loop.
//
// Why synthesised instead of MP3 files: the project is no-build / no-asset,
// hotlinking free CDN audio risks CORS + breakage. Web Audio is free,
// guaranteed CORS-safe, instant to load, and licensing-clear forever.

const SEMITONE = Math.pow(2, 1 / 12);
// Tiny helper: shift a frequency by N semitones for arpeggios / variations.
function shift(freq, semitones) {
    return freq * Math.pow(SEMITONE, semitones);
}

// Per-game BGM definitions. Each is {melody, beatSec, voice} where melody is
// a list of [freq, beats] notes (rest = freq=0). Loops indefinitely until
// stopBGM is called.
const BGM = {
    // Bubble Pop — bouncy C-major pentatonic, fast bouncy tempo.
    bubble: {
        beatSec: 0.28,
        voice: 'triangle',
        peak: 0.16,
        melody: [
            [523.25, 1], [659.25, 1], [783.99, 1], [659.25, 1],
            [880.00, 1], [783.99, 1], [659.25, 1], [587.33, 1],
            [659.25, 1], [783.99, 1], [880.00, 1], [987.77, 1],
            [880.00, 1], [783.99, 1], [659.25, 1], [523.25, 1],
        ],
    },
    // Heart Catcher — sweet F-major arpeggios, medium warm tempo.
    catcher: {
        beatSec: 0.32,
        voice: 'sine',
        peak: 0.18,
        melody: [
            [349.23, 1], [440.00, 1], [523.25, 1], [440.00, 1],
            [587.33, 1], [523.25, 1], [440.00, 1], [349.23, 1],
            [392.00, 1], [466.16, 1], [587.33, 1], [466.16, 1],
            [523.25, 1], [466.16, 1], [440.00, 1], [349.23, 1],
        ],
    },
    // Memory Match — gentle slow C-major chord arpeggios. Calmer, less
    // intrusive, good for puzzle focus.
    memory: {
        beatSec: 0.55,
        voice: 'sine',
        peak: 0.14,
        melody: [
            [261.63, 1], [329.63, 1], [392.00, 1], [523.25, 1],
            [523.25, 1], [392.00, 1], [329.63, 1], [261.63, 1],
            [293.66, 1], [349.23, 1], [440.00, 1], [587.33, 1],
            [587.33, 1], [440.00, 1], [349.23, 1], [293.66, 1],
        ],
    },
};

export class GameAudio {
    // `audio` is an AudioFX instance; we reuse its AudioContext + master
    // gain bus so volume scales together with the rest of the page audio.
    constructor(audio) {
        this.audio = audio;
        this._bgmGain = null;
        this._bgmTimer = null;
        this._bgmRunning = false;
        this._currentBgm = null;
    }

    get ctx() { return this.audio?.ctx; }
    get master() { return this.audio?.master; }
    _now() { return this.ctx.currentTime; }

    // ── BGM ──────────────────────────────────────────────────────────────────

    startBGM(name) {
        if (!this.ctx || !BGM[name]) return;
        if (this._currentBgm === name && this._bgmRunning) return;
        this.stopBGM();

        this._currentBgm = name;
        this._bgmRunning = true;

        // Per-BGM gain so we can fade in/out without touching master.
        this._bgmGain = this.ctx.createGain();
        this._bgmGain.gain.value = 0.0001;
        this._bgmGain.connect(this.master);

        const t = this._now();
        this._bgmGain.gain.exponentialRampToValueAtTime(1.0, t + 1.4);

        this._scheduleLoop(BGM[name]);
    }

    stopBGM() {
        if (!this._bgmRunning) return;
        this._bgmRunning = false;
        this._currentBgm = null;
        if (this._bgmTimer) {
            clearTimeout(this._bgmTimer);
            this._bgmTimer = null;
        }
        if (this._bgmGain) {
            const oldGain = this._bgmGain;
            const t = this._now();
            oldGain.gain.cancelScheduledValues(t);
            oldGain.gain.setValueAtTime(oldGain.gain.value, t);
            oldGain.gain.linearRampToValueAtTime(0.0001, t + 0.6);
            // Disconnect after fade-out completes.
            setTimeout(() => oldGain.disconnect(), 800);
            this._bgmGain = null;
        }
    }

    _scheduleLoop(spec) {
        if (!this._bgmRunning || !this._bgmGain) return;
        const { melody, beatSec, voice, peak } = spec;
        let t = 0;
        for (const [freq, beats] of melody) {
            if (freq > 0) this._bgmNote(freq, t, beats * beatSec, voice, peak);
            t += beats * beatSec;
        }
        // Re-schedule the next loop slightly before the current ends so
        // there's no audible gap (matches the AudioFX musicBox pattern).
        this._bgmTimer = setTimeout(
            () => this._scheduleLoop(spec),
            (t - 0.02) * 1000,
        );
    }

    _bgmNote(freq, delay, duration, voice, peak) {
        if (!this._bgmGain) return;
        const start = this._now() + delay;

        // Body voice (triangle/sine).
        const osc1 = this.ctx.createOscillator();
        const g1 = this.ctx.createGain();
        osc1.type = voice;
        osc1.frequency.value = freq;
        osc1.connect(g1).connect(this._bgmGain);
        g1.gain.setValueAtTime(0.0001, start);
        g1.gain.exponentialRampToValueAtTime(peak, start + 0.012);
        g1.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc1.start(start);
        osc1.stop(start + duration + 0.04);

        // Octave-up sine for a touch of bell shimmer.
        const osc2 = this.ctx.createOscillator();
        const g2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 2;
        osc2.connect(g2).connect(this._bgmGain);
        g2.gain.setValueAtTime(0.0001, start);
        g2.gain.exponentialRampToValueAtTime(peak * 0.32, start + 0.008);
        g2.gain.exponentialRampToValueAtTime(0.0001, start + duration * 0.55);
        osc2.start(start);
        osc2.stop(start + duration + 0.04);
    }

    // ── SFX ──────────────────────────────────────────────────────────────────
    // All SFX route through master, NOT _bgmGain — so SFX stay audible if BGM
    // is fading out and they don't disappear when stopBGM is called.

    _tone(freq, voice, attack, decay, peak = 0.3, delay = 0) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = voice;
        osc.frequency.value = freq;
        osc.connect(gain).connect(this.master);
        const start = this._now() + delay;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(peak, start + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
        osc.start(start);
        osc.stop(start + attack + decay + 0.05);
    }

    _toneSweep(fromFreq, toFreq, voice, attack, decay, peak = 0.3) {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = voice;
        osc.frequency.value = fromFreq;
        osc.connect(gain).connect(this.master);
        const start = this._now();
        osc.frequency.exponentialRampToValueAtTime(
            Math.max(20, toFreq), start + attack + decay,
        );
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(peak, start + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
        osc.start(start);
        osc.stop(start + attack + decay + 0.05);
    }

    // Bubble pop — quick descending blip. Pitch bumps up with combo so popping
    // feels rewarding when the streak is hot.
    sfxPop(combo = 1) {
        if (!this.ctx) return;
        const baseFreq = 880 * Math.pow(SEMITONE, Math.min(12, (combo - 1) * 1.5));
        this._toneSweep(baseFreq, baseFreq * 0.5, 'sine', 0.006, 0.12, 0.28);
        // Tiny noise transient for the "pop" body.
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.04, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
        }
        const n = this.ctx.createBufferSource();
        n.buffer = buffer;
        const ng = this.ctx.createGain();
        ng.gain.value = 0.18;
        n.connect(ng).connect(this.master);
        n.start(this._now());
    }

    // Card flip — soft tick (very short noise burst high-passed).
    sfxFlip() {
        if (!this.ctx) return;
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.06, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 4);
        }
        const n = this.ctx.createBufferSource();
        n.buffer = buffer;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'highpass';
        filt.frequency.value = 1800;
        const g = this.ctx.createGain();
        g.gain.value = 0.32;
        n.connect(filt).connect(g).connect(this.master);
        n.start(this._now());
    }

    // Pair matched — happy ascending arpeggio (C–E–G).
    sfxMatch() {
        this._tone(523.25, 'triangle', 0.005, 0.18, 0.30, 0);
        this._tone(659.25, 'triangle', 0.005, 0.20, 0.28, 0.06);
        this._tone(783.99, 'triangle', 0.005, 0.30, 0.30, 0.12);
        // Octave shimmer.
        this._tone(1046.50, 'sine', 0.005, 0.40, 0.10, 0.18);
    }

    // Mismatch / wrong / miss — soft low descending two-tone, no harsh buzzer.
    sfxMiss() {
        this._tone(330, 'sine', 0.01, 0.25, 0.22, 0);
        this._tone(247, 'sine', 0.01, 0.30, 0.20, 0.10);
    }

    // Heart caught — bright twinkle, root + 5th + octave.
    sfxCatch() {
        this._tone(659.25, 'triangle', 0.005, 0.22, 0.28, 0);
        this._tone(987.77, 'sine',     0.005, 0.30, 0.18, 0.04);
        this._tone(1318.51,'sine',     0.005, 0.40, 0.10, 0.08);
    }

    // Heart missed (lost a life) — brief sad descending.
    sfxLifeLost() {
        this._tone(440, 'sine',     0.01, 0.30, 0.28, 0);
        this._tone(392, 'sine',     0.01, 0.35, 0.24, 0.10);
        this._tone(311.13, 'sine',  0.01, 0.45, 0.22, 0.20);
    }

    // Game won / level complete — rising fanfare 4 notes.
    sfxWin() {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((f, i) => {
            this._tone(f, 'triangle', 0.008, 0.6, 0.28, i * 0.10);
            this._tone(f * 2, 'sine', 0.008, 0.6, 0.10, i * 0.10);
        });
    }

    // Game over / no more lives — descending three notes, melancholy but soft.
    sfxGameOver() {
        const notes = [523.25, 415.30, 311.13];
        notes.forEach((f, i) => {
            this._tone(f, 'sine', 0.02, 0.7, 0.30, i * 0.18);
        });
    }
}
