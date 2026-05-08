// Pointer-driven interaction for the 2D Space Cat.
//
// Listens at the document level and translates raw pointer events into:
//
//   • a screen-space target the cat drifts toward (cursor follow)
//   • cursor speed signals → behavior state (slow=curious, fast=startled)
//   • drag-and-throw with momentum
//   • click → pet (heart sparkles + mood-keyed meow)
//   • 2.5s pointer hold over the cat → sleep
//
// Hit testing uses screen distance to the cat's center — it's cheaper than
// raycasting and forgiving when the cat is bouncing around. The radius
// expands while dragging so a fast pointer doesn't slip off.

const HOLD_TO_SLEEP_MS    = 2500;
const CLICK_VS_DRAG_PX    = 6;
const CAT_HIT_RADIUS_PX   = 110;
const CAT_HIT_RADIUS_DRAG = 240;
const CURSOR_IDLE_MS      = 1800;
const FAST_SPEED_PX       = 3.0;     // px/ms

export class CatInteraction {
    constructor({ cat, behavior, audio }) {
        this.cat = cat;
        this.behavior = behavior;
        this.audio = audio;

        this._mouseX = window.innerWidth  / 2;
        this._mouseY = window.innerHeight / 2;
        this._lastMoveT = performance.now();
        this._cursorSpeed = 0;

        this._isDown = false;
        this._isDragging = false;
        this._holdTimer = null;
        this._downX = 0;
        this._downY = 0;
        this._dragOffsetX = 0;
        this._dragOffsetY = 0;
        this._ignoreUntil = 0;

        this._paused = false;
        this._bind();
    }

    pause()  { this._paused = true; }
    resume() { this._paused = false; this._lastMoveT = performance.now(); }

    _bind() {
        const onMove = (e) => {
            if (this._paused) return;
            const now = performance.now();
            const dt = Math.max(1, now - this._lastMoveT);
            const dx = e.clientX - this._mouseX;
            const dy = e.clientY - this._mouseY;
            this._cursorSpeed = this._cursorSpeed * 0.7 + (Math.hypot(dx, dy) / dt) * 0.3;
            this._mouseX = e.clientX;
            this._mouseY = e.clientY;
            this._lastMoveT = now;

            const speed01 = Math.min(1, this._cursorSpeed / FAST_SPEED_PX);
            if (this._cursorOverCat()) this.behavior.feedCursorNear(speed01);
            else if (speed01 < 0.05)   this.behavior.feedCursorIdle();
        };

        const onDown = (e) => {
            if (this._paused) return;
            if (!this._cursorOverCat()) return;
            this._isDown = true;
            this._isDragging = false;
            this._downX = e.clientX;
            this._downY = e.clientY;

            clearTimeout(this._holdTimer);
            this._holdTimer = setTimeout(() => {
                if (this._isDown && !this._isDragging) this._enterSleep();
            }, HOLD_TO_SLEEP_MS);

            // Drag offset so the cat doesn't snap to the cursor at drag start.
            const c = this.cat.getCenter();
            this._dragOffsetX = c.x - e.clientX;
            this._dragOffsetY = c.y - e.clientY;

            this.behavior.feedCursorNear(0.5);
        };

        const onMoveDrag = (e) => {
            if (this._paused || !this._isDown) return;
            const dx = e.clientX - this._downX;
            const dy = e.clientY - this._downY;
            if (!this._isDragging && Math.hypot(dx, dy) > CLICK_VS_DRAG_PX) {
                this._isDragging = true;
                clearTimeout(this._holdTimer);
                this._wakeIfSleeping();
                this.behavior.feedCursorNear(1.0);
            }
            if (this._isDragging) {
                this.cat.setTarget(
                    e.clientX + this._dragOffsetX,
                    e.clientY + this._dragOffsetY,
                );
            }
        };

        const onUp = () => {
            if (this._paused) return;
            const wasDown = this._isDown;
            const wasDragging = this._isDragging;
            this._isDown = false;
            this._isDragging = false;
            clearTimeout(this._holdTimer);
            if (!wasDown) return;

            if (wasDragging) {
                // Cat retains its current velocity → gentle floating release.
                this.behavior.feedDragRelease();
                for (let i = 0; i < 6; i++) this.cat._spawnHeart('sparkle');
            } else {
                this._pet();
            }
        };

        const onLeave = () => {
            this._isDown = false;
            this._isDragging = false;
            clearTimeout(this._holdTimer);
        };

        document.addEventListener('mousemove',   onMove,     { passive: true });
        document.addEventListener('mousemove',   onMoveDrag, { passive: true });
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('pointerup',   onUp);
        window.addEventListener('blur', onLeave);
    }

    // ── high-level events ──────────────────────────────────────────────────
    _pet() {
        this._wakeIfSleeping();
        this.behavior.feedPet();
        this.cat.pet(14);

        const m = this.behavior.state;
        const meowType =
            m === 'sleepy'        ? 'sleepy'  :
            m === 'curious'       ? 'curious' :
            m === 'playful'       ? 'chirp'   :
            m === 'affectionate'  ? 'happy'   : 'happy';
        this.audio?.meow(meowType);
        this._spawnSpeech('Meow 💕');
    }

    _enterSleep() {
        this.cat.sleep();
        this.audio?.startPurr();
        this.audio?.startSnore();
        this.behavior.feedHold(0.5);
    }

    _wakeIfSleeping() {
        if (!this.cat._sleeping) return;
        this.cat.wake();
        this.audio?.stopPurr();
        this.audio?.stopSnore();
        this.audio?.meow('curious');
    }

    triggerCelebration() {
        this._wakeIfSleeping();
        this.behavior.feedCelebrate();
        this.cat.celebrate();
        this.audio?.chime();
        setTimeout(() => this.audio?.meow('chirp'), 600);
    }

    // ── per-frame: drift target + behavior tick ──────────────────────────
    update(dt) {
        if (this._paused) return;

        // Eyes always track cursor — even when the body is resting.
        this.cat.setLook(this._mouseX, this._mouseY);
        this.behavior.update(dt);
        this.cat.setMood(this.behavior.state);

        if (this._isDown && !this._isDragging && !this.cat._sleeping) {
            this.behavior.feedHold(dt);
        }

        if (this._isDragging) return;

        const idleMs = performance.now() - this._lastMoveT;
        const cursorIsIdle = idleMs > CURSOR_IDLE_MS;
        const m = this.behavior.state;

        // Mood keys "how much does the cat actually chase the cursor". Sleepy
        // ignores the cursor; playful overshoots; calm just lazily drifts.
        let chaseGain;
        if (this.cat._sleeping)         chaseGain = 0.04;
        else if (m === 'sleepy')        chaseGain = 0.08;
        else if (m === 'playful')       chaseGain = 0.85;
        else if (m === 'affectionate')  chaseGain = 0.55;
        else if (m === 'curious')       chaseGain = 0.45;
        else                            chaseGain = 0.25;

        // The cat doesn't sit on top of the cursor — it rests slightly
        // below-and-right so the pointer is never blocked. Idle cursor →
        // approach a touch closer.
        const offsetX = cursorIsIdle ? 110 : 160;
        const offsetY = cursorIsIdle ? 90  : 120;

        // 0.5% chance per frame the cat ignores the cursor for a beat —
        // gives it believable independence.
        if (Math.random() < 0.005 && !cursorIsIdle && m !== 'playful') {
            this._ignoreUntil = performance.now() + 600 + Math.random() * 800;
            this.behavior.feedIgnored();
        }
        if (performance.now() < this._ignoreUntil) return;

        const c = this.cat.getCenter();
        const tx = c.x + (this._mouseX + offsetX - c.x) * chaseGain;
        const ty = c.y + (this._mouseY + offsetY - c.y) * chaseGain;
        this.cat.setTarget(
            Math.min(window.innerWidth  - 80, Math.max(80, tx)),
            Math.min(window.innerHeight - 80, Math.max(80, ty)),
        );
    }

    // ── helpers ────────────────────────────────────────────────────────────
    _cursorOverCat() {
        const c = this.cat.getCenter();
        const r = this._isDragging ? CAT_HIT_RADIUS_DRAG : CAT_HIT_RADIUS_PX;
        return Math.hypot(this._mouseX - c.x, this._mouseY - c.y) < r;
    }

    _spawnSpeech(text) {
        const el = document.createElement('div');
        el.className = 'cat-speech';
        el.textContent = text;
        const c = this.cat.getCenter();
        el.style.left = `${c.x + 50}px`;
        el.style.top  = `${c.y - 60}px`;
        document.body.appendChild(el);
        el.addEventListener('animationend', () => el.remove());
    }
}
