import { SceneManager } from "./sceneManager.js";
import { HandTracker } from "./handTracking.js";
import { GestureDetector } from "./gestureDetector.js";
import { HandOverlay } from "./handOverlay.js";
import { AudioFX } from "./audio.js";

const RING_CIRCUMFERENCE = 106.81; // matches stroke-dasharray in style.css

const ui = {
  loader: document.getElementById("loader"),
  startBtn: document.getElementById("start-btn"),
  indicator: document.getElementById("gesture-indicator"),
  name: document.getElementById("gesture-name"),
  hint: document.getElementById("gesture-hint"),
  video: document.getElementById("webcam"),
  overlayCanvas: document.getElementById("hand-overlay"),
  ringFg: document.querySelector("#hold-ring .ring-fg"),
};

const GESTURE_LABELS = {
  fist: { name: "Fist", hint: "A whole world in your hand" },
  open_palm: { name: "Open Palm", hint: "Sakura wind · let it bloom" },
  peace: { name: "Peace", hint: "Words for you" },
  finger_heart: { name: "Finger Heart", hint: "Made with love · Như 27.5" },
  thumbs_up: { name: "Like", hint: "A yes from the heart · Như 27.5" },
  none: { name: "—", hint: "Show your hand to the camera" },
};

const sceneManager = new SceneManager(document.getElementById("three-canvas"));
const overlay = new HandOverlay(ui.overlayCanvas);
const audio = new AudioFX();
const detector = new GestureDetector({
  // Confirm a gesture only after 1 seconds of stable hold — the progress ring
  // on the gesture card fills clockwise to show the timer to the user.
  holdMs: 1000,
  onChange: (gesture) => {
    const label = GESTURE_LABELS[gesture] ?? GESTURE_LABELS.none;
    ui.name.textContent = label.name;
    ui.hint.textContent = label.hint;
    ui.indicator.classList.toggle("active", gesture !== "none");

    if (gesture !== "none") audio.playGestureCue(gesture);
    sceneManager.setGesture(gesture);
  },
  // Per-frame report of detection state. Drives the scene's confidence fade
  // and the hold-progress ring on the gesture card.
  onTick: ({ current, currentConfidence, holdProgress }) => {
    sceneManager.setConfidence(current === "none" ? 0 : currentConfidence);
    if (ui.ringFg) {
      ui.ringFg.style.strokeDashoffset = (
        (1 - holdProgress) *
        RING_CIRCUMFERENCE
      ).toFixed(2);
    }
  },
});

const tracker = new HandTracker({
  videoEl: ui.video,
  onResults: (landmarks) => {
    detector.feed(landmarks);
    sceneManager.setHandLandmarks(landmarks);
    overlay.setLandmarks(landmarks);
  },
});

// Drive the overlay's fade animation independently of MediaPipe's frame cadence.
(function overlayLoop() {
  overlay.draw();
  requestAnimationFrame(overlayLoop);
})();

window.addEventListener("resize", () => sceneManager.resize());
sceneManager.resize();
sceneManager.start();

// Custom cursor — appended to body so its z-index isn't trapped under any layer.
(function initCursor() {
  const dot = document.createElement("div");
  dot.className = "cursor-dot";
  const ring = document.createElement("div");
  ring.className = "cursor-ring";
  document.body.append(dot, ring);

  let dotX = window.innerWidth / 2,
    dotY = window.innerHeight / 2;
  let ringX = dotX,
    ringY = dotY;

  window.addEventListener(
    "mousemove",
    (e) => {
      dotX = e.clientX;
      dotY = e.clientY;
    },
    { passive: true },
  );

  window.addEventListener("mouseleave", () => {
    dot.style.opacity = "0";
    ring.style.opacity = "0";
  });
  window.addEventListener("mouseenter", () => {
    dot.style.opacity = "1";
    ring.style.opacity = "1";
  });

  function tick() {
    ringX += (dotX - ringX) * 0.18;
    ringY += (dotY - ringY) * 0.18;
    dot.style.transform = `translate(${dotX}px, ${dotY}px) translate(-50%, -50%)`;
    ring.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
    requestAnimationFrame(tick);
  }
  tick();
})();

// Pre-load tracker (downloads model files); reveal Start when ready.
tracker
  .preload()
  .then(() => {
    ui.loader.classList.add("hidden");
    setTimeout(() => ui.loader.remove(), 900);
  })
  .catch((err) => {
    console.error("Failed to prepare hand tracker", err);
    ui.loader.querySelector("p").textContent =
      "Could not load. Refresh to retry.";
  });

ui.startBtn.addEventListener("click", async () => {
  try {
    await audio.unlock();
    await tracker.start();
    ui.startBtn.classList.add("hidden");
    setTimeout(() => ui.startBtn.remove(), 800);
  } catch (err) {
    console.error(err);
    alert("Could not start the camera. Please grant access and reload.");
  }
});
