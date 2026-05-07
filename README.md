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

- **🎉 Confetti burst** when you click **Begin** — paper rectangles spray inward from both sides, gravity-driven fall, soft fade.
- **🎵 Music box loop** — a synthesised 16-note ostinato in C major, fades in/out independently of gesture cues.
- **📅 Birthday countdown** — bottom-right card counts down to **27.5**. On the actual day it lights up with `HÔM NAY · Chúc mừng sinh nhật Như 🎂` and triggers a bonus confetti burst.
- **📜 Poem typewriter** — a 5-line poem that types out one line per _unique_ gesture completed. Card on the left, Cormorant Garamond italic, blinking caret while typing. After the 5th line, the card glows softly and a celebratory confetti bursts.
- **📸 Polaroid gallery** — when the **peace** gesture fires, 5–7 photos drop into a soft oval around the "I love you" text as floating polaroids (cream paper, classic asymmetric border, slight scattered tilt).
- **🪄 Visit counter** — localStorage-backed greeting card after **Begin**: tiered messages from "Chào em · 27.5" on the first visit, through `Lần thứ X · em yêu trang này hơn cả anh à? 😄`, up to a `👑` devotee tier. Footnote shows when she last visited (e.g. "Lần trước em ghé hôm qua, 21:34").
- **🎨 Gesture-aware UI palette** — UI accents (gesture indicator, hold ring, webcam glow, countdown card border, poem card border) re-tint to harmonise with whichever scene is active: green for fist, soft pink for sakura, lavender for peace, brand rose for the heart gestures.
- **✍️ Typography** — gesture name + countdown + poem use **Cormorant Garamond** (Google Fonts) for an editorial / love-letter feel; `#gesture-name` fades-and-slides between values when the gesture changes.
- **🪟 Webcam treatment** — soft radial mask so edges fade organically into the page; default opacity 0.38, glows up to 0.55 with an accent-coloured halo while a gesture is active.

---

## Personalize for someone 💌

All personal data lives in a single file: **`js/personal.js`**.

```js
export const PERSONAL = {
  photos: [
    "photos/01.jpg",
    // … 5–7 portrait photos work best
  ],
  poem: {
    header: "Gửi Như · 27.5",
    lines: ["Em ơi, hôm nay là ngày 27.5,"],
  },
};
```

**Photos** — drop JPGs into the `photos/` folder, list paths in `PERSONAL.photos`. Missing files are skipped silently. Portrait orientation, ~800–1200 px on the long side.

**Poem** — five lines that read as a flowing poem. Each unique gesture she completes types out the next line; order is fixed regardless of which gesture she discovers first.

The girlfriend's name (`Như`) and birthday (`27.5`) also appear in:

- `js/main.js` — `GESTURE_LABELS` hint texts
- `js/objects/fingerHeart.js` — HTML overlay
- `index.html` — `#birthday-counter .bc-sub`
- `js/visitTracker.js` — welcome messages

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
  visitTracker.js            · localStorage visit counter + tiered welcome messages
  utils/
    particleMaterial.js      · shared GLSL · form-in / hold / dissolve-out
    fontLoader.js            · cached Three.js font loader · helvetiker + gentilis_bold
  objects/
    baseObject.js            · lifecycle base class (enter / update / exit / dispose)
    lifeOrb.js               · fist + open palm · single particle system that morphs from
                                 emerald Earth (with embossed "T & N") to sakura petals via uPhase;
                                 includes orbital ring + fresnel atmospheric halo
    loveText.js              · peace · "I love you ♥" + PhotoGallery polaroids
    photoGallery.js          · async-loaded polaroid sprites composited on a canvas; oval layout
    fingerHeart.js           · finger heart + thumbs up · 3D heart + HTML overlay for Vietnamese text
    lightBeamHeart.js        · (legacy) cinematic beam → heart, no longer registered as a factory
```

---

## Tunable details

The visual feel of the project has been heavily tuned. A few values worth knowing about before you nudge them:

- **Bloom + DoF + exposure** (`sceneManager.js`) — `strength 0.35`, `threshold 0.28`, `exposure 0.85`, `BokehPass aperture 0.00003`. Particle palettes never reach pure white. The brightness was deliberately softened twice; lifting these values makes the scene feel candy/neon.
- **Hold-to-confirm** (`main.js` → `holdMs`) — currently 1000 ms. The hold-progress ring on the gesture card fills clockwise to telegraph the timer.
- **Sakura wind density** (`lifeOrb.js`) — `SAKURA_VISIBLE_RATIO = 0.72`; only that fraction of body particles participate in petal mode, so Earth can stay sparse without thinning the wind.
- **Polaroid layout** (`photoGallery.js`) — oval `xRadius 6.0 × yRadius 2.7` with sprite scale `1.35 × 1.6`. Designed so polaroids never overlap the central "I love you" text bbox.

---

## Adding a new gesture

1. Add detection in `js/gestureDetector.js` → `classify()`.
2. Add a label in `js/main.js` → `GESTURE_LABELS`.
3. Add an audio cue in `js/audio.js` → `playGestureCue` switch.
4. Create a new file in `js/objects/` extending `BaseObject`. Build particle samples with `buildParticleGeometry()` and use `makeParticleMaterial()` so the dissolve transition works for free.
5. Register it in `js/sceneManager.js` → `FACTORIES`.
6. (Optional) Add a per-gesture accent palette in `style.css` under `body[data-gesture="<name>"]`.

That's it. The lifecycle handles entry, idle, and dissolve automatically.
