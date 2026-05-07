import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass }      from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js';

import { LifeOrb }        from './objects/lifeOrb.js';
import { LoveText }       from './objects/loveText.js';
import { FingerHeart }    from './objects/fingerHeart.js';

// Both fist and open_palm map to LifeOrb — same particle system, two initial
// modes. Fist→open_palm uses the in-place "Life Release" morph (see setGesture).
// thumbs_up shares FingerHeart so the "Like" gesture lands on the same heart
// of light as the finger-heart pose.
const FACTORIES = {
    fist:         () => new LifeOrb('earth'),
    open_palm:    () => new LifeOrb('sakura'),
    peace:        () => new LoveText(),
    finger_heart: () => new FingerHeart(),
    thumbs_up:    () => new FingerHeart(),
};

export class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;

        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.85;

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x0a0612, 0.018);

        this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
        this.camera.position.set(0, 0, 9);

        // Cinematic ambience: a quiet star field that does NOT swap with gestures.
        this._buildAmbience();

        // Postprocessing pipeline:
        //   render → DoF (slight, focuses on subject depth) → bloom → output
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));

        // Slight depth-of-field. Aperture is intentionally small: our particles
        // use depthWrite: false, so the depth buffer is sparse — heavy DoF would
        // look noisy. A whisper of focus shift is enough for cinematic feel.
        this.bokeh = new BokehPass(this.scene, this.camera, {
            focus:    9.0,
            aperture: 0.00003,
            maxblur:  0.0028,
        });
        this.composer.addPass(this.bokeh);

        // Strength · radius · threshold. Lower strength + higher threshold = a hint of
        // glow only on the brightest specks; broad areas stay matte and easy on the eyes.
        this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.35, 0.5, 0.28);
        this.composer.addPass(this.bloom);
        this.composer.addPass(new OutputPass());

        this.clock = new THREE.Clock();

        this.currentGesture = 'none';
        this.current = null;     // currently active object
        this.outgoing = [];      // objects mid-dissolve
        this.hand = null;        // smoothed hand position (Vector3) or null
        this._handTarget = new THREE.Vector3();
        this._hasHand = false;
    }

    resize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.renderer.setSize(w, h, false);
        this.composer.setSize(w, h);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    start() {
        const tick = () => {
            const dt = Math.min(this.clock.getDelta(), 0.05);
            const t  = this.clock.elapsedTime;
            this._update(dt, t);
            this.composer.render();
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    setGesture(gesture) {
        if (gesture === this.currentGesture) return;

        // ── "Life Release" path ──────────────────────────────────────────
        // fist → open_palm doesn't swap objects. Instead we ask the existing
        // orb to morph in place, so the same particles that drew the Earth
        // become the falling petals — no dissolve/respawn discontinuity.
        if (this.current?.canMorphTo?.(gesture)) {
            this.current.requestMorph();
            this.currentGesture = gesture;
            return;
        }

        this.currentGesture = gesture;

        // 'none' means the user has dropped their hand — clean up with gravity
        // so particles fall and clear, rather than the radial shatter used between gestures.
        const isCleanup = gesture === 'none';

        if (this.current) {
            this.current.exit({ gravity: isCleanup });
            this.outgoing.push(this.current);
            this.current = null;
        }

        const factory = FACTORIES[gesture];
        if (!factory) return;

        const obj = factory();
        obj.addTo(this.scene);
        obj.enter();
        this.current = obj;
    }

    setConfidence(value) {
        // Forward live pose confidence to the active object so it can fade its
        // opacity. Clean poses → full strength; sloppy poses → softly dimmer.
        if (this.current?.setConfidence) this.current.setConfidence(value);
    }

    setHandLandmarks(landmarks) {
        if (!landmarks) {
            this._hasHand = false;
            return;
        }
        // Use the wrist landmark in normalized image space [0,1] (selfieMode mirrors X).
        // Map to a small camera-space offset so the scene reacts subtly to hand position.
        const w = landmarks[0];
        this._handTarget.set((w.x - 0.5) * 4.0, (0.5 - w.y) * 3.0, 0.0);
        this._hasHand = true;
    }

    _update(dt, t) {
        // Smooth hand position to drift the scene; never aggressive.
        if (this._hasHand) {
            this.scene.position.x += (this._handTarget.x * 0.12 - this.scene.position.x) * 0.06;
            this.scene.position.y += (this._handTarget.y * 0.12 - this.scene.position.y) * 0.06;
        } else {
            this.scene.position.x += (0 - this.scene.position.x) * 0.04;
            this.scene.position.y += (0 - this.scene.position.y) * 0.04;
        }

        // Subtle camera breathing.
        this.camera.position.z = 9 + Math.sin(t * 0.3) * 0.15;
        this.camera.lookAt(0, 0, 0);

        if (this.current) {
            this.current.update(dt, t, this._hasHand ? this._handTarget : null, this.camera);
        }

        // Tick outgoing objects, retire when their dissolve completes.
        for (let i = this.outgoing.length - 1; i >= 0; i--) {
            const o = this.outgoing[i];
            o.update(dt, t, null, this.camera);
            if (o.isDone()) {
                o.removeFrom(this.scene);
                o.dispose();
                this.outgoing.splice(i, 1);
            }
        }

        this._updateAmbience(dt, t);
    }

    _buildAmbience() {
        const count = 1200;
        const positions = new Float32Array(count * 3);
        const colors    = new Float32Array(count * 3);
        const sizes     = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            const r  = 30 + Math.random() * 40;
            const th = Math.random() * Math.PI * 2;
            const ph = Math.acos(2 * Math.random() - 1);
            positions[i * 3]     = r * Math.sin(ph) * Math.cos(th);
            positions[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
            positions[i * 3 + 2] = -10 - Math.random() * 60;

            // Distant stars — kept dim so they suggest depth instead of attracting the eye.
            const tone = Math.random();
            colors[i * 3]     = 0.42 + tone * 0.13;   // R 0.42..0.55
            colors[i * 3 + 1] = 0.32 + tone * 0.13;   // G 0.32..0.45
            colors[i * 3 + 2] = 0.48 + tone * 0.14;   // B 0.48..0.62

            sizes[i] = 0.5 + Math.random() * 1.2;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));

        const mat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 } },
            vertexShader: /* glsl */`
                attribute float aSize;
                attribute vec3 color;
                varying vec3 vColor;
                varying float vTwinkle;
                uniform float uTime;
                void main() {
                    vColor = color;
                    vTwinkle = 0.6 + 0.4 * sin(uTime * 1.3 + position.x * 0.4 + position.y * 0.3);
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    gl_Position = projectionMatrix * mv;
                    gl_PointSize = aSize * (130.0 / -mv.z);
                }
            `,
            fragmentShader: /* glsl */`
                varying vec3 vColor;
                varying float vTwinkle;
                void main() {
                    vec2 uv = gl_PointCoord - 0.5;
                    float d = length(uv);
                    if (d > 0.5) discard;
                    float a = smoothstep(0.5, 0.0, d) * vTwinkle * 0.7;
                    gl_FragColor = vec4(vColor, a);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });

        this.ambience = new THREE.Points(geo, mat);
        this.scene.add(this.ambience);
    }

    _updateAmbience(_dt, t) {
        if (this.ambience) {
            this.ambience.material.uniforms.uTime.value = t;
            this.ambience.rotation.y = t * 0.01;
            this.ambience.rotation.x = Math.sin(t * 0.05) * 0.05;
        }
    }
}
