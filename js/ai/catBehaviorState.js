// Emotional state machine for the Space Cat companion.
//
// The interaction layer feeds this with discrete events (pet, hold, drag, fast
// cursor, idle cursor, celebrate). It keeps four 0..1 mood scalars and lerps
// between them, then derives a single named state ('curious' · 'sleepy' ·
// 'affectionate' · 'playful' · 'calm') for the visual layer to react to.
//
// Decay rates are tuned so that, with no input, the cat slowly grows sleepy
// rather than excited — calm by default, expressive when engaged.

const STATES = ['curious', 'sleepy', 'affectionate', 'playful', 'calm'];

const DECAY = {
    affection:  0.018,   // warmth fades over ~minutes
    curiosity:  0.030,   // boredom sets in faster
    attention:  0.45,    // attention is reactive — drops within seconds
    sleepiness: 0.012,   // grows slowly while idle
};

export class CatBehaviorState {
    constructor() {
        this.affection  = 0.30;
        this.curiosity  = 0.45;
        this.sleepiness = 0.05;
        this.attention  = 0.00;

        this.state = 'calm';
        this._stateHold = 0;
        this._holdLock = 0;     // minimum seconds before the next transition

        this._listeners = new Set();
    }

    onChange(fn) {
        this._listeners.add(fn);
        return () => this._listeners.delete(fn);
    }

    // ── event feeds ────────────────────────────────────────────────────────
    // Each feed is meant to be cheap and idempotent so the interaction layer
    // can call it from raw input handlers without buffering.

    feedPet() {
        this.affection  = Math.min(1, this.affection + 0.22);
        this.attention  = Math.min(1, this.attention + 0.6);
        this.sleepiness = Math.max(0, this.sleepiness - 0.15);
    }

    feedCursorNear(speed01) {
        // speed01 — normalized cursor speed in [0,1]. Slow → curiosity bump,
        // fast → startled (curiosity + attention spike but no affection).
        this.attention = Math.min(1, this.attention + 0.05 + speed01 * 0.25);
        this.curiosity = Math.min(1, this.curiosity + 0.04 + speed01 * 0.10);
        if (speed01 > 0.7) this.sleepiness = Math.max(0, this.sleepiness - 0.05);
    }

    feedCursorIdle() {
        // Cursor sits still on screen — cat will drift over to investigate.
        this.curiosity  = Math.min(1, this.curiosity + 0.002);
    }

    feedHold(dt) {
        // The pointer is being held on the cat — nudges toward sleep.
        this.affection  = Math.min(1, this.affection + dt * 0.30);
        this.sleepiness = Math.min(1, this.sleepiness + dt * 0.40);
        this.attention  = Math.max(0, this.attention - dt * 0.4);
    }

    feedDragRelease() {
        // After a throw — playful spike, settle quickly.
        this.curiosity = Math.min(1, this.curiosity + 0.20);
        this.attention = Math.min(1, this.attention + 0.50);
    }

    feedCelebrate() {
        this.affection  = Math.min(1, this.affection + 0.5);
        this.attention  = 1.0;
        this.curiosity  = Math.min(1, this.curiosity + 0.4);
        this.sleepiness = 0;
        this._setState('playful', 4.0);
    }

    feedIgnored() {
        this.curiosity = Math.max(0, this.curiosity - 0.05);
    }

    // ── per-frame tick ─────────────────────────────────────────────────────

    update(dt) {
        this.affection  = clamp01(this.affection  - dt * DECAY.affection);
        this.curiosity  = clamp01(this.curiosity  - dt * DECAY.curiosity);
        this.attention  = clamp01(this.attention  - dt * DECAY.attention);
        this.sleepiness = clamp01(this.sleepiness + dt * DECAY.sleepiness);

        this._stateHold += dt;
        this._holdLock = Math.max(0, this._holdLock - dt);
        if (this._holdLock > 0) return;

        const next = this._pickState();
        if (next !== this.state) this._setState(next);
    }

    _pickState() {
        // Threshold cascade with hysteresis built in via _holdLock.
        if (this.sleepiness > 0.75)                          return 'sleepy';
        if (this.affection  > 0.65 && this.attention > 0.25) return 'affectionate';
        if (this.attention  > 0.65 && this.curiosity > 0.45) return 'playful';
        if (this.curiosity  > 0.55)                          return 'curious';
        return 'calm';
    }

    _setState(next, lock = 1.0) {
        if (!STATES.includes(next)) return;
        this.state = next;
        this._stateHold = 0;
        this._holdLock = lock;
        for (const fn of this._listeners) {
            try { fn(next, this); } catch (_) { /* listener guard */ }
        }
    }

    // ── debug snapshot, useful for tuning ──────────────────────────────────
    snapshot() {
        return {
            state:      this.state,
            affection:  +this.affection.toFixed(2),
            curiosity:  +this.curiosity.toFixed(2),
            sleepiness: +this.sleepiness.toFixed(2),
            attention:  +this.attention.toFixed(2),
        };
    }
}

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
