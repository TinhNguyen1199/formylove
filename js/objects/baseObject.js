import * as THREE from 'three';

// Lifecycle contract every gesture object follows. SceneManager swaps these
// in and out; each is responsible for its own form-in / dissolve-out.

export class BaseObject {
    constructor() {
        this.group = new THREE.Group();
        this.material = null;
        this.state = 'idle';      // 'forming' · 'idle' · 'dissolving' · 'done'
        this.formDuration = 1.6;
        this.exitDuration = 1.2;
        this._t = 0;
        this._confidenceTarget = 1.0;   // updated by setConfidence
        this._confidenceSmooth = 1.0;   // lerped each frame to the target
    }

    // Smoothly track live gesture confidence (0..1). The actual uOpacity update
    // happens in update() so it can compose with the dissolve animation rather
    // than fighting it.
    setConfidence(value) {
        const c = Math.max(0, Math.min(1, value));
        // Map to a perceptible-but-gentle range: 60% at zero confidence,
        // full brightness at perfect confidence.
        this._confidenceTarget = 0.6 + 0.4 * c;
    }

    addTo(scene) { scene.add(this.group); }
    removeFrom(scene) { scene.remove(this.group); }

    enter() {
        this.state = 'forming';
        this._t = 0;
        // uDissolve only exists on objects built from the shared particleMaterial.
        // Subclasses with their own uniform scheme (e.g. Sakura) handle their own
        // form-in inside an overridden update().
        if (this.material?.uniforms?.uDissolve) {
            this.material.uniforms.uDissolve.value = 0;
        }
    }

    exit({ gravity = false } = {}) {
        this.state = 'dissolving';
        this._t = 0;
        // Capture starting dissolve in case we exit before fully formed.
        // Full optional chain — material may exist without a uDissolve uniform.
        this._exitFrom = this.material?.uniforms?.uDissolve?.value ?? 1;

        if (gravity && this.material?.uniforms?.uGravity) {
            this.material.uniforms.uGravity.value = 1.0;
            // Give the fall enough time to travel off-screen and fade.
            this.exitDuration = Math.max(this.exitDuration, 2.0);
        }
    }

    update(dt, time, hand, camera) {
        this._t += dt;
        if (this.material?.uniforms?.uTime) this.material.uniforms.uTime.value = time;

        const dissolve = this.material?.uniforms?.uDissolve;
        if (this.state === 'forming') {
            const p = Math.min(this._t / this.formDuration, 1);
            if (dissolve) dissolve.value = p;
            if (p >= 1) this.state = 'idle';
        } else if (this.state === 'dissolving') {
            const p = Math.min(this._t / this.exitDuration, 1);
            if (dissolve) dissolve.value = 1 + p;
            if (p >= 1) this.state = 'done';
        }

        // Confidence-driven opacity, only while the object is live.
        // While dissolving we leave uOpacity alone so the shader's fade controls it.
        if (this.material?.uniforms?.uOpacity && this.state !== 'dissolving') {
            this._confidenceSmooth += (this._confidenceTarget - this._confidenceSmooth) * 0.12;
            this.material.uniforms.uOpacity.value = this._confidenceSmooth;
        }

        this.onUpdate(dt, time, hand, camera);
    }

    onUpdate(_dt, _time, _hand, _camera) { /* override */ }

    isDone() { return this.state === 'done'; }

    dispose() {
        this.group.traverse((node) => {
            if (node.geometry) node.geometry.dispose();
            if (node.material) {
                if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
                else node.material.dispose();
            }
        });
    }
}
