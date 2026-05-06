// Angle-based gesture detection with continuous confidence scoring.
//
// Each finger's "extension" is measured from the bend angle at PIP (or IP for
// thumb): straight finger → angle ~0 → extension ~1; curled → angle ~π → ~0.
// This is far more robust to hand rotation than wrist-distance heuristics —
// the angle is invariant to where the hand is in the frame.
//
// Each gesture is then a smooth product of the conditions it cares about, so
// the result is a soft 0..1 score rather than a hard yes/no. The classifier
// picks the highest-scoring gesture above a threshold; everything else is 'none'.

const FINGER = {
    thumb:  { mcp: 2, pip: 3, tip: 4 },   // for thumb, "pip" is actually IP
    index:  { mcp: 5, pip: 6, tip: 8 },
    middle: { mcp: 9, pip: 10, tip: 12 },
    ring:   { mcp: 13, pip: 14, tip: 16 },
    pinky:  { mcp: 17, pip: 18, tip: 20 },
};

const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: (a.z ?? 0) - (b.z ?? 0) });
const len = (v) => Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (v) => { const l = len(v) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };

function angleBetween(a, b) {
    const d = Math.max(-1, Math.min(1, dot(norm(a), norm(b))));
    return Math.acos(d);
}

// 1.0 = straight, 0.0 = fully curled
function fingerExtension(lm, finger) {
    const v1 = sub(lm[finger.pip], lm[finger.mcp]);
    const v2 = sub(lm[finger.tip], lm[finger.pip]);
    return 1 - angleBetween(v1, v2) / Math.PI;
}

// Distance between thumb tip and index tip, normalised by hand size.
// 1.0 = touching, 0.0 = far apart.
function pinchScore(lm) {
    const handSize = len(sub(lm[0], lm[FINGER.middle.mcp])) || 1;
    const ratio = len(sub(lm[FINGER.thumb.tip], lm[FINGER.index.tip])) / handSize;
    // Tight enough for "touching" only when ratio < ~0.35.
    return Math.max(0, Math.min(1, 1 - ratio / 0.35));
}

// Soft remap so the per-finger score has a sharper transition between
// "extended" and "curled" without becoming binary. Reads as a confident
// signal but still ramps smoothly for live confidence feedback.
const sharpen = (x) => {
    const t = Math.max(0, Math.min(1, (x - 0.30) / 0.55));
    return t * t * (3 - 2 * t);
};

function classify(lm) {
    if (!lm) return { gesture: 'none', confidence: 0, scores: {} };

    const raw = {
        thumb:  fingerExtension(lm, FINGER.thumb),    // IP-joint angle works for thumb too
        index:  fingerExtension(lm, FINGER.index),
        middle: fingerExtension(lm, FINGER.middle),
        ring:   fingerExtension(lm, FINGER.ring),
        pinky:  fingerExtension(lm, FINGER.pinky),
    };
    const ext = {
        thumb:  sharpen(raw.thumb),
        index:  sharpen(raw.index),
        middle: sharpen(raw.middle),
        ring:   sharpen(raw.ring),
        pinky:  sharpen(raw.pinky),
    };
    const pinch = pinchScore(lm);

    // Closed-finger score is the inverse of extended.
    const c = {
        thumb:  1 - ext.thumb,
        index:  1 - ext.index,
        middle: 1 - ext.middle,
        ring:   1 - ext.ring,
        pinky:  1 - ext.pinky,
    };

    // Each gesture's confidence is the soft conjunction of its conditions.
    // Geometric mean keeps "all four matter" without one near-zero zeroing it.
    const gmean = (...xs) => Math.pow(xs.reduce((a, b) => a * b, 1), 1 / xs.length);

    const scores = {
        // Fist is penalised when the thumb is sticking out, so a thumbs-up doesn't
        // get scored as a fist by accident. Tucked-in thumb keeps fist at full strength.
        fist:         gmean(c.index, c.middle, c.ring, c.pinky) * (0.85 + 0.15 * c.thumb),
        open_palm:    gmean(ext.index, ext.middle, ext.ring, ext.pinky),
        peace:        gmean(ext.index, ext.middle, c.ring, c.pinky),
        // Heart: tight pinch + the other three fingers folded.
        finger_heart: gmean(pinch, pinch, c.middle, c.ring, c.pinky),
        // Thumbs up: thumb extended, all four other fingers closed.
        thumbs_up:    gmean(ext.thumb, c.index, c.middle, c.ring, c.pinky),
    };

    let best = 'none';
    let bestScore = 0;
    for (const g in scores) {
        if (scores[g] > bestScore) { bestScore = scores[g]; best = g; }
    }

    // Threshold: below this, no gesture is confident enough to fire.
    const THRESHOLD = 0.45;
    const gesture = bestScore >= THRESHOLD ? best : 'none';
    return { gesture, confidence: bestScore, scores };
}

export class GestureDetector {
    constructor({ holdMs = 200, onChange, onTick } = {}) {
        this.holdMs = holdMs;
        this.onChange = onChange;
        this.onTick = onTick;
        this.current = 'none';
        this.candidate = 'none';
        this.candidateSince = 0;
    }

    feed(landmarks) {
        const result = classify(landmarks);
        const now = performance.now();

        // Debounce machinery FIRST so holdProgress reads up-to-date state.
        if (result.gesture !== this.candidate) {
            this.candidate = result.gesture;
            this.candidateSince = now;
        } else if (result.gesture !== this.current &&
                   now - this.candidateSince >= this.holdMs) {
            // Candidate has been stable long enough to lock in.
            this.current = result.gesture;
            this.onChange?.(this.current);
        }

        // Live confidence of the gesture currently locked in (not the candidate).
        // This is what the scene fades against, so it reacts to your hand each frame.
        const liveConfidence = result.scores[this.current] ?? 0;

        // Progress toward locking in the current candidate (0..1).
        // 0  → no candidate seen
        // 1  → candidate matches what's already locked in (steady state)
        // x  → candidate is accumulating toward replacing the locked gesture
        let holdProgress;
        if (this.candidate === 'none') {
            holdProgress = 0;
        } else if (this.candidate === this.current) {
            holdProgress = 1;
        } else {
            holdProgress = Math.min(1, (now - this.candidateSince) / this.holdMs);
        }

        this.onTick?.({
            current: this.current,
            currentConfidence: liveConfidence,
            candidate: this.candidate,
            candidateConfidence: result.confidence,
            holdProgress,
        });
    }
}
