// Ambient events — every 18–50s pick one of: shooting star streak, balloon
// drift, paper-airplane fly-through. Pure DOM with CSS keyframes; auto-clean
// on animationend.

const PAPER_PLANE_PHRASES = [
  "anh nhớ em",
  "yêu em",
  "em xinh thật",
  "babe ơi",
  "Nhớ a không?",
  "cô giáo Như đẹp nhất :v",
  "anh thương em",
  "Em ăn cơm chưa?",
];

export class AmbientEvents {
  constructor({ minDelay = 18_000, maxDelay = 50_000 } = {}) {
    this.minDelay = minDelay;
    this.maxDelay = maxDelay;
    this.events = [
      this._shootingStar.bind(this),
      this._balloons.bind(this),
      this._paperPlane.bind(this),
    ];
    this._scheduleNext();
  }

  stop() {
    if (this._timeout) clearTimeout(this._timeout);
    this._timeout = null;
  }

  pause() {
    if (this._paused) return;
    this._paused = true;
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = null;
    }
  }

  resume() {
    if (!this._paused) return;
    this._paused = false;
    this._scheduleNext();
  }

  _scheduleNext() {
    const delay =
      this.minDelay + Math.random() * (this.maxDelay - this.minDelay);
    this._timeout = setTimeout(() => {
      const event = this.events[(Math.random() * this.events.length) | 0];
      event();
      this._scheduleNext();
    }, delay);
  }

  // ── Event: shooting star ────────────────────────────────────────────
  _shootingStar() {
    const star = document.createElement("div");
    star.className = "shooting-star";

    // Arc across the upper half of the screen, left-to-right typically.
    const fromX = -80;
    const fromY = Math.random() * window.innerHeight * 0.55;
    const toX = window.innerWidth + 100;
    const toY = fromY + 100 + Math.random() * 240;
    const angle = (Math.atan2(toY - fromY, toX - fromX) * 180) / Math.PI;

    star.style.setProperty("--from-x", `${fromX}px`);
    star.style.setProperty("--from-y", `${fromY}px`);
    star.style.setProperty("--to-x", `${toX}px`);
    star.style.setProperty("--to-y", `${toY}px`);
    star.style.setProperty("--angle", `${angle}deg`);

    document.body.appendChild(star);
    star.addEventListener("animationend", () => star.remove());
  }

  // ── Event: balloon drift ────────────────────────────────────────────
  _balloons() {
    const count = 1 + ((Math.random() * 2) | 0); // 1 or 2 balloons
    for (let i = 0; i < count; i++) {
      const balloon = document.createElement("div");
      balloon.className = "ambient-balloon";
      balloon.textContent = "🎈";
      const startX = 60 + Math.random() * (window.innerWidth - 120);
      const drift = (Math.random() - 0.5) * 220;
      balloon.style.setProperty("--start-x", `${startX}px`);
      balloon.style.setProperty("--drift", `${drift}px`);
      balloon.style.setProperty("--delay", `${i * 900}ms`);
      balloon.style.setProperty("--dur", `${13 + Math.random() * 4}s`);
      document.body.appendChild(balloon);
      balloon.addEventListener("animationend", () => balloon.remove());
    }
  }

  // ── Event: paper airplane / love letter ────────────────────────────
  _paperPlane() {
    const plane = document.createElement("div");
    plane.className = "ambient-plane";
    const text =
      PAPER_PLANE_PHRASES[(Math.random() * PAPER_PLANE_PHRASES.length) | 0];
    plane.innerHTML =
      '<span class="plane-icon">✉️</span>' +
      `<span class="plane-text">${text}</span>`;
    // Random vertical band (avoid the very top + very bottom strips).
    const yPercent = 25 + Math.random() * 45;
    plane.style.bottom = `${yPercent}%`;
    plane.style.setProperty("--dur", `${10 + Math.random() * 4}s`);
    document.body.appendChild(plane);
    plane.addEventListener("animationend", () => plane.remove());
  }
}
