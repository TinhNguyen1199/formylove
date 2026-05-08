// Zen mode — auto-activates after a long idle period (no gesture lock and
// no mouse movement). Renders a soft breathing guide centred on screen so
// em có thể chỉ ngồi nhìn và thở cùng nó. Exits the moment any activity
// resumes (mouse move / click / first new gesture lock).
//
// Trigger logic on purpose ignores raw gesture *candidates* (the constantly-
// firing onTick) — only actual locked-in gestures from onChange count. That
// means hand-in-frame-but-not-doing-anything still counts as idle, which is
// what we want for "she opened the page just to ambient-watch."

const DEFAULT_OPTS = {
    idleMs:        30_000,    // delay before entering zen mode
    inhaleMs:       4_000,
    exhaleMs:       6_000,
    cyclesBeforeMessageRotate: 3,
};

const BREATH_PHASES = [
    { label: 'Hít vào',  cls: 'inhale' },
    { label: 'Thở ra',   cls: 'exhale' },
];

const ZEN_MESSAGES = [
    "Thư giãn cùng anh nhé · không có gì gấp đâu",
    "Hít vào một hơi · thở ra một hơi · em đang ổn rồi",
    "Cứ ngồi đây với anh một chút",
    "Không cần làm gì cả · em chỉ cần thở thôi",
    "Mọi thứ rồi sẽ qua · còn em luôn ở đây",
    "Anh thương em · ngay cả khi em im lặng",
];

export class ZenMode {
    constructor(opts = {}) {
        this.opts = { ...DEFAULT_OPTS, ...opts };
        this._idleTimer = null;
        this._active = false;
        this._paused = false;
        this._breathTimer = null;
        this._breathPhase = 0;
        this._cycle = 0;

        this._buildDom();
        this._bindActivity();
        this._armIdleTimer();
    }

    _buildDom() {
        const root = document.createElement('div');
        root.id = 'zen-mode';
        root.setAttribute('aria-hidden', 'true');
        root.innerHTML = `
            <div class="zen-circle"></div>
            <div class="zen-ring"></div>
            <div class="zen-label">—</div>
            <div class="zen-message"></div>
            <div class="zen-hint">cử động chuột · vẫy tay · để quay lại</div>
        `;
        document.body.appendChild(root);
        this.root    = root;
        this.circle  = root.querySelector('.zen-circle');
        this.label   = root.querySelector('.zen-label');
        this.message = root.querySelector('.zen-message');
    }

    _bindActivity() {
        // Mouse + click + keypress reset the idle clock. Touch counts too in
        // case em mở trên iPad. Passive listeners — these are observation-only.
        const reset = () => this._noteActivity();
        window.addEventListener('mousemove', reset, { passive: true });
        window.addEventListener('mousedown', reset, { passive: true });
        window.addEventListener('keydown',   reset);
        window.addEventListener('touchstart', reset, { passive: true });
    }

    // Called from main.js whenever a gesture locks in (i.e., a real onChange
    // fire, not an onTick). Treated as user activity for idle purposes.
    noteGesture(gesture) {
        if (gesture && gesture !== 'none') this._noteActivity();
    }

    _noteActivity() {
        if (this._paused) return;
        if (this._active) this._exit();
        this._armIdleTimer();
    }

    _armIdleTimer() {
        clearTimeout(this._idleTimer);
        if (this._paused) return;
        this._idleTimer = setTimeout(() => this._enter(), this.opts.idleMs);
    }

    _enter() {
        if (this._active || this._paused) return;
        this._active = true;
        this._cycle = 0;
        this._breathPhase = 0;
        this.root.classList.add('active');
        document.body.classList.add('zen-active');
        // Pick a starting message; rotate through the bank as cycles progress.
        this._showMessage(0);
        this._runBreathPhase();
    }

    _exit() {
        if (!this._active) return;
        this._active = false;
        clearTimeout(this._breathTimer);
        this._breathTimer = null;
        this.root.classList.remove('active', 'inhale', 'exhale');
        document.body.classList.remove('zen-active');
    }

    _runBreathPhase() {
        if (!this._active) return;
        const phase = BREATH_PHASES[this._breathPhase];
        const ms    = phase.cls === 'inhale' ? this.opts.inhaleMs : this.opts.exhaleMs;
        // CSS reads .inhale / .exhale on the root; toggling drives the
        // transition on the circle (scale + opacity). Setting --zen-phase-ms
        // lets the same CSS rule animate at the configured duration.
        this.root.classList.remove('inhale', 'exhale');
        // Force reflow so the next class change actually retransitions.
        void this.root.offsetWidth;
        this.root.style.setProperty('--zen-phase-ms', `${ms}ms`);
        this.root.classList.add(phase.cls);
        this.label.textContent = phase.label;

        this._breathTimer = setTimeout(() => {
            this._breathPhase = (this._breathPhase + 1) % BREATH_PHASES.length;
            // Rotate message every N full cycles (one cycle = 2 phases).
            if (this._breathPhase === 0) {
                this._cycle++;
                if (this._cycle % this.opts.cyclesBeforeMessageRotate === 0) {
                    this._showMessage();
                }
            }
            this._runBreathPhase();
        }, ms);
    }

    _showMessage(forceIndex) {
        const idx = forceIndex ?? Math.floor(Math.random() * ZEN_MESSAGES.length);
        // Fade-out → swap → fade-in for smooth message rotation.
        this.message.classList.add('fading');
        setTimeout(() => {
            this.message.textContent = ZEN_MESSAGES[idx];
            this.message.classList.remove('fading');
        }, 350);
    }

    pause() {
        this._paused = true;
        clearTimeout(this._idleTimer);
        this._exit();
    }
    resume() {
        this._paused = false;
        this._armIdleTimer();
    }
}
