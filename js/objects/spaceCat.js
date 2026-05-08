// Space Cat — a 2D SVG companion drawn in screen space.
//
// Replaces the earlier 3D cat. Lives in its own DOM container layered above
// the Three.js canvas (z-index just under the gesture UI). Inline SVG keeps
// the silhouette crisp at any DPI; CSS owns the always-on micro-motion
// (breath, tail sway, ear flick, idle paw) and JS owns the things that have
// to react to live state — cursor follow, gaze, blink, mood tinting,
// heart bursts, ZZZ on sleep, celebration jump.
//
// The interaction layer talks to this class in screen coordinates; nothing
// here touches the camera, so the cat is independent of the gesture pipeline
// and never blocks the hand-tracker.

import { IdleScheduler, IDLE_BIAS, ease } from '../interactive/catAnimations.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Cute pastel palette — cream + dusty pink + jade for the eyes.
const PALETTE = {
    bodyLight:   '#fff6e3',
    body:        '#fef0d6',
    bodyShadow:  '#f5dfb6',
    cheek:       '#ffc6d3',
    earInner:    '#ffb6c1',
    nose:        '#ff8fa3',
    mouth:       '#a07050',
    iris:        '#7fc4a3',
    irisDeep:    '#3f8e72',
    pupil:       '#1a1820',
    highlight:   '#ffffff',
    whisker:     '#d8c8a8',
};

const HEART_GLYPHS = ['💕', '💖', '🌸', '✨', '💗'];

export class SpaceCat {
    constructor() {
        this.container = document.createElement('div');
        this.container.className = 'space-cat';
        this.container.setAttribute('aria-hidden', 'true');
        this.container.innerHTML = SVG_MARKUP;
        document.body.appendChild(this.container);

        // ── DOM refs ───────────────────────────────────────────────────────
        this.svg       = this.container.querySelector('svg');
        this.head      = this.container.querySelector('.cat-head');
        this.body      = this.container.querySelector('.cat-body-group');
        this.tail      = this.container.querySelector('.cat-tail-group');
        this.earL      = this.container.querySelector('.cat-ear-left');
        this.earR      = this.container.querySelector('.cat-ear-right');
        this.eyeLidL   = this.container.querySelector('.eye-lid-left');
        this.eyeLidR   = this.container.querySelector('.eye-lid-right');
        this.pupilL    = this.container.querySelector('.eye-pupil-left');
        this.pupilR    = this.container.querySelector('.eye-pupil-right');
        this.glossL    = this.container.querySelector('.eye-gloss-left');
        this.glossR    = this.container.querySelector('.eye-gloss-right');
        this.eyeIrises = this.container.querySelectorAll('.eye-iris');
        this.mouth     = this.container.querySelector('.cat-mouth');
        this.zContainer= this.container.querySelector('.cat-zzz-layer');
        this.heartLayer= this.container.querySelector('.cat-heart-layer');

        // Per-eye constants for pupil tracking (their resting cx/cy in SVG units).
        this._pupilHomeL = { x: -14, y: -18 };
        this._pupilHomeR = { x:  14, y: -18 };

        // ── motion state — px in screen coords ────────────────────────────
        this.x = window.innerWidth - 220;
        this.y = window.innerHeight - 280;
        this.targetX = this.x;
        this.targetY = this.y;
        this.vx = 0;
        this.vy = 0;
        this.lookX = this.x;
        this.lookY = this.y;
        this._floatPhase = Math.random() * Math.PI * 2;

        // ── per-frame anim blends ─────────────────────────────────────────
        this._blendBlink   = 0;
        this._blendYawn    = 0;
        this._blendStretch = 0;
        this._earTwitchL   = 0;
        this._earTwitchR   = 0;
        this._mood = 'calm';
        this._sleeping = false;
        this._opacity = 1;
        this._jumpT = -1;

        this.idle = new IdleScheduler();

        // Level pill + level-up banner — driven externally via setLevel().
        this.levelPill = document.createElement('div');
        this.levelPill.className = 'cat-level-pill';
        this.levelPill.textContent = '';
        this.container.appendChild(this.levelPill);

        this.levelBanner = document.createElement('div');
        this.levelBanner.className = 'cat-levelup-banner';
        this.container.appendChild(this.levelBanner);

        this._applyPosition();
        this._applyMoodClass();

        // Re-anchor cat to bottom-right when the viewport resizes.
        window.addEventListener('resize', () => {
            this.targetX = Math.min(this.targetX, window.innerWidth  - 80);
            this.targetY = Math.min(this.targetY, window.innerHeight - 80);
        });
    }

    // ── public API consumed by interaction + sceneManager ─────────────────

    setMood(state) {
        if (state === this._mood) return;
        this._mood = state ?? 'calm';
        this._applyMoodClass();
    }

    setTarget(x, y) {
        this.targetX = x;
        this.targetY = y;
    }

    setLook(x, y) {
        this.lookX = x;
        this.lookY = y;
    }

    setGestureTint(hex, amount = 0.45) {
        if (hex == null || amount <= 0) {
            this.container.style.removeProperty('--cat-tint');
            this.container.style.setProperty('--cat-tint-amount', '0');
            return;
        }
        const rgb = hexToRgb(hex);
        this.container.style.setProperty('--cat-tint', `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`);
        this.container.style.setProperty('--cat-tint-amount', amount.toFixed(2));
    }

    setOpacity(v) {
        this._opacity = Math.max(0, Math.min(1, v));
        this.container.style.opacity = this._opacity;
    }

    pet(count = 12) {
        for (let i = 0; i < count; i++) this._spawnHeart();
        this.idle.forceAction('blink', 0.55);
    }

    blink(duration = 0.55) { this.idle.forceAction('blink', duration); }
    yawn()    { this.idle.forceAction('yawn'); }
    stretch() { this.idle.forceAction('stretch'); }

    sleep() {
        if (this._sleeping) return;
        this._sleeping = true;
        this.container.classList.add('sleeping');
        this._spawnZ();
        this._zInterval = setInterval(() => this._spawnZ(), 1400);
    }
    wake() {
        if (!this._sleeping) return;
        this._sleeping = false;
        this.container.classList.remove('sleeping');
        clearInterval(this._zInterval);
        this._zInterval = null;
        this.idle.forceAction('yawn');
        setTimeout(() => this.idle.forceAction('stretch'), 800);
    }

    celebrate() {
        // CSS keyframe owns the jump+spin so it doesn't fight the JS-driven
        // drift. We just toggle the class and let the animation complete.
        this.container.classList.add('celebrating');
        for (let i = 0; i < 24; i++) this._spawnHeart();
        return new Promise((res) => setTimeout(() => {
            this.container.classList.remove('celebrating');
            res();
        }, 1600));
    }

    // pause/resume — used while a game is running so the cat sits still.
    pause()  { this._paused = true;  this.container.classList.add('paused'); }
    resume() { this._paused = false; this.container.classList.remove('paused'); }

    // Toggle which accessories are visible. Pass an array of ids:
    //   'halo' | 'bow' | 'pendant' | 'hat' | 'scarf' | 'crown'
    // Anything not listed is hidden. Safe to call any time.
    setUnlocks(unlocks = []) {
        const c = this.container.classList;
        const all = ['halo', 'bow', 'pendant', 'hat', 'scarf', 'crown'];
        for (const u of all) c.toggle(`cat-show-${u}`, unlocks.includes(u));
    }

    // Persistent small "L3" pill near the cat. Empty string hides it.
    setLevelLabel(label) {
        if (!this.levelPill) return;
        if (!label) { this.levelPill.classList.remove('visible'); return; }
        this.levelPill.textContent = label;
        this.levelPill.classList.add('visible');
    }

    // Brief celebration when XP rolls into a new level.
    showLevelUp(text) {
        if (!this.levelBanner) return;
        this.levelBanner.textContent = text;
        this.levelBanner.classList.remove('flash');
        // Force reflow so the animation can replay rapidly.
        void this.levelBanner.offsetWidth;
        this.levelBanner.classList.add('flash');
        // Heart burst on the cat to mark the moment.
        for (let i = 0; i < 18; i++) this._spawnHeart(i % 4 === 0 ? 'sparkle' : 'heart');
    }

    // Screen-space center of the cat — interaction layer needs this for hit
    // testing and drag-offset bookkeeping.
    getCenter() { return { x: this.x, y: this.y }; }

    // ── per-frame update ──────────────────────────────────────────────────
    update(dt, time) {
        if (this._paused) return;

        // ── drift toward target with mood-keyed gain + soft inertia ──
        const followGain = this._sleeping
            ? 0.6
            : (this._mood === 'playful'      ? 7.0 :
               this._mood === 'sleepy'       ? 1.6 :
               this._mood === 'affectionate' ? 4.0 :
               this._mood === 'curious'      ? 4.5 :
                                               3.2);
        this.vx += (this.targetX - this.x) * dt * followGain;
        this.vy += (this.targetY - this.y) * dt * followGain;
        this.vx *= Math.pow(0.86, dt * 60);
        this.vy *= Math.pow(0.86, dt * 60);
        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Subtle floating bob — independent of the breathing CSS animation.
        // Adds gentle vertical drift so the cat reads as "weightless".
        this._floatPhase += dt * (this._sleeping ? 0.6 : 1.1);
        const floatOffset = Math.sin(this._floatPhase) * (this._sleeping ? 2.5 : 4.0);
        this._applyPosition(floatOffset);

        // ── idle scheduler — bias by mood ──
        const bias = this._sleeping
            ? { blink: 8, yawn: 2, swish: 0.2, twitch: 0.1, look: 0.1, chase: 0, groom: 0.4, stretch: 0.5 }
            : (IDLE_BIAS[this._mood] ?? IDLE_BIAS.calm);
        this.idle.update(dt, bias);

        const a  = this.idle.action;
        const ap = this.idle.progress();

        // ── blink (slow, eased) ──
        const wantBlink = this._sleeping
            ? 1.0
            : a?.name === 'blink' ? ease.pulse(ap) :
              a?.name === 'yawn'  ? ease.pulse(ap) * 0.6 : 0;
        this._blendBlink += (wantBlink - this._blendBlink) * 0.18;
        this.eyeLidL.setAttribute('ry', (11 * this._blendBlink).toFixed(2));
        this.eyeLidR.setAttribute('ry', (11 * this._blendBlink).toFixed(2));

        // ── yawn (mouth opens) ──
        this._blendYawn += ((a?.name === 'yawn' ? ease.pulse(ap) : 0) - this._blendYawn) * 0.10;
        const mouthOpen = this._blendYawn * 5;
        if (this.mouth) {
            // Reshape the smile path into an open oval as the cat yawns. Two
            // anchor points make a very small "o" → open mouth.
            const top = 4 - mouthOpen * 1.5;
            const bot = 4 + mouthOpen * 2.5;
            this.mouth.setAttribute('d', `M -5,${top} Q -2.5,${top + 1.5} 0,${top} Q 2.5,${top + 1.5} 5,${top} M -3,${top} Q 0,${bot} 3,${top}`);
        }

        // ── stretch (body elongates a touch) ──
        // Only override the inline transform while stretch is meaningfully
        // active. Otherwise we clear it so the CSS breath keyframes play.
        this._blendStretch += ((a?.name === 'stretch' ? ease.pulse(ap) : 0) - this._blendStretch) * 0.08;
        if (this.body) {
            if (this._blendStretch > 0.01) {
                const sy = 1 - this._blendStretch * 0.06;
                const sx = 1 + this._blendStretch * 0.08;
                this.body.style.transform = `scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
            } else if (this.body.style.transform) {
                this.body.style.transform = '';
            }
        }

        // ── ear twitches (gentle) ──
        const tL = a?.name === 'twitch' && ap < 0.5 ? Math.sin(ap * 18) * 6 : this._earTwitchL * 0.92;
        const tR = a?.name === 'twitch' && ap > 0.3 ? Math.sin(ap * 16) * 5 : this._earTwitchR * 0.92;
        this._earTwitchL = tL;
        this._earTwitchR = tR;
        if (this.earL) this.earL.style.transform = `rotate(${tL.toFixed(2)}deg)`;
        if (this.earR) this.earR.style.transform = `rotate(${(-tR).toFixed(2)}deg)`;

        // ── pupil gaze toward look target ──
        // Convert the look target into the cat's local SVG-coords so the
        // pupils slide naturally toward the cursor.
        const dx = clamp((this.lookX - this.x) * 0.04, -3.5, 3.5);
        const dy = clamp((this.lookY - this.y) * 0.04, -2.5, 2.5);
        this.pupilL.setAttribute('cx', (this._pupilHomeL.x + dx).toFixed(2));
        this.pupilL.setAttribute('cy', (this._pupilHomeL.y + dy).toFixed(2));
        this.pupilR.setAttribute('cx', (this._pupilHomeR.x + dx).toFixed(2));
        this.pupilR.setAttribute('cy', (this._pupilHomeR.y + dy).toFixed(2));
        this.glossL.setAttribute('cx', (this._pupilHomeL.x - 2 + dx * 0.5).toFixed(2));
        this.glossR.setAttribute('cx', (this._pupilHomeR.x - 2 + dx * 0.5).toFixed(2));

        // ── pupil dilation by mood ──
        // Bigger pupil when affectionate/playful, slit-thin when sleepy.
        const dilation =
            this._sleeping              ? 0.55 :
            this._mood === 'sleepy'     ? 0.65 :
            this._mood === 'affectionate'? 1.30 :
            this._mood === 'playful'    ? 1.20 :
            this._mood === 'curious'    ? 1.10 :
                                          1.00;
        const targetRx = (3.0 * dilation).toFixed(2);
        const targetRy = (7.0 * dilation).toFixed(2);
        this.pupilL.setAttribute('rx', targetRx);
        this.pupilR.setAttribute('rx', targetRx);
        this.pupilL.setAttribute('ry', targetRy);
        this.pupilR.setAttribute('ry', targetRy);

        // ── celebration jump tracker (extra: spawn occasional sparkles) ──
        if (this._jumpT >= 0) {
            this._jumpT += dt;
            if (Math.random() < 0.35) this._spawnHeart('sparkle');
            if (this._jumpT > 1.6) this._jumpT = -1;
        }
    }

    // ── helpers ────────────────────────────────────────────────────────────

    _applyPosition(floatOffset = 0) {
        const tx = this.x.toFixed(1);
        const ty = (this.y + floatOffset).toFixed(1);
        this.container.style.transform = `translate(${tx}px, ${ty}px)`;
    }

    _applyMoodClass() {
        const c = this.container.classList;
        c.remove('mood-calm', 'mood-curious', 'mood-playful', 'mood-affectionate', 'mood-sleepy');
        c.add(`mood-${this._mood}`);
    }

    _spawnHeart(kind = 'heart') {
        const el = document.createElement('span');
        el.className = `cat-pet-heart ${kind === 'sparkle' ? 'sparkle' : ''}`;
        el.textContent = kind === 'sparkle' ? '✨' : HEART_GLYPHS[(Math.random() * HEART_GLYPHS.length) | 0];
        const angle = Math.random() * Math.PI * 2;
        const dist  = 30 + Math.random() * 50;
        el.style.setProperty('--dx',   `${Math.cos(angle) * dist - 18}px`);
        el.style.setProperty('--dy',   `${Math.sin(angle) * dist - 80}px`);
        el.style.setProperty('--rot',  `${(Math.random() - 0.5) * 60}deg`);
        el.style.setProperty('--size', `${0.85 + Math.random() * 0.5}`);
        el.style.setProperty('--delay',`${Math.random() * 200}ms`);
        this.heartLayer.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
    }

    _spawnZ() {
        const z = document.createElement('span');
        z.className = 'cat-zzz';
        z.textContent = 'z';
        z.style.setProperty('--dx', `${(Math.random() - 0.5) * 24}px`);
        z.style.setProperty('--size', `${0.85 + Math.random() * 0.45}`);
        this.zContainer.appendChild(z);
        z.addEventListener('animationend', () => z.remove());
    }
}

// ── helpers ────────────────────────────────────────────────────────────────
function hexToRgb(hex) {
    const n = typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex;
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

// ── SVG markup ─────────────────────────────────────────────────────────────
// One inline SVG; classes mark the parts we mutate. The viewBox is centred
// at (0, 0) with the head sitting at -15 and the body at +35 so JS doesn't
// need to think in absolute coords.
const SVG_MARKUP = /* html */`
<div class="cat-zzz-layer"></div>
<div class="cat-heart-layer"></div>
<svg class="cat-svg" viewBox="-100 -120 200 240" xmlns="${SVG_NS}">
  <defs>
    <radialGradient id="catHalo" cx="50%" cy="55%" r="55%">
      <stop offset="0%"  stop-color="#fff6e3" stop-opacity="0.35"/>
      <stop offset="60%" stop-color="#fff6e3" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#fff6e3" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="catBelly" cx="50%" cy="60%" r="55%">
      <stop offset="0%"  stop-color="${PALETTE.bodyLight}"/>
      <stop offset="100%" stop-color="${PALETTE.body}"/>
    </radialGradient>
    <radialGradient id="catHead" cx="50%" cy="40%" r="60%">
      <stop offset="0%"  stop-color="${PALETTE.bodyLight}"/>
      <stop offset="100%" stop-color="${PALETTE.body}"/>
    </radialGradient>
    <radialGradient id="catIris" cx="50%" cy="40%" r="65%">
      <stop offset="0%"  stop-color="${PALETTE.iris}"/>
      <stop offset="80%" stop-color="${PALETTE.irisDeep}"/>
      <stop offset="100%" stop-color="#1a3528"/>
    </radialGradient>
  </defs>

  <!-- Soft glow halo behind the cat. The CSS gesture-tint drop-shadow
       layers over this for a per-scene mood glow. -->
  <ellipse cx="0" cy="10" rx="90" ry="80" fill="url(#catHalo)"/>

  <!-- Tail — drawn behind body. Animated via CSS keyframes (rotate around
       the tail's base). The shadow stripe gives a gentle volume hint. -->
  <g class="cat-tail-group">
    <path class="cat-tail" d="M 32,38 C 70,30 78,-10 56,-30 C 42,-44 22,-40 22,-26"
          fill="none" stroke="${PALETTE.body}" stroke-width="16" stroke-linecap="round"/>
    <path d="M 32,38 C 70,30 78,-10 56,-30 C 42,-44 22,-40 22,-26"
          fill="none" stroke="${PALETTE.bodyShadow}" stroke-width="6" stroke-linecap="round" opacity="0.35"/>
    <circle cx="22" cy="-26" r="9" fill="${PALETTE.body}"/>
  </g>

  <!-- Body — sitting cat-loaf shape -->
  <g class="cat-body-group">
    <ellipse cx="0" cy="38" rx="52" ry="44" fill="url(#catBelly)"/>
    <ellipse cx="0" cy="55" rx="34" ry="22" fill="${PALETTE.bodyLight}"/>
    <!-- Front paws -->
    <ellipse cx="-19" cy="72" rx="11" ry="7" fill="${PALETTE.body}"/>
    <ellipse cx=" 19" cy="72" rx="11" ry="7" fill="${PALETTE.body}"/>
    <!-- Toe beans (tiny pink dots) -->
    <circle cx="-19" cy="72" r="1.6" fill="${PALETTE.earInner}" opacity="0.8"/>
    <circle cx=" 19" cy="72" r="1.6" fill="${PALETTE.earInner}" opacity="0.8"/>
  </g>

  <!-- Head — the big readable bit -->
  <g class="cat-head">

    <!-- Ears — outer cream + inner pink. Pivot via JS for twitch. -->
    <g class="cat-ear-left"  style="transform-origin: -28px -30px;">
      <path d="M -40,-26 L -30,-62 L -10,-32 Z" fill="${PALETTE.body}"/>
      <path d="M -33,-32 L -28,-54 L -16,-34 Z" fill="${PALETTE.earInner}"/>
    </g>
    <g class="cat-ear-right" style="transform-origin: 28px -30px;">
      <path d="M  40,-26 L  30,-62 L  10,-32 Z" fill="${PALETTE.body}"/>
      <path d="M  33,-32 L  28,-54 L  16,-34 Z" fill="${PALETTE.earInner}"/>
    </g>

    <!-- Head circle -->
    <circle cx="0" cy="-15" r="40" fill="url(#catHead)"/>

    <!-- Cheek blush -->
    <ellipse cx="-23" cy="-2"  rx="9" ry="5" fill="${PALETTE.cheek}" opacity="0.55"/>
    <ellipse cx=" 23" cy="-2"  rx="9" ry="5" fill="${PALETTE.cheek}" opacity="0.55"/>

    <!-- Eyes — sclera, iris, pupil, lid, gloss -->
    <g class="cat-eyes">
      <ellipse cx="-14" cy="-18" rx="8.5" ry="11.5" fill="#ffffff"/>
      <ellipse cx=" 14" cy="-18" rx="8.5" ry="11.5" fill="#ffffff"/>
      <ellipse class="eye-iris" cx="-14" cy="-18" rx="7" ry="10" fill="url(#catIris)"/>
      <ellipse class="eye-iris" cx=" 14" cy="-18" rx="7" ry="10" fill="url(#catIris)"/>
      <ellipse class="eye-pupil-left"  cx="-14" cy="-18" rx="3" ry="7" fill="${PALETTE.pupil}"/>
      <ellipse class="eye-pupil-right" cx=" 14" cy="-18" rx="3" ry="7" fill="${PALETTE.pupil}"/>
      <circle  class="eye-gloss-left"  cx="-16" cy="-22" r="2"   fill="${PALETTE.highlight}"/>
      <circle  class="eye-gloss-right" cx=" 12" cy="-22" r="2"   fill="${PALETTE.highlight}"/>
      <circle cx="-12" cy="-13" r="0.9" fill="${PALETTE.highlight}" opacity="0.85"/>
      <circle cx=" 16" cy="-13" r="0.9" fill="${PALETTE.highlight}" opacity="0.85"/>
      <!-- Eyelids — ry collapses to 0 when the eye is open. JS animates ry
           up to ≈11 to close the eye for a slow blink. -->
      <ellipse class="eye-lid-left"  cx="-14" cy="-18" rx="9" ry="0" fill="${PALETTE.body}"/>
      <ellipse class="eye-lid-right" cx=" 14" cy="-18" rx="9" ry="0" fill="${PALETTE.body}"/>
    </g>

    <!-- Nose — small heart-leaning triangle -->
    <path class="cat-nose"
          d="M -3.5,-3 Q 0,-6 3.5,-3 Q 3.5,1.5 0,3.5 Q -3.5,1.5 -3.5,-3 Z"
          fill="${PALETTE.nose}"/>

    <!-- Mouth — a tiny W that the JS reshapes for yawning -->
    <path class="cat-mouth"
          d="M -5,4 Q -2.5,5.5 0,4 Q 2.5,5.5 5,4"
          stroke="${PALETTE.mouth}" stroke-width="1.3" fill="none" stroke-linecap="round"/>

    <!-- Whiskers — three each side, soft cream so they don't dominate -->
    <g class="cat-whiskers" stroke="${PALETTE.whisker}" stroke-width="0.8" stroke-linecap="round">
      <line x1="-12" y1="-3" x2="-42" y2="-7"/>
      <line x1="-12" y1="0"  x2="-44" y2="0"/>
      <line x1="-12" y1="3"  x2="-42" y2="6"/>
      <line x1=" 12" y1="-3" x2=" 42" y2="-7"/>
      <line x1=" 12" y1="0"  x2=" 44" y2="0"/>
      <line x1=" 12" y1="3"  x2=" 42" y2="6"/>
    </g>

    <!-- Accessories — visible only when the container has the matching
         .cat-show-* class. Drawn last in the head group so they stack on top
         of the head/cheeks/eyes/nose. -->

    <!-- Bow on right ear -->
    <g class="cat-accessory acc-bow" transform="translate(28, -56)">
      <path d="M 0,0 Q -10,-7 -10,4 Q -4,2 0,0 Z" fill="#ff7aa6"/>
      <path d="M 0,0 Q  10,-7  10,4 Q  4,2 0,0 Z" fill="#ff5d8a"/>
      <ellipse cx="0" cy="0" rx="3" ry="2.6" fill="#ff95b4"/>
      <ellipse cx="-0.5" cy="-0.7" rx="1.2" ry="0.6" fill="#fff" opacity="0.7"/>
    </g>

    <!-- Birthday cone hat (replaced by crown at L6) -->
    <g class="cat-accessory acc-hat">
      <path d="M -16,-58 L 16,-58 L 0,-100 Z" fill="#ff6fa3"/>
      <path d="M -10,-72 L 10,-72" stroke="#fff" stroke-width="2.2"
            stroke-linecap="round" stroke-dasharray="4,3"/>
      <path d="M -13,-83 L 13,-83" stroke="#fff" stroke-width="1.8"
            stroke-linecap="round" stroke-dasharray="3,3" opacity="0.85"/>
      <circle cx="0" cy="-101" r="5" fill="#fff5fa"/>
      <circle cx="-1" cy="-102" r="2" fill="#ffd5e5"/>
    </g>

    <!-- Starlight crown (L6) -->
    <g class="cat-accessory acc-crown">
      <path d="M -22,-55 L -16,-72 L -8,-58 L 0,-80 L 8,-58 L 16,-72 L 22,-55 Z"
            fill="#ffd96a" stroke="#c9a13b" stroke-width="0.6"/>
      <circle cx="0" cy="-67" r="3" fill="#ff6fa3"/>
      <circle cx="-13" cy="-62" r="2" fill="#fff5cc"/>
      <circle cx=" 13" cy="-62" r="2" fill="#fff5cc"/>
      <circle cx="0" cy="-77" r="1.4" fill="#fff" opacity="0.9"/>
    </g>

    <!-- Heart pendant on chest -->
    <g class="cat-accessory acc-pendant">
      <path d="M -10,18 L 0,32" stroke="#ffb3c8" stroke-width="0.7" fill="none"/>
      <path d="M  10,18 L 0,32" stroke="#ffb3c8" stroke-width="0.7" fill="none"/>
      <path d="M 0,38 C -4,32 -10,34 -8,40 C -6,46 0,50 0,50 C 0,50 6,46 8,40 C 10,34 4,32 0,38 Z"
            fill="#ff6fa3" stroke="#c54a73" stroke-width="0.6"/>
      <ellipse cx="-2" cy="40" rx="1.4" ry="0.9" fill="#ffd0dd" opacity="0.8"/>
    </g>

    <!-- Soft scarf wrapping the neck -->
    <g class="cat-accessory acc-scarf">
      <path d="M -38,16 Q -34,12 -28,14 Q 0,22 28,14 Q 34,12 38,16 L 38,28 Q 0,34 -38,28 Z"
            fill="#7fbfd9"/>
      <path d="M -38,16 Q -10,24 38,16" stroke="#a8d4ff" stroke-width="1.5"
            fill="none" opacity="0.8"/>
      <path d="M -28,18 L -42,42 L -34,46 L -22,28 Z" fill="#a8d4ff"/>
    </g>
  </g>
</svg>
`;
