# For Như · A Gesture of Love

A real-time, gesture-driven 3D experience built with **Three.js**, **MediaPipe Hands**, and the **Web Audio API**. Show your hand to the webcam and the scene responds:

| Gesture | Visual |
| --- | --- |
| ✊ Fist | A glowing 3D Earth point cloud rotates slowly with the letters **T & N** embossed on its surface |
| 🖐 Open palm | "Life Release" — the Earth glows, vibrates, then morphs in place into falling sakura petals |
| ✌ Peace | A radiant **"I love you ♥"** forms from a point cloud |
| 🫶 Korean finger heart | A pulsing 3D heart of light with **Như** inside, **Happy birthday babe · Như · 27.5** below |
| 👍 Thumbs up (Like) | Particles gather into a beam of light, then morph into a glowing pink heart that pulses |

Every transition uses a unified particle dissolve/regenerate shader — objects break apart into dust and reform.

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

> First run downloads the MediaPipe Hands model (~7MB) and a Three.js font (~80KB). After that everything is cached.

---

## Project layout

```
index.html
style.css
js/
  main.js                  · entry point, wires everything together
  handTracking.js          · MediaPipe Hands wrapper
  gestureDetector.js       · landmark → gesture classification + debounce
  sceneManager.js          · Three.js scene, bloom, ambient stars, transitions
  audio.js                 · Web Audio synthesised cues
  utils/
    particleMaterial.js    · shared GLSL · form-in / hold / dissolve-out
    fontLoader.js          · cached Three.js font loader
  objects/
    baseObject.js          · lifecycle base class (enter / update / exit / dispose)
    lifeOrb.js             · fist + open palm · single particle system that morphs from
                              Earth (with embossed "T & N") to sakura petals via uPhase
    loveText.js            · peace · "I love you ♥" sampled with MeshSurfaceSampler
    fingerHeart.js         · finger heart · 3D heart + HTML overlay for Vietnamese text
    lightBeamHeart.js      · thumbs up · ambient → beam → heart cinematic, single particle system
```

---

## Adding a new gesture

1. Add detection in `js/gestureDetector.js` → `classify()`.
2. Add a label in `js/main.js` → `GESTURE_LABELS`.
3. Add an audio cue in `js/audio.js` → `playGestureCue` switch.
4. Create a new file in `js/objects/` extending `BaseObject`. Build particle samples with `buildParticleGeometry()` and use `makeParticleMaterial()` so the dissolve transition works for free.
5. Register it in `js/sceneManager.js` → `FACTORIES`.

That's it. The lifecycle handles entry, idle, and dissolve automatically.
