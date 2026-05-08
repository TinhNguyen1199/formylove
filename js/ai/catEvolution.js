// Cat evolution — XP, levels, and unlocked accessories.
//
// Persists to localStorage so the cat remembers across sessions. Level-up is
// emitted via `onLevelUp(newLevel, unlocks)` so the caller can play a chime,
// confetti burst, etc.
//
// XP comes from three sources, each capped softly via diminishing weights so
// the cat doesn't max out from one frantic petting session:
//   • visit       (+20 once per session)
//   • pet         (+2 per pet, hard-capped 60/session)
//   • gesture     (+5 per unique gesture lock-in)
//   • celebrate   (+30 — poem completion, special events)

const STORAGE_KEY = 'birthday_cat_evolution';

// Level threshold (cumulative XP needed to *reach* this level).
// Index = level. Level 0 is the starting state.
export const LEVEL_THRESHOLDS = [
    0,      // L0 — Mèo con
    50,     // L1 — Mèo nhỏ
    150,    // L2 — Mèo bạn
    350,    // L3 — Mèo thân
    700,    // L4 — Mèo iu
    1200,   // L5 — Mèo nhà
    2000,   // L6 — Tinh tú
];

export const LEVEL_NAMES = [
    'Mèo con', 'Mèo nhỏ', 'Mèo bạn', 'Mèo thân',
    'Mèo iu', 'Mèo nhà', 'Tinh tú',
];

// Accessories unlocked when the cat reaches each level.
//   halo:    L1 — soft sparkle halo (CSS-only)
//   bow:     L2 — pink bow on the right ear
//   pendant: L3 — heart pendant on chest
//   hat:     L4 — birthday cone hat (swapped for crown at L6)
//   scarf:   L5 — wrapped neck scarf
//   crown:   L6 — starlight crown (replaces hat)
const LEVEL_UNLOCKS = [
    [],                                // L0
    ['halo'],                          // L1
    ['halo', 'bow'],                   // L2
    ['halo', 'bow', 'pendant'],        // L3
    ['halo', 'bow', 'pendant', 'hat'], // L4
    ['halo', 'bow', 'pendant', 'hat', 'scarf'],   // L5
    ['halo', 'bow', 'pendant', 'crown', 'scarf'], // L6 — crown replaces hat
];

// Per-session caps so a single frenzied session can't fast-forward levels.
const SESSION_CAP = {
    pet:     60,
    gesture: 50,
    todo:    40,
};

function safeRead() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (_e) { return null; }
}
function safeWrite(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (_e) { /* incognito / quota — ignore */ }
}

export function levelForXp(xp) {
    let lvl = 0;
    for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
        if (xp >= LEVEL_THRESHOLDS[i]) lvl = i;
    }
    return lvl;
}

export function unlocksForLevel(level) {
    return LEVEL_UNLOCKS[Math.min(level, LEVEL_UNLOCKS.length - 1)];
}

export class CatEvolution {
    constructor() {
        const saved = safeRead();
        this.xp    = saved?.xp ?? 0;
        this.level = levelForXp(this.xp);

        // Per-session counters reset on each page load.
        this._sessionGains = { pet: 0, gesture: 0, visit: 0 };

        this._listeners = [];
    }

    onLevelUp(fn)  { this._listeners.push(fn); return () => {
        this._listeners = this._listeners.filter((f) => f !== fn);
    }; }

    getXp()    { return this.xp; }
    getLevel() { return this.level; }
    getName()  { return LEVEL_NAMES[Math.min(this.level, LEVEL_NAMES.length - 1)]; }
    getUnlocks() { return unlocksForLevel(this.level); }

    // Returns { current, next, ratio } for the in-bar display.
    getProgress() {
        const cur  = LEVEL_THRESHOLDS[this.level] ?? 0;
        const next = LEVEL_THRESHOLDS[this.level + 1] ?? null;
        if (next == null) return { current: this.xp, next: null, ratio: 1 };
        const span = next - cur;
        return {
            current: this.xp,
            next,
            ratio: Math.min(1, Math.max(0, (this.xp - cur) / span)),
        };
    }

    addXp(amount, source = 'misc') {
        if (!Number.isFinite(amount) || amount <= 0) return false;
        if (source && SESSION_CAP[source] != null) {
            const used = this._sessionGains[source] ?? 0;
            const remaining = SESSION_CAP[source] - used;
            if (remaining <= 0) return false;
            amount = Math.min(amount, remaining);
            this._sessionGains[source] = used + amount;
        }
        const prevLevel = this.level;
        this.xp += amount;
        const newLevel = levelForXp(this.xp);
        safeWrite({ xp: this.xp, level: newLevel });

        if (newLevel > prevLevel) {
            this.level = newLevel;
            const unlocks = unlocksForLevel(newLevel);
            const prevUnlocks = unlocksForLevel(prevLevel);
            const newUnlocks = unlocks.filter((u) => !prevUnlocks.includes(u));
            for (const fn of this._listeners) {
                try { fn(newLevel, newUnlocks); }
                catch (e) { console.warn(e); }
            }
            return true;
        }
        return false;
    }

    // Convenience hooks called from interaction code.
    notePet()      { return this.addXp(2,  'pet'); }
    noteGesture()  { return this.addXp(5,  'gesture'); }
    noteTodo()     { return this.addXp(4,  'todo'); }
    noteCelebrate(){ return this.addXp(30, 'celebrate'); }
    noteVisit() {
        if (this._sessionGains.visit) return false;
        this._sessionGains.visit = 1;
        return this.addXp(20, 'visit');
    }
}
