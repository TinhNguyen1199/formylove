// Procedural animation helpers for the 2D Space Cat.
//
// Two concerns:
//   1. easings    — re-usable curves the cat update() blends with
//   2. IdleAction — a tiny scheduler that picks a random idle action every
//                   4–8s (blink / twitch / swish / yawn / stretch / groom /
//                   look / chase) and exposes a 0..1 progress value
//
// (The Three.js TailSolver previously here is gone with the 3D rewrite — the
// 2D tail uses a CSS keyframe sway, which is plenty for a flat silhouette.)

// ───────────────────────────────────────────────────────────────────────────
//  Easings
// ───────────────────────────────────────────────────────────────────────────
export const ease = {
    inOutSine:  (t) => 0.5 - 0.5 * Math.cos(Math.PI * t),
    outBack:    (t) => { const c = 1.70158 + 1; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    outElastic: (t) => {
        if (t === 0 || t === 1) return t;
        const p = 0.4;
        return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
    },
    pulse:      (t) => Math.sin(Math.PI * Math.min(Math.max(t, 0), 1)),
};

// ───────────────────────────────────────────────────────────────────────────
//  IdleAction — random scheduler with smooth blending between actions.
// ───────────────────────────────────────────────────────────────────────────
const IDLE_ACTIONS = [
    // Slower blink (~0.55s) sells the "slow blinking trust" gesture cats use.
    { name: 'blink',    weight: 4, duration: 0.55 },
    { name: 'twitch',   weight: 3, duration: 0.55 },
    { name: 'swish',    weight: 3, duration: 1.40 },
    { name: 'look',     weight: 3, duration: 1.60 },
    { name: 'yawn',     weight: 2, duration: 1.80 },
    { name: 'stretch',  weight: 2, duration: 2.00 },
    { name: 'groom',    weight: 2, duration: 2.60 },
    { name: 'chase',    weight: 1, duration: 1.30 },
];

export class IdleScheduler {
    constructor() {
        this._cooldown = 2.0 + Math.random() * 3.0;
        this.action = null;        // { name, duration, t } | null
    }

    update(dt, weightsByMood = null) {
        if (this.action) {
            this.action.t += dt;
            if (this.action.t >= this.action.duration) {
                this.action = null;
                // 4–8 s rest between idle actions — long enough that the cat
                // feels still + alive rather than constantly fidgeting.
                this._cooldown = 4.0 + Math.random() * 4.0;
            }
            return;
        }
        this._cooldown -= dt;
        if (this._cooldown <= 0) this._pick(weightsByMood);
    }

    progress() {
        return this.action ? Math.min(1, this.action.t / this.action.duration) : 0;
    }

    is(name) { return this.action?.name === name; }

    forceAction(name, duration = null) {
        const def = IDLE_ACTIONS.find((a) => a.name === name);
        if (!def) return;
        this.action = { name, duration: duration ?? def.duration, t: 0 };
    }

    _pick(weightsByMood) {
        // weightsByMood is an optional { name: multiplier } map so behavior
        // state can bias which actions fire (e.g. sleepy → more blinks/yawns).
        let total = 0;
        for (const a of IDLE_ACTIONS) {
            const w = a.weight * (weightsByMood?.[a.name] ?? 1);
            total += w;
        }
        let pick = Math.random() * total;
        for (const a of IDLE_ACTIONS) {
            const w = a.weight * (weightsByMood?.[a.name] ?? 1);
            pick -= w;
            if (pick <= 0) {
                this.action = { name: a.name, duration: a.duration, t: 0 };
                return;
            }
        }
    }
}

// Mood-keyed bias for the IdleScheduler — passed through update().
export const IDLE_BIAS = {
    sleepy:       { yawn: 4, blink: 3, stretch: 2, swish: 0.4, chase: 0.0, twitch: 0.5 },
    curious:      { look: 3, twitch: 2, chase: 2, yawn: 0.4, groom: 0.5 },
    playful:      { swish: 3, chase: 4, twitch: 2, look: 1.5, yawn: 0.2 },
    affectionate: { groom: 3, blink: 2, swish: 1.5, yawn: 0.6 },
    calm:         { blink: 2, swish: 1.2, look: 1, twitch: 1, groom: 1, yawn: 1, stretch: 1, chase: 0.6 },
};
