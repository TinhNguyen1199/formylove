# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A real-time, gesture-driven 3D experience built as a personal birthday gift. The user makes a hand gesture in front of their webcam and the scene transforms accordingly. Five gestures (`fist`, `open_palm`, `peace`, `finger_heart`, `thumbs_up`) each map to a distinct cinematic scene.

## Running the project

There is **no build step and no package.json by design**. Three.js and MediaPipe are loaded from CDN via an `<script type="importmap">` in `index.html` (for `three` / `three/addons/`) and `<script>` tags (for the MediaPipe browser globals `Hands` and `Camera`). Webcam access requires `http(s)://` (not `file://`), so any dev session needs a local server:

```powershell
cd D:\source\project\birthDay
python -m http.server 8080      # any of these works
npx --yes serve -l 8080 .
php -S localhost:8080
```

Then open <http://localhost:8080> in Chrome or Edge.

There are no tests and no linter. Verification commands used during development:

```bash
# Syntax-check every ES module (treats stdin as ESM since files use bare `import` specifiers)
for f in js/**/*.js; do
  node --input-type=module --check < "$f" 2>&1 | head -3
done
```

UI/feature changes can only be verified by serving and using the experience in a browser with a working webcam — type-checking and import-graph validation can't see whether a shader compiles or a gesture fires.

## Architecture

### Layer responsibilities

```
main.js            entry — wires the four subsystems together
  ├── handTracking.js       MediaPipe Hands wrapper (selfieMode: true)
  ├── gestureDetector.js    landmarks → {gesture, confidence, holdProgress}
  ├── handOverlay.js        skeleton drawn on canvas overlaying webcam preview
  └── sceneManager.js       Three.js scene + composer + gesture object lifecycle
        └── objects/*.js    one class per gesture, all extend BaseObject
```

`main.js` is the **only** place these layers see each other. Detector emits via `onChange(gesture)` (debounced state transitions) and `onTick({current, currentConfidence, holdProgress, ...})` (every frame). The two callbacks together feed: scene swaps, gesture-card label, hold-progress ring fill, scene-confidence opacity fade, and audio cues.

### The gesture-object lifecycle (BaseObject)

Every gesture's visual is a `BaseObject` subclass in `js/objects/`. SceneManager calls these methods in this order:

```
factory() → addTo(scene) → enter() → update(dt, t, hand, camera) [each frame]
                                  → setConfidence(0..1)        [each frame]
                                  → exit({gravity}) [on swap]
                                  → isDone()        [each frame after exit]
                                  → removeFrom(scene)
                                  → dispose()
```

State machine: `'forming' → 'idle' → 'dissolving' → 'done'`. `BaseObject.update()` advances `uDissolve` (forming 0→1, dissolving 1→2) and lerps `uOpacity` from `_confidenceTarget`.

### Two distinct shader conventions — and the trap they create

There are **two uniform schemes** in this codebase. Mixing them up has crashed the system before:

1. **Shared particleMaterial** (`utils/particleMaterial.js`) — used by `LoveText`, `FingerHeart`. Provides `uTime`, `uDissolve` (0→1→2 form/dissolve curve), `uPointScale`, `uScatter`, `uBreath`, `uOpacity`, `uGravity`. `BaseObject.update()` drives `uDissolve` automatically.

2. **Custom per-object shaders** — used by `LifeOrb`, `LightBeamHeart`. They have **no `uDissolve`**; they use object-specific uniforms (`uPhase`, `uForm`, `uPulse`, `uBeamGlow`, etc.) and **override `update()` entirely**.

Because of this split, **any uniform access in `BaseObject.{enter,exit,update}` must be fully optional-chained** (`this.material?.uniforms?.uDissolve?.value`). Setting `material.uniforms.uDissolve.value = 0` directly will throw on objects that don't expose it, and the throw silently orphans the freshly-created object in the scene (`setGesture` aborts before `this.current = obj`). When debugging "gesture X stops working," check this first.

### Scene swap vs in-place morph

`SceneManager.setGesture()` has two paths. The default path dissolves the current object (with `gravity: true` if the new gesture is `'none'`) and creates a new one. **Special path**: if `this.current.canMorphTo(newGesture)` returns true, the current object stays and morphs in place via `requestMorph()`. Currently only `LifeOrb` implements this for `fist → open_palm` ("Life Release") — same particles transform from Earth into falling sakura.

When adding gestures that should share an underlying particle system across transitions, follow this pattern. Otherwise, a new factory entry in `FACTORIES` is sufficient.

### The unified-particle-system pattern

`LifeOrb` and `LightBeamHeart` both use the same trick: each particle carries **multiple target positions** (`aIdlePos` / `aBeamPos` / `aHeartPos`, or `position` / `aSakuraXZ`), and a single `uPhase` uniform morphs continuously between them in the shader. Smoothstep at every interpolation segment keeps velocity continuous. The `position` attribute may be unused (just zeros) — Three.js requires it for buffer geometry but the shader can compute everything from custom attributes.

### Confidence pipeline

`gestureDetector` emits a live confidence (0..1) per frame for the **currently locked-in** gesture (not the candidate). `BaseObject.setConfidence()` maps it to `0.6 .. 1.0` opacity range and lerps for smoothness. Drives `uOpacity` (or `uConfidence` on custom-shader objects). The hold-progress ring is independent — it tracks how long the *candidate* has been stable, not the active object's pose quality.

### Async font loading

`LoveText` and `LifeOrb` need `helvetiker_regular.typeface.json` which is async. They expose a `_disposed` flag set in `dispose()` so the late-arriving font + sample doesn't write into a Points object whose group has already been removed from the scene. Always check `if (this._disposed) return` after each `await` and after each long synchronous build phase.

## Project-specific quirks

- **MediaPipe `selfieMode: true`** mirrors landmarks at the source, matching the CSS-mirrored `<video>` element. Drawing those landmarks on a non-mirrored overlay canvas places dots correctly. Don't add additional mirroring or coordinates will be flipped.
- **Vietnamese text** isn't in the helvetiker font. `FingerHeart` renders "Như" and the birthday line as HTML elements positioned by projecting world anchors to screen each frame — see `_positionOverlays()`. Don't try to render `ư` via `TextGeometry`.
- **The girlfriend's name and birthday** ("Như · 27.5") appear in `js/main.js` (gesture hint) and `js/objects/fingerHeart.js` (overlay HTML). Both must stay in sync.
- **`frustumCulled` is left enabled** for all Points objects even when the geometry's `position` attribute is zeros. The bounding sphere collapses to a point at origin, which the camera frustum always contains, so culling never fires incorrectly. If you add an object that drifts far from origin via shader-computed position, set `points.frustumCulled = false`.
- **Bloom + DoF tuning is intentionally restrained**. The user has explicitly asked twice to soften brightness — bloom is `strength 0.35, threshold 0.28`, exposure 0.85, BokehPass aperture `0.00003`. Particle palettes never reach pure white. Don't bump these without asking.
