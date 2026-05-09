import { SceneManager } from "./sceneManager.js";
import { HandTracker } from "./handTracking.js";
import { GestureDetector } from "./gestureDetector.js";
import { HandOverlay } from "./handOverlay.js";
import { AudioFX } from "./audio.js";
import { ConfettiBurst } from "./confetti.js";
import { PERSONAL } from "./personal.js";
import { recordVisit, welcomeMessage, streakBadge } from "./visitTracker.js";
import { showDailyMessage } from "./dailyMessage.js";
import { watchTimeOfDay } from "./timeOfDay.js";
import { AdventCalendar } from "./advent.js";
import { CursorMagnet } from "./cursorMagnet.js";
import { BloomTrail } from "./bloomTrail.js";
import { HeatAura } from "./heatAura.js";
import { MusicPlayer } from "./musicPlayer.js";
import { AmbientEvents } from "./ambientEvents.js";
import { Whispers } from "./whispers.js";
import { LivingBackground } from "./livingBackground.js";
import { Celestial } from "./celestial.js";
import { ZenMode } from "./zenMode.js";
import { GameManager } from "./games/manager.js";
import { CatBehaviorState } from "./ai/catBehaviorState.js";
import { CatEvolution }     from "./ai/catEvolution.js";
import { CatAudio }         from "./audio/catAudio.js";
import { CatInteraction }   from "./interactive/catInteraction.js";
import { SpaceCat }         from "./objects/spaceCat.js";
import { PhotoManager }     from "./photoManager.js";
import { CapsuleManager }   from "./capsuleManager.js";
import { TodoManager }      from "./todoManager.js";

const RING_CIRCUMFERENCE = 106.81; // matches stroke-dasharray in style.css
const BIRTHDAY = { month: 5, day: 27 };   // Như · 27.5

const ui = {
  loader: document.getElementById("loader"),
  startBtn: document.getElementById("start-btn"),
  startGate: document.getElementById("start-gate"),
  startPassword: document.getElementById("start-password"),
  startError: document.getElementById("start-error"),
  indicator: document.getElementById("gesture-indicator"),
  name: document.getElementById("gesture-name"),
  hint: document.getElementById("gesture-hint"),
  video: document.getElementById("webcam"),
  overlayCanvas: document.getElementById("hand-overlay"),
  ringFg: document.querySelector("#hold-ring .ring-fg"),
  bdayCard:  document.getElementById("birthday-counter"),
  bdayLabel: document.querySelector("#birthday-counter .bc-label"),
  bdaySub:   document.querySelector("#birthday-counter .bc-sub"),
  bdayTime:  document.querySelector("#birthday-counter .bc-time"),
  streakChip:  document.getElementById("streak-chip"),
  streakEmoji: document.querySelector("#streak-chip .streak-emoji"),
  streakCount: document.querySelector("#streak-chip .streak-count"),
  streakName:  document.querySelector("#streak-chip .streak-name"),
  adventToggle:        document.getElementById("advent-toggle"),
  adventOverlay:       document.getElementById("advent-overlay"),
  adventGrid:          document.getElementById("advent-grid"),
  adventClose:         document.getElementById("advent-close"),
  adventReveal:        document.getElementById("advent-reveal"),
  adventRevealDay:     document.querySelector("#advent-reveal .reveal-day"),
  adventRevealText:    document.querySelector("#advent-reveal .reveal-text"),
  adventRevealClose:   document.getElementById("advent-reveal-close"),
  poemCard:   document.getElementById("poem-card"),
  poemHeader: document.querySelector("#poem-card .poem-header"),
  poemLines:  document.getElementById("poem-lines"),
  welcomeCard:    document.getElementById("welcome-card"),
  welcomeIcon:    document.querySelector("#welcome-card .welcome-icon"),
  welcomeTitle:   document.querySelector("#welcome-card .welcome-title"),
  welcomeBody:    document.querySelector("#welcome-card .welcome-body"),
  welcomeFoot:    document.querySelector("#welcome-card .welcome-footnote"),
  gestureToggle: document.getElementById("gesture-toggle"),
  gameToggle:    document.getElementById("game-toggle"),
  gameMenu:      document.getElementById("game-menu"),
  gameMenuClose: document.getElementById("game-menu-close"),
  gameContainer: document.getElementById("game-container"),
  gameClose:     document.getElementById("game-close"),
  gameStats:     document.getElementById("game-stats"),
  gameStage:     document.getElementById("game-stage"),

  // Photo manager
  photoToggle:    document.getElementById("photo-toggle"),
  photoOverlay:   document.getElementById("photo-overlay"),
  photoGrid:      document.getElementById("photo-grid"),
  photoDropzone:  document.getElementById("photo-dropzone"),
  photoFileInput: document.getElementById("photo-file-input"),
  photoClose:     document.getElementById("photo-close"),
  photoCount:     document.getElementById("photo-count"),

  // Time capsule
  capsuleToggle:       document.getElementById("capsule-toggle"),
  capsuleOverlay:      document.getElementById("capsule-overlay"),
  capsuleList:         document.getElementById("capsule-list"),
  capsuleNewBtn:       document.getElementById("capsule-new-btn"),
  capsuleClose:        document.getElementById("capsule-close"),
  capsuleCount:        document.getElementById("capsule-count"),
  capsuleWrite:        document.getElementById("capsule-write"),
  capsuleWriteClose:   document.getElementById("capsule-write-close"),
  capsuleWriteTitle:   document.getElementById("capsule-write-title"),
  capsuleWriteBody:    document.getElementById("capsule-write-body"),
  capsuleSaveBtn:      document.getElementById("capsule-save-btn"),
  capsuleWriteError:   document.getElementById("capsule-write-error"),
  capsuleReveal:       document.getElementById("capsule-reveal"),
  capsuleRevealClose:  document.getElementById("capsule-reveal-close"),
  capsuleRevealTitle:  document.getElementById("capsule-reveal-title"),
  capsuleRevealMeta:   document.querySelector("#capsule-reveal .capsule-reveal-meta"),
  capsuleRevealBody:   document.querySelector("#capsule-reveal .capsule-reveal-body"),

  // Daily todo
  todoToggle:  document.getElementById("todo-toggle"),
  todoOverlay: document.getElementById("todo-overlay"),
  todoList:    document.getElementById("todo-list"),
  todoInput:   document.getElementById("todo-input"),
  todoAddBtn:  document.getElementById("todo-add-btn"),
  todoClose:   document.getElementById("todo-close"),
  todoCount:   document.getElementById("todo-count"),

  // Intro cinematic + webcam-fallback demo panel
  intro:       document.getElementById("intro-cinematic"),
  demoPanel:   document.getElementById("demo-panel"),
  demoHide:    document.getElementById("demo-hide"),
  sceneToggle: document.getElementById("scene-toggle"),
};

const GESTURE_LABELS = {
  fist: { name: "Fist", hint: "A whole world in your hand" },
  open_palm: { name: "Open Palm", hint: "Sakura wind · let it bloom" },
  peace: { name: "Peace", hint: "Words for you" },
  thumbs_up: { name: "Like", hint: "A yes from the heart · Như 27.5" },
  none: { name: "—", hint: "Show your hand to the camera" },
};

const sceneManager = new SceneManager(document.getElementById("three-canvas"));
const overlay = new HandOverlay(ui.overlayCanvas);
const audio = new AudioFX();
const confetti = new ConfettiBurst();

// ── Space Cat companion (2D SVG) ───────────────────────────────────────────
// Behavior state is the AI brain (mood scalars → named state). Cat audio
// piggy-backs on AudioFX's context but routes through its own gain bus so
// the user could mute the cat independently. Interaction layer wires DOM
// events → cat target / behavior feeds. The cat itself is a DOM element
// inserted into <body>; we drive its update loop separately from the
// Three.js render loop so 3D pause doesn't freeze the cat unintentionally
// (and vice versa — the cat keeps purring even while a heavy gesture
// dissolves out).
const cat            = new SpaceCat();
const catBehavior    = new CatBehaviorState();
const catEvolution   = new CatEvolution();
const catAudio       = new CatAudio({ volume: 0.45 });
const catInteraction = new CatInteraction({
  cat, behavior: catBehavior, audio: catAudio, evolution: catEvolution,
});
sceneManager.setCat(cat);

// Reflect persisted level on first paint, then listen for level-ups so the
// cat sprouts new accessories the moment XP rolls over a threshold.
function applyCatLevelState() {
  cat.setUnlocks(catEvolution.getUnlocks());
  const lvl = catEvolution.getLevel();
  cat.setLevelLabel(lvl > 0 ? `L${lvl} · ${catEvolution.getName()}` : "");
}
applyCatLevelState();

catEvolution.onLevelUp((newLevel) => {
  applyCatLevelState();
  cat.showLevelUp(`Level ${newLevel} · ${catEvolution.getName()}`);
  catAudio?.chime();
  setTimeout(() => catAudio?.meow("chirp"), 350);
  confetti.burst({ count: 60, duration: 3500 });
});

// Cat update loop — independent rAF chain so the cat can pause/resume
// independently of the 3D scene. Both `cat` and `catInteraction` honour
// pause(); the GameManager pauses both via the `pausables` array below.
let _catLastT = performance.now();
(function catLoop(t) {
    const dt = Math.min((t - _catLastT) / 1000, 0.05);
    _catLastT = t;
    catInteraction.update(dt);
    cat.update(dt, t / 1000);
    requestAnimationFrame(catLoop);
})(performance.now());

// ── Birthday countdown ─────────────────────────────────────────────────────
// Computes time remaining until the next 27.5 (or "today" if it's the day).
// On the actual day the card lights up via the `.today` class.
function updateBirthdayCountdown() {
  if (!ui.bdayCard) return;
  const now  = new Date();
  const year = now.getFullYear();
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const thisYear = new Date(year, BIRTHDAY.month - 1, BIRTHDAY.day);
  if (sameDay(now, thisYear)) {
    ui.bdayLabel.textContent = "HÔM NAY";
    ui.bdaySub.textContent   = "Chúc mừng sinh nhật Như 🎂";
    ui.bdayCard.classList.add("today");
    return;
  }

  // Future target = next upcoming May 27 (this year if not passed yet, else next year).
  const target = now > thisYear
    ? new Date(year + 1, BIRTHDAY.month - 1, BIRTHDAY.day)
    : thisYear;
  const ms      = target - now;
  const days    = Math.floor(ms / 86_400_000);
  const hours   = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms %  3_600_000) /     60_000);

  let label;
  if (days >= 1)        label = `${days} NGÀY · ${hours} GIỜ`;
  else if (hours >= 1)  label = `${hours} GIỜ · ${minutes} PHÚT`;
  else                  label = `${minutes} PHÚT NỮA`;

  ui.bdayLabel.textContent = label;
  ui.bdaySub.textContent   = "Sinh nhật Như · 27.5";
  ui.bdayCard.classList.remove("today");
}

updateBirthdayCountdown();
setInterval(updateBirthdayCountdown, 60_000);

// ── Time-of-day greeting + tonal shift ─────────────────────────────────────
// Background gradient subtly shifts with the hour, and the countdown card
// shows a per-slot greeting. Refreshes every minute so it follows the day.
const TIME_GREETINGS = PERSONAL.timeGreetings ?? {};
watchTimeOfDay((slot) => {
  if (ui.bdayTime) ui.bdayTime.textContent = TIME_GREETINGS[slot.name] ?? "";
});

// ── Main-screen-alive layer ────────────────────────────────────────────────
// Cursor magnet → foreground sparkle dust + click-spawned hearts.
// Ambient events → shooting stars / balloons / paper letters every 18–50s.
// Whispers → random love phrase fades in every 30–60s.
// Living BG → behind the 3D scene; picks one of several scenes per visit
//   (sakura / fireflies / star rain / aurora / drizzle) weighted by season
//   + time of day, so the page never looks identical twice.
// Bound to vars so the GameManager can pause them while a game is running.
const cursorMagnet     = new CursorMagnet({ count: 42 });
const bloomTrail       = new BloomTrail();
const heatAura         = new HeatAura();
const musicPlayer      = new MusicPlayer();
const ambientEvents    = new AmbientEvents({ minDelay: 18_000, maxDelay: 50_000 });
const whispers         = new Whispers({
  phrases: PERSONAL.whispers ?? [],
  minDelay: 30_000,
  maxDelay: 60_000,
});
const livingBackground = new LivingBackground();
const celestial        = new Celestial();
// Zen mode is created paused — armed only after Begin so a hover on the
// password gate can't trigger the breathing guide over the input.
const zenMode = new ZenMode({ idleMs: 30_000, inhaleMs: 4000, exhaleMs: 6000 });
zenMode.pause();

// ── Advent calendar (1.5 → 27.5) ───────────────────────────────────────────
// Toggle button (gift icon) opens a modal grid laid out as a real May 2026
// calendar. Past + today's boxes unlock to reveal a daily note; future boxes
// show a 🔒 with how many days until they open.
const advent = ui.adventToggle && PERSONAL.adventCalendar?.length
  ? new AdventCalendar({
      entries:         PERSONAL.adventCalendar,
      toggle:          ui.adventToggle,
      overlay:         ui.adventOverlay,
      grid:            ui.adventGrid,
      closeBtn:        ui.adventClose,
      reveal:          ui.adventReveal,
      revealDay:       ui.adventRevealDay,
      revealText:      ui.adventRevealText,
      revealCloseBtn:  ui.adventRevealClose,
    })
  : null;

// ── Streak chip ────────────────────────────────────────────────────────────
function updateStreakChip(visit) {
  if (!ui.streakChip || !visit) return;
  const badge = streakBadge(visit.streak);
  ui.streakEmoji.textContent = badge.emoji;
  ui.streakCount.textContent = visit.streak === 1
    ? `1 ngày`
    : `${visit.streak} ngày liên tiếp`;
  ui.streakName.textContent  = badge.name;
  ui.streakChip.hidden = false;

  // Quick celebration glow when the streak grew this visit.
  if (visit.streakIncreased && visit.streak > 1) {
    ui.streakChip.classList.add("celebrating");
    setTimeout(() => ui.streakChip.classList.remove("celebrating"), 4000);
  }
}

// ── Welcome card (visit-counter "remembers her") ───────────────────────────
// Pulls the persisted visit info, picks a tiered greeting, fades the card in
// for ~5 seconds, then fades it out so the main experience can breathe.
function showWelcome() {
  if (!ui.welcomeCard) return;
  const visit = recordVisit();
  const msg   = welcomeMessage(visit);

  // Each fresh visit nudges the cat's XP forward. Capped to once per session
  // by the evolution module.
  catEvolution.noteVisit();

  ui.welcomeIcon.textContent  = msg.icon;
  ui.welcomeTitle.textContent = msg.title;
  ui.welcomeBody.textContent  = msg.body;
  ui.welcomeFoot.textContent  = msg.footnote || "";

  ui.welcomeCard.classList.add("visible");
  setTimeout(() => ui.welcomeCard.classList.remove("visible"), 5000);

  updateStreakChip(visit);

  // Lời nhắn của ngày — appears after the welcome card fades (5.5s delay),
  // stays for ~9s, then quietly retires. Stored deterministically by day-of-year
  // so reopening the page later in the day shows the same line.
  _dailyMsgHandle = showDailyMessage(PERSONAL.dailyMessages, {
    delayMs: 5500,
    holdMs:  9000,
  });
}

// Held so the first gesture lock-in can dismiss the daily card cleanly,
// rather than letting it linger over an active scene.
let _dailyMsgHandle = null;

// Coordinates the brief fade-out / fade-in animation when the gesture-name
// text changes. The CSS handles the visuals; JS just toggles a class around
// the textContent swap so old and new labels don't pop in suddenly.
function setGestureLabel(label) {
  ui.name.classList.add("fading");
  setTimeout(() => {
    ui.name.textContent = label.name;
    ui.name.classList.remove("fading");
  }, 180);
  ui.hint.textContent = label.hint;
}

// ── Poem typewriter ────────────────────────────────────────────────────────
// Each unique gesture she completes types out the next line of the poem.
// Order of lines is fixed (it reads as a flowing poem); the gesture identity
// just decides "do we advance?". Lines that are already typed stay visible.
const POEM = PERSONAL.poem ?? { header: "", lines: [] };
const _completedGestures = new Set();
let _poemTypingPromise = Promise.resolve();   // serialise typing animations

if (ui.poemHeader) ui.poemHeader.textContent = POEM.header || "";

function typewriteInto(el, text, speedMs = 55) {
  return new Promise((resolve) => {
    el.classList.add("typing");
    let i = 0;
    const tick = () => {
      if (i >= text.length) {
        el.classList.remove("typing");
        resolve();
        return;
      }
      el.textContent = text.slice(0, ++i);
      setTimeout(tick, speedMs);
    };
    tick();
  });
}

function isBirthdayToday() {
  const now = new Date();
  return now.getMonth() === BIRTHDAY.month - 1 && now.getDate() === BIRTHDAY.day;
}

function maybeAdvancePoem(gesture) {
  if (!ui.poemCard || !POEM.lines?.length) return;
  if (!isBirthdayToday()) return;
  if (gesture === "none") return;
  if (_completedGestures.has(gesture)) return;
  if (_completedGestures.size >= POEM.lines.length) return;

  _completedGestures.add(gesture);
  const lineIndex = _completedGestures.size - 1;
  const lineText  = POEM.lines[lineIndex];

  if (lineIndex === 0) ui.poemCard.classList.add("visible");

  const lineEl = document.createElement("div");
  lineEl.className = "poem-line";
  ui.poemLines.appendChild(lineEl);

  // Serialise typing animations so multiple rapid gesture changes don't
  // interleave letters across lines.
  _poemTypingPromise = _poemTypingPromise.then(async () => {
    await typewriteInto(lineEl, lineText, 55);
    if (_completedGestures.size === POEM.lines.length) {
      ui.poemCard.classList.add("complete");
      // Small celebratory burst to mark "the letter is finished".
      setTimeout(() => confetti.burst({ count: 80, duration: 3500 }), 500);
      // The cat joins the celebration: zero-G jump + spin, heart burst,
      // soft chime. Fires shortly after the final line finishes typing.
      setTimeout(() => catInteraction.triggerCelebration(), 700);
      catEvolution.noteCelebrate();
    }
  });
}

// ── Warmup gate + open_palm cooldown ───────────────────────────────────────
// Two issues this guards against:
//   1. The user's resting hand pose at the moment of clicking "Begin" often
//      reads as open_palm, which would auto-fire that scene before they're
//      ready. We hold the gate closed for 2s after Begin so any initial pose
//      can't lock in.
//   2. open_palm's LifeOrb-sakura is the heaviest scene in the project and
//      spamming it lags the experience. After it fires once, suppress repeat
//      triggers until BOTH 20s have passed AND the user has performed a
//      different gesture in between.
let _gateOpenAt = Infinity;
let _lastOpenPalmAt = -Infinity;
let _didOtherGestureSinceOpenPalm = true;
const OPEN_PALM_COOLDOWN_MS = 20_000;

function gestureFilter(raw) {
  if (performance.now() < _gateOpenAt) return "none";
  if (raw === "open_palm") {
    const now = performance.now();
    const cooldownActive = now - _lastOpenPalmAt < OPEN_PALM_COOLDOWN_MS;
    if (cooldownActive || !_didOtherGestureSinceOpenPalm) return "none";
  }
  return raw;
}

// Hoisted so demo-mode buttons (when there's no webcam) can fire the same
// flow the gesture detector uses on lock-in.
function handleGestureChange(gesture) {
  // Track open_palm firings for the cooldown gate. Any other non-'none'
  // gesture firing in between satisfies the "different gesture" condition.
  if (gesture === "open_palm") {
    _lastOpenPalmAt = performance.now();
    _didOtherGestureSinceOpenPalm = false;
  } else if (gesture !== "none") {
    _didOtherGestureSinceOpenPalm = true;
  }

  const label = GESTURE_LABELS[gesture] ?? GESTURE_LABELS.none;
  setGestureLabel(label);
  ui.indicator.classList.toggle("active", gesture !== "none");

  // Drive gesture-aware UI tinting via body attributes — CSS variables
  // under body[data-gesture] swap accent colours; the webcam glow lights
  // up while data-active is true.
  document.body.dataset.gesture = gesture;
  document.body.dataset.active  = gesture !== "none" ? "true" : "false";

  if (gesture !== "none") {
    audio.playGestureCue(gesture);
    catEvolution.noteGesture();
  }
  sceneManager.setGesture(gesture);

  // First gesture lock-in dismisses the daily-message card so it doesn't
  // compete with the active scene. No-op if already faded.
  if (gesture !== "none" && _dailyMsgHandle) {
    _dailyMsgHandle.dismiss();
    _dailyMsgHandle = null;
  }

  // Treat any actual gesture as activity for zen-idle purposes — exits
  // zen mode if it was active, and re-arms the idle countdown either way.
  zenMode.noteGesture(gesture);

  // Each unique gesture she lands types out the next line of the poem.
  maybeAdvancePoem(gesture);
}

const detector = new GestureDetector({
  // Confirm a gesture only after 1 seconds of stable hold — the progress ring
  // on the gesture card fills clockwise to show the timer to the user.
  holdMs: 1000,
  gestureFilter,
  onChange: handleGestureChange,
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

// ── Gesture-tracking on/off toggle ─────────────────────────────────────────
// MediaPipe inference is by far the heaviest per-frame work in the experience.
// This button lets the user pause it for a quieter / lower-power session and
// resume when they want gestures back. The choice persists across reloads.
const GESTURE_PAUSED_KEY = "gesture_tracking_paused";
let _userPausedTracker = false;
let _trackerStarted = false;

function applyGestureTrackingState(paused) {
  _userPausedTracker = paused;
  if (_trackerStarted) {
    if (paused) tracker.pause();
    else        tracker.resume();
  }
  if (ui.gestureToggle) {
    ui.gestureToggle.setAttribute("aria-pressed", String(paused));
    ui.gestureToggle.title = paused
      ? "Bật lại nhận diện cử chỉ"
      : "Tạm tắt nhận diện cử chỉ (giảm lag)";
  }
  document.body.classList.toggle("gesture-paused", paused);

  // Pausing tracking is the user asking for a quieter / less-laggy session,
  // so also park the ambient background layers and clear any in-flight
  // animations (sparkles, balloons, shooting stars, paper planes, whispers,
  // confetti, click-hearts). Resume re-arms scheduling for the next round.
  // Background scene + ambient layers stay running regardless of gesture
  // tracking — the toggle is meant to pause heavy MediaPipe inference, not
  // to flatten the page. Confetti is the only thing we eagerly clear so a
  // mid-burst pause doesn't leave 200 paper flakes frozen mid-air.
  if (paused) {
    confetti.clear();
  }

  // Re-arm the warmup gate when re-enabling so a hand that happens to be in
  // frame can't auto-fire a gesture (same logic as just-clicked-Begin).
  if (!paused && _trackerStarted) {
    _gateOpenAt = performance.now() + 2000;
  }
}

if (ui.gestureToggle) {
  ui.gestureToggle.addEventListener("click", () => {
    applyGestureTrackingState(!_userPausedTracker);
    localStorage.setItem(GESTURE_PAUSED_KEY, _userPausedTracker ? "1" : "0");
  });
}

// GameManager calls tracker.pause()/resume() around a running game. We don't
// want the resume on game-exit to clobber a manual user-pause, so wrap the
// tracker in a pausable that respects the user's choice.
const trackerPausable = {
  pause:  () => tracker.pause(),
  resume: () => { if (!_userPausedTracker) tracker.resume(); },
};

// ── Games (Bubble Pop / Heart Catcher / Memory Match) ──────────────────────
// 🎮 toggle opens a menu; selecting a game hides the gesture UI via
// body.game-active and runs the game in its own container until Esc / ✕.
// All gesture-mode systems are paused while a game is running so the game
// loop owns the CPU/GPU. (Must be wired AFTER `tracker` is declared above —
// reading it earlier hits the TDZ.)
if (ui.gameToggle && ui.gameMenu && ui.gameContainer) {
  new GameManager({
    menuToggle:  ui.gameToggle,
    menu:        ui.gameMenu,
    menuClose:   ui.gameMenuClose,
    container:   ui.gameContainer,
    closeBtn:    ui.gameClose,
    statsEl:     ui.gameStats,
    stageEl:     ui.gameStage,
    photos:      PERSONAL.photos ?? [],
    pausables:   [sceneManager, cursorMagnet, bloomTrail, heatAura, musicPlayer, ambientEvents, whispers, livingBackground, celestial, zenMode, trackerPausable, catInteraction, cat],
  });
}

// ── Photo manager (private uploads) + Time capsule (encrypted letters) ────
// Both modules wire themselves to their toggle buttons; PhotoManager also
// dispatches a 'photos:changed' event when the gallery contents change so
// any cached LoveText scene can pick up new photos on its next instantiation.
if (ui.photoToggle && ui.photoOverlay) {
  new PhotoManager({
    toggle:    ui.photoToggle,
    overlay:   ui.photoOverlay,
    grid:      ui.photoGrid,
    fileInput: ui.photoFileInput,
    dropzone:  ui.photoDropzone,
    closeBtn:  ui.photoClose,
    countEl:   ui.photoCount,
  });
}

// Daily todo — IndexedDB-backed list, one set of items per local day. Tick →
// soft confetti + cat XP; emptying the day's list → cat banner + celebration.
if (ui.todoToggle && ui.todoOverlay) {
  new TodoManager({
    toggle:   ui.todoToggle,
    overlay:  ui.todoOverlay,
    list:     ui.todoList,
    input:    ui.todoInput,
    addBtn:   ui.todoAddBtn,
    closeBtn: ui.todoClose,
    countEl:  ui.todoCount,
    onCompleteOne: () => {
      // Cánh hoa rơi — small confetti pop + small XP nudge for the cat.
      confetti.burst({ count: 8, duration: 1800 });
      catEvolution.noteTodo();
    },
    onCompleteAll: (line) => {
      // Final celebration of the day: cat banner + jump + bigger burst.
      cat.showLevelUp(line);
      catInteraction.triggerCelebration();
      confetti.burst({ count: 80, duration: 4000 });
      catAudio?.chime();
    },
  });
}

if (ui.capsuleToggle && ui.capsuleOverlay) {
  new CapsuleManager({
    toggle:      ui.capsuleToggle,
    overlay:     ui.capsuleOverlay,
    list:        ui.capsuleList,
    newBtn:      ui.capsuleNewBtn,
    closeBtn:    ui.capsuleClose,
    countEl:     ui.capsuleCount,
    write:       ui.capsuleWrite,
    writeClose:  ui.capsuleWriteClose,
    writeTitle:  ui.capsuleWriteTitle,
    writeBody:   ui.capsuleWriteBody,
    writeSave:   ui.capsuleSaveBtn,
    writeError:  ui.capsuleWriteError,
    reveal:       ui.capsuleReveal,
    revealClose:  ui.capsuleRevealClose,
    revealTitle:  ui.capsuleRevealTitle,
    revealMeta:   ui.capsuleRevealMeta,
    revealBody:   ui.capsuleRevealBody,
    defaultPassword: "27052002",
  });
}

// Drive the overlay's fade animation independently of MediaPipe's frame cadence.
(function overlayLoop() {
  overlay.draw();
  requestAnimationFrame(overlayLoop);
})();

window.addEventListener("resize", () => sceneManager.resize());
sceneManager.resize();
sceneManager.start();
sceneManager.precompileGestures();

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

// Password gate — birthday DDMM. The hint ("nhập ngày sinh em vào") is shown
// via the input's title tooltip on hover.
const START_PASSWORD = "2705";

// ── Intro cinematic ───────────────────────────────────────────────────────
// Plays once after Begin. CSS owns the keyframes — JS only reveals the
// element, waits ~3.4s (or until the user clicks to skip), then fades out.
// Resolves so beginExperience() can sequence the welcome card after it.
const INTRO_HOLD_MS = 3400;

function playIntroCinematic() {
  const el = ui.intro;
  if (!el) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      el.classList.remove("intro-visible");
      el.classList.add("intro-leaving");
      // Match the 0.7s opacity transition in CSS.
      setTimeout(() => {
        el.hidden = true;
        el.classList.remove("intro-leaving");
        el.removeEventListener("click", finish);
        resolve();
      }, 700);
    };

    el.hidden = false;
    // Force reflow so the visible class triggers the transition.
    void el.offsetWidth;
    el.classList.add("intro-visible");
    el.addEventListener("click", finish);
    setTimeout(finish, INTRO_HOLD_MS);
  });
}

// ── Scene picker · always available after Begin ───────────────────────────
// Left-side 🎬 toggle button + popup panel anchored next to it. Wired
// regardless of webcam status — the user can always preview a scene without
// holding a gesture. Panel starts hidden; the toggle is the entry point.
let _scenePickerWired = false;

function setScenePickerHidden(hidden) {
  document.body.classList.toggle("demo-hidden", hidden);
  ui.sceneToggle?.setAttribute("aria-pressed", hidden ? "false" : "true");
}

function wireScenePicker() {
  if (_scenePickerWired) return;
  _scenePickerWired = true;

  const panel = ui.demoPanel;
  if (!panel) return;

  const buttons = panel.querySelectorAll("button[data-gesture]");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const gesture = btn.dataset.gesture;
      // setGesture() is a no-op when the new gesture matches the current.
      // For replay, route through 'none' first so the same scene dissolves
      // and rebuilds — matches the lived feel of swapping.
      if (gesture !== "none" && document.body.dataset.gesture === gesture) {
        handleGestureChange("none");
        setTimeout(() => handleGestureChange(gesture), 200);
      } else {
        handleGestureChange(gesture);
      }
      buttons.forEach((b) => b.classList.toggle(
        "demo-active",
        b === btn && gesture !== "none",
      ));
    });
  });

  // 🎬 toggle opens/closes the panel; × inside the panel always closes.
  ui.sceneToggle?.addEventListener("click", () => {
    const hidden = document.body.classList.contains("demo-hidden");
    setScenePickerHidden(!hidden);
  });
  ui.demoHide?.addEventListener("click", () => setScenePickerHidden(true));

  // Default: hidden. User must click the toggle to open.
  setScenePickerHidden(true);
}

// ── Demo mode (no webcam available) ───────────────────────────────────────
// Sets body.demo-mode so the webcam preview, hand overlay, indicator and
// gesture-pause toggle are hidden — they have nothing to show. The scene
// picker itself is wired separately by wireScenePicker() and is what the
// user uses to preview scenes in this state.
function enterDemoMode() {
  document.body.classList.add("demo-mode");
  // Auto-open the picker so the user immediately sees how to interact.
  setScenePickerHidden(false);
}

async function beginExperience() {
  try {
    // Open the warmup gate 2s after the click — see gestureFilter above.
    // Long enough that an initial open_palm-shaped hand pose can't auto-fire
    // through the 1s hold timer.
    _gateOpenAt = performance.now() + 2000;
    await audio.unlock();
    // Cat audio shares the same WebAudio graph so there's only one context,
    // but routes through its own gain bus (separate volume from music box).
    await catAudio.unlock({ ctx: audio.ctx, master: audio.master });

    // Hide the password gate and mute every other UI layer for the intro.
    // body.intro-active fades cards/toggles away; gate-locked already hides
    // the right-side toggles from initial HTML.
    ui.startGate.classList.add("hidden");
    setTimeout(() => ui.startGate.remove(), 800);
    document.body.classList.add("intro-active");

    // Music box on now so the first chord overlaps the intro reveal.
    audio.startMusicBox();

    // Run the intro in parallel with tracker.start(). Camera permission
    // prompts can take a few seconds — we don't want to stall the cinematic
    // behind that. If the prompt is denied, we fall through to demo mode.
    const introPromise = playIntroCinematic();

    let webcamFailed = false;
    try {
      // Default: tracking starts paused. Only resume if the user explicitly
      // turned it on in a previous session (stored "0"). This keeps the first
      // visit quiet and low-power; tapping the toggle activates MediaPipe AND
      // requests webcam permission for the first time.
      const initiallyPaused = localStorage.getItem(GESTURE_PAUSED_KEY) !== "0";
      // When initially paused, skip the camera.start() inside tracker.start()
      // so the webcam light never flashes on then off. The model still loads
      // (cheap), but no stream is acquired until the user clicks the toggle.
      await tracker.start({ startCamera: !initiallyPaused });
      _trackerStarted = true;
      applyGestureTrackingState(initiallyPaused);
    } catch (err) {
      console.warn("Webcam unavailable — entering demo mode", err);
      webcamFailed = true;
    }

    // Wait for the intro to finish before revealing chrome / welcome card.
    await introPromise;
    document.body.classList.remove("intro-active");

    // Gate is open — reveal the right-side toggles (game / gesture / photo /
    // capsule). They were hidden via body.gate-locked from initial HTML so
    // they never flash before the password is accepted.
    document.body.classList.remove("gate-locked");

    // Scene picker is always available; default state is hidden behind the
    // floating 🎬 chip. enterDemoMode() additionally hides webcam UI and
    // auto-opens the picker.
    wireScenePicker();
    if (webcamFailed) enterDemoMode();

    // Birthday party arrival: confetti burst the moment the experience begins.
    // A bonus burst fires automatically if today happens to be the actual
    // birthday.
    confetti.burst({ count: 160, duration: 4500 });
    if (ui.bdayCard?.classList.contains("today")) {
      setTimeout(() => confetti.burst({ count: 220, duration: 6000 }), 1200);
    }

    // Greet her based on how many times she's opened this gift.
    showWelcome();

    // Arm zen mode now that the gate is down. Idle countdown starts here.
    zenMode.resume();
  } catch (err) {
    console.error(err);
    document.body.classList.remove("intro-active");
    document.body.classList.remove("gate-locked");
    wireScenePicker();
    enterDemoMode();
  }
}

function rejectPassword(message) {
  if (!ui.startPassword) return;
  ui.startPassword.classList.remove("invalid");
  // Force reflow so the animation can replay if the user retries quickly.
  void ui.startPassword.offsetWidth;
  ui.startPassword.classList.add("invalid");
  ui.startPassword.select();
  if (ui.startError) {
    ui.startError.textContent = message;
    ui.startError.classList.add("visible");
  }
}

function tryStart() {
  const value = (ui.startPassword?.value ?? "").trim();
  if (value !== START_PASSWORD) {
    rejectPassword("Sai rồi · gợi ý: ngày sinh của em");
    return;
  }
  ui.startError?.classList.remove("visible");
  beginExperience();
}

ui.startBtn.addEventListener("click", tryStart);

ui.startPassword?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    tryStart();
  }
});

ui.startPassword?.addEventListener("input", () => {
  ui.startPassword.classList.remove("invalid");
  if (ui.startError?.classList.contains("visible")) {
    ui.startError.classList.remove("visible");
  }
});
