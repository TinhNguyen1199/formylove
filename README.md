# For Như · A Gesture of Love

A real-time, gesture-driven 3D experience built with **Three.js**, **MediaPipe Hands**, and the **Web Audio API**. Show your hand to the webcam and the scene responds:

| Gesture                | Visual                                                                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✊ Fist                | A sparse emerald-green point-cloud Earth, half-Lambert lit, with the letters **T & N** embossed in warm cream-gold, wrapped by a thin orbital stardust ring + soft mint-cyan halo |
| 🖐 Open palm           | "Life Release" — the Earth glows, pulses inward, then morphs in place into a wide field of falling sakura petals                                                                  |
| ✌ Peace                | A radiant **"I love you ♥"** point cloud, surrounded by floating polaroid photos of memories                                                                                      |
| 🫶 Korean finger heart | A pulsing 3D heart of light with **Như** inside, **Happy birthday babe · Như · 27.5** below                                                                                       |
| 👍 Thumbs up (Like)    | Same FingerHeart effect — a yes from the heart                                                                                                                                    |

Every transition uses a unified particle dissolve/regenerate shader — objects break apart into dust and reform.

---

## Birthday touches 🎂

Layered onto the gesture experience are personal birthday details for **Như**:

- **🔑 Password gate** — Begin only unlocks when she types her birthday `DDMMYYYY` (`27052002`). Wrong input shakes the field with a hint "gợi ý: ngày sinh của em". The same password unlocks new time capsules by default.
- **🎉 Confetti burst** when you click **Begin** — paper rectangles spray inward from both sides, gravity-driven fall, soft fade.
- **🎵 Music box loop** — a synthesised 16-note ostinato in C major, fades in/out independently of gesture cues.
- **📅 Birthday countdown** — bottom-right card counts down to **27.5**. On the actual day it lights up with `HÔM NAY · Chúc mừng sinh nhật Như 🎂` and triggers a bonus confetti burst.
- **🌅 Time-of-day greeting** — the countdown card carries a per-slot greeting (sáng / trưa / chiều / tối / khuya) that follows the wall clock and refreshes every minute.
- **🔥 Daily streak chip** — top corner chip shows how many consecutive days she's opened the gift, with tier names (`Mới bắt đầu`, `Đang giữ lửa`, `Trái tim sắt`, `Tinh tú`…). Streak grows when she returns the next day, resets if she misses one, and the chip flashes a soft "celebrating" glow when it grows.
- **🎁 Advent calendar (1.5 → 27.5)** — gift-icon button opens a modal grid laid out as the real May 2026 calendar. Past + today's boxes unlock to reveal a daily love note; future boxes show 🔒 with "X ngày nữa". Today's box gently pulses to signal something new.
- **💌 Daily message of the day** — a short line picked deterministically by day-of-year from `PERSONAL.dailyMessages`. Fades in 5.5s after the welcome card, holds ~9s, dismisses on the first locked-in gesture.
- **📜 Poem typewriter** — a 5-line poem that types out one line per _unique_ gesture completed (only on the actual birthday — `27.5`). Card on the left, Cormorant Garamond italic, blinking caret while typing. After the 5th line, the card glows softly and a celebratory confetti bursts.
- **📸 Polaroid gallery** — when the **peace** gesture fires, 5–7 photos drop into a soft oval around the "I love you" text as floating polaroids (cream paper, classic asymmetric border, slight scattered tilt). Picks up new uploads from the photo manager automatically.
- **🪄 Visit counter** — localStorage-backed greeting card after **Begin**: tiered messages from "Chào em · 27.5" on the first visit, through `Lần thứ X · em yêu trang này hơn cả anh à? 😄`, up to a `👑` devotee tier. Footnote shows when she last visited (e.g. "Lần trước em ghé hôm qua, 21:34").
- **🎨 Gesture-aware UI palette** — UI accents (gesture indicator, hold ring, webcam glow, countdown card border, poem card border) re-tint to harmonise with whichever scene is active: green for fist, soft pink for sakura, lavender for peace, brand rose for the heart gestures.
- **✍️ Typography** — gesture name + countdown + poem use **Cormorant Garamond** (Google Fonts) for an editorial / love-letter feel; `#gesture-name` fades-and-slides between values when the gesture changes.
- **🪟 Webcam treatment** — soft radial mask so edges fade organically into the page; default opacity 0.38, glows up to 0.55 with an accent-coloured halo while a gesture is active.
- **⏸ Gesture-tracking toggle** — a button lets her pause MediaPipe inference for a quieter / lower-power session and resume when she wants gestures back. Choice persists across reloads. Re-arms the warmup gate on resume so a hand already in frame can't auto-fire a scene.

---

## A page that stays alive ✨

Layered _between_ the 3D gesture canvas and the foreground UI, a few quiet systems make the page feel inhabited even when no hand is in frame. All of them honour `pause()` / `resume()` so the GameManager can silence them while a mini-game is running.

- **🌌 Living background** — a low-z canvas behind the Three.js scene picks one of five ambient scenes per visit (`sakura` / `fireflies` / `starrain` / `aurora` / `drizzle`). Selection is weighted by real-world season + time of day — sakura favours March–May, aurora favours night, fireflies favour dusk — so the page never opens looking the same way twice.
- **☄ Celestial layer** — adds a layer of slow-drifting twinkling specks behind everything else, regardless of which living-bg scene won the dice roll. Keeps the page from looking too still on top of the bg scene.
- **✨ Cursor magnet** — 42 sparkle particles drift toward the mouse pointer with a soft spring, brightening when the cursor stops. Clicking spawns a small heart that floats up and fades.
- **🎈 Ambient events** — every 18–50s something gentle happens: a shooting star, a balloon drifting up, a paper letter flying across. Easy to ignore, lovely to catch.
- **💭 Whispers** — every 30–60s a random love phrase from `PERSONAL.whispers` fades in at a quiet corner, holds, then drifts away. Pure CSS; never blocks input.
- **🧘 Zen mode** — after **30s of true idle** (no gesture lock, no mouse movement) a soft breathing guide appears centre-screen with a 4s inhale / 6s exhale loop and rotating Vietnamese cues ("Hít vào · thở ra"). Any mouse move or new gesture lock dismisses it instantly. Armed only after the password gate is cleared so it can't appear over the password input.

---

## Space Cat companion 🐱

A cute SVG cat that lives in screen space (DOM, not Three.js) and follows along with the experience. Drawn at z-index just under the gesture UI so it's always visible without blocking the scene.

- **AI brain** (`js/ai/catBehaviorState.js`) — mood scalars (curiosity, affection, energy) → named state (`idle` / `playful` / `sleepy` / `excited`). Drives ear flicks, blinks, tail sway, gaze direction.
- **Interaction layer** (`js/interactive/catInteraction.js`) — wires DOM events to the cat: pet on click, gaze follows the cursor, heart bursts on long pets, ZZZ on sleep, celebration jump + spin on poem completion.
- **Evolution** (`js/ai/catEvolution.js`) — XP from visits / pets / unique gesture lock-ins / celebrations. 6 levels (`Mèo con` → `Mèo nhỏ` → `Mèo bạn` → `Mèo thân` → `Mèo iu` → `Mèo nhà` → `Tinh tú`), each unlocking an accessory: **halo · bow · pendant · hat · scarf · crown** (crown replaces hat at L6). Persists across sessions; level-up triggers a chime + meow + 60-particle confetti.
- **Audio bus** (`js/audio/catAudio.js`) — synthesised meows / chirps / chimes routed through a separate gain node off the main `AudioFX` graph, so the cat could be muted independently of the music box.
- **Independent loop** — the cat has its own `requestAnimationFrame` chain so a paused gesture pipeline (or a heavy scene dissolve) doesn't freeze its breath/tail micro-motion.

---

## Mini-games 🎮

A 🎮 toggle opens a small menu of three pointer-driven games. Selecting one hides the gesture UI via `body.game-active`, pauses everything pausable (scene, ambient layers, MediaPipe, cat) so the game owns the CPU/GPU, and runs until **Esc** or **✕**.

- **🫧 Bubble Pop** — bubbles drift up; click to pop. Every 10 pops grows a multiplier; combo decays if you stop clicking.
- **💖 Heart Catcher** — 5-lane mouse-follow paddle catching falling items. Tiers: heart (1pt) · petal (2pt) · star (3pt) · rare "Như" diamond (10pt). 3 misses = game over. No-miss streak grows the multiplier. Spawning is staggered both per-lane and globally so items never visually stack.
- **🧩 Memory Match** — flip-card pairs game using her own photos from the photo manager (falls back to symbol pairs if she hasn't uploaded any).

Per-game high scores persist to `localStorage`.

---

## Private uploads & encrypted letters 🔐

Two small modal apps tucked behind toolbar buttons. Both store everything on-device — nothing leaves the browser.

- **📷 Photo manager** (`js/photoManager.js` + `js/photoStore.js`) — drag-and-drop photos, stored in **IndexedDB** as blobs (so they survive refreshes without bloating localStorage). Dispatches a `photos:changed` event so the next time the **peace** gesture instantiates `LoveText`, the polaroid gallery refreshes with the new uploads. Memory Match also reads from this pool.
- **💌 Time capsule** (`js/timeCapsule.js` + `js/capsuleManager.js`) — em writes a letter to her future self; content is encrypted in the browser using **AES-GCM** with a key derived from a password via **PBKDF2-SHA256 (200 000 iterations)**. Each capsule has an `unlockAt` date (default: 27.5 next year). Locked capsules show a 🔒 with the date; only after the unlock date passes does the password input appear. Default password matches the start gate (`27052002`). Ciphertext, IV and salt live in `localStorage`.

---

## Personalize for someone 💌

All personal data lives in a single file: **`js/personal.js`**.

```js
export const PERSONAL = {
  photos: ["photos/01.jpg" /* … 5–7 portrait photos work best */],
  poem: {
    header: "Gửi Như · 27.5",
    lines: [
      /* 5 lines */
    ],
  },
  adventCalendar: ["1.5 — …", "2.5 — …" /* … through "27.5 — …" */],
  dailyMessages: [
    /* one-line love notes; one shown per day-of-year */
  ],
  whispers: [
    /* short phrases that fade in every 30–60s */
  ],
  timeGreetings: { dawn: "...", morning: "...", noon: "..." /* etc. */ },
};
```

| Key              | What it drives                                                                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `photos`         | Polaroid gallery (peace gesture) — pre-bundled JPGs in `photos/`. Missing files are skipped silently. Portrait, ~800–1200 px on the long side. |
| `poem`           | Five-line poem typed out on the actual birthday, one line per unique gesture lock-in. Order is fixed, so write it as a flowing poem.           |
| `adventCalendar` | 27 entries · `"D.5 — text"` · one for each day of May leading up to her birthday. Past + today's boxes unlock; future boxes show 🔒.           |
| `dailyMessages`  | Daily card shown after the welcome card. Picked deterministically by day-of-year, so reopening the page later in the day shows the same line.  |
| `whispers`       | Random love phrases used by the whispers layer. Keep them short — one line each.                                                               |
| `timeGreetings`  | Per-time-slot subtitle on the countdown card (e.g. `morning: "Chào buổi sáng em yêu"`).                                                        |

The password gate (`27052002` = `DDMMYYYY` of her birthday) lives in `js/main.js` → `START_PASSWORD`, and is reused as the time-capsule default in `js/main.js` → `CapsuleManager({ defaultPassword })`. Change both if you swap recipients.

The girlfriend's name (`Như`) and birthday (`27.5`) also appear in:

- `js/main.js` — `GESTURE_LABELS` hint texts, `BIRTHDAY` constant, `START_PASSWORD`
- `js/objects/fingerHeart.js` — HTML overlay
- `index.html` — `#birthday-counter .bc-sub`
- `js/visitTracker.js` — welcome messages
- `js/advent.js` — `BIRTHDAY_MONTH` / `BIRTHDAY_DAY` / `TARGET_YEAR`
- `js/timeCapsule.js` — `BIRTHDAY_MONTH_INDEX` / `BIRTHDAY_DAY` for default unlock dates

Keep these in sync if you swap the recipient.

---

## Run it

The webcam API requires `https://` or `http://localhost`, so you need a local server. Pick whichever you have:

```powershell
# Option A · Python (any version)
python -m http.server 8080

# Option B · Node 18+ (no install)
npx --yes serve -l 8080 .

# Option C · PHP
php -S localhost:8080
```

Then open <http://localhost:8080> in **Chrome / Edge**, click **Begin**, and grant camera access.

> First run downloads the MediaPipe Hands model (~7MB), Three.js fonts (~80–160KB depending on which gestures fire), and Cormorant Garamond. After that everything is cached.

---

## Project layout

```
index.html
style.css
photos/                      · drop personal JPGs here (see js/personal.js)
js/
  main.js                    · entry point, wires everything together
  personal.js                · single source of truth for personal data (photos, poem, …)
  handTracking.js            · MediaPipe Hands wrapper
  gestureDetector.js         · landmark → gesture classification + debounce
                                (uses thumb-abduction signal for robust open_palm / thumbs_up)
  sceneManager.js            · Three.js scene, bloom, ambient stars, camera parallax, transitions
  audio.js                   · Web Audio synthesised cues + ambient music-box loop
  confetti.js                · 2D canvas confetti overlay (paper rectangles + gravity)
  visitTracker.js            · localStorage visit counter, streak tracking, tiered welcome
  dailyMessage.js            · daily love-note card (deterministic by day-of-year)
  timeOfDay.js               · watcher that reports the current slot (morning/noon/…)
  advent.js                  · May 1.5 → 27.5 advent calendar modal
  cursorMagnet.js            · drifting sparkle particles that follow the cursor; click → heart
  ambientEvents.js           · scheduled shooting stars / balloons / paper letters
  whispers.js                · random Vietnamese love phrases that fade in/out
  livingBackground.js        · low-z canvas · sakura/fireflies/starrain/aurora/drizzle, season-weighted
  celestial.js               · slow-drifting twinkles behind everything
  zenMode.js                 · idle-triggered breathing guide (4s in / 6s out)
  photoStore.js              · IndexedDB blob store for private uploads
  photoManager.js            · drag-and-drop modal for managing photos; emits 'photos:changed'
  timeCapsule.js             · AES-GCM/PBKDF2 encryption primitives for letters
  capsuleManager.js          · modal UI for writing / unlocking time capsules
  utils/
    particleMaterial.js      · shared GLSL · form-in / hold / dissolve-out
    fontLoader.js            · cached Three.js font loader · helvetiker + gentilis_bold
  ai/
    catBehaviorState.js      · mood scalars → named cat state
    catEvolution.js          · XP, levels, accessory unlocks, level-up events
  audio/
    catAudio.js              · meow/chirp/chime synth on its own gain bus
  interactive/
    catAnimations.js         · idle scheduler + easing for cat micro-motion
    catInteraction.js        · DOM events → cat target / behavior / celebration
  games/
    manager.js               · 🎮 menu, body.game-active toggle, pausable orchestration
    bubblePop.js             · click bubbles for combo points
    heartCatcher.js          · 5-lane mouse-paddle catcher; hearts/petals/stars/Như diamond
    memoryMatch.js           · flip-card pairs using uploaded photos
  objects/
    baseObject.js            · lifecycle base class (enter / update / exit / dispose)
    lifeOrb.js               · fist + open palm · single particle system that morphs from
                                 emerald Earth (with embossed "T & N") to sakura petals via uPhase;
                                 includes orbital ring + fresnel atmospheric halo
    loveText.js              · peace · "I love you ♥" + PhotoGallery polaroids
    photoGallery.js          · async-loaded polaroid sprites composited on a canvas; oval layout
                                 (reads from PERSONAL.photos + IndexedDB uploads)
    fingerHeart.js           · finger heart + thumbs up · 3D heart + HTML overlay for Vietnamese text
    spaceCat.js              · DOM/SVG cat companion · breath, blink, gaze, accessories, ZZZ
    lightBeamHeart.js        · (legacy) cinematic beam → heart, no longer registered as a factory
```

---

## Tunable details

The visual feel of the project has been heavily tuned. A few values worth knowing about before you nudge them:

- **Bloom + DoF + exposure** (`sceneManager.js`) — `strength 0.35`, `threshold 0.28`, `exposure 0.85`, `BokehPass aperture 0.00003`. Particle palettes never reach pure white. The brightness was deliberately softened twice; lifting these values makes the scene feel candy/neon.
- **Hold-to-confirm** (`main.js` → `holdMs`) — currently 1000 ms. The hold-progress ring on the gesture card fills clockwise to telegraph the timer.
- **Sakura wind density** (`lifeOrb.js`) — `SAKURA_VISIBLE_RATIO = 0.72`; only that fraction of body particles participate in petal mode, so Earth can stay sparse without thinning the wind.
- **Polaroid layout** (`photoGallery.js`) — oval `xRadius 6.0 × yRadius 2.7` with sprite scale `1.35 × 1.6`. Designed so polaroids never overlap the central "I love you" text bbox.
- **Open-palm cooldown** (`main.js` → `OPEN_PALM_COOLDOWN_MS`) — 20 s. After the heaviest scene fires, repeats are suppressed until both that timer expires AND a different gesture has been performed in between. Keeps the experience smooth on lower-end laptops.
- **Zen idle threshold** (`main.js` → `ZenMode({ idleMs: 30_000 })`) — 30 s of no gesture lock + no mouse movement before the breathing guide appears. Inhale 4 s / exhale 6 s.
- **Cat XP rates** (`ai/catEvolution.js`) — visit `+20` (once per session), pet `+2` (capped 60/session), gesture lock `+5`, celebration `+30`. Level thresholds: `[0, 50, 150, 350, 700, 1200, 2000]`.

---

## Adding a new gesture

1. Add detection in `js/gestureDetector.js` → `classify()`.
2. Add a label in `js/main.js` → `GESTURE_LABELS`.
3. Add an audio cue in `js/audio.js` → `playGestureCue` switch.
4. Create a new file in `js/objects/` extending `BaseObject`. Build particle samples with `buildParticleGeometry()` and use `makeParticleMaterial()` so the dissolve transition works for free.
5. Register it in `js/sceneManager.js` → `FACTORIES`.
6. (Optional) Add a per-gesture accent palette in `style.css` under `body[data-gesture="<name>"]`.

That's it. The lifecycle handles entry, idle, and dissolve automatically.
