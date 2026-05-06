import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { BaseObject }         from './baseObject.js';

// "Like" gesture (thumbs up). Cinematic flow:
//   ambient → beam appears → particles gather → heart reveal → impact pulse → idle
// Single particle system. Each particle stores three target positions
// (idle scatter / beam column / heart shape). One uPhase uniform morphs the
// whole field through the sequence in lockstep.
//
// A separate beam mesh (additive cylinder) rises in tandem so the user gets a
// visible "shaft of light" before the particles converge into it.

const PARTICLE_COUNT = 4500;

const IDLE_COLORS = [
    new THREE.Color(0xc4b89a),  // warm cream
    new THREE.Color(0xb8a8a8),  // soft greige
    new THREE.Color(0xd0bca0),  // pale gold
];

const HEART_COLORS = [
    new THREE.Color(0xc89aa6),  // dusty pink
    new THREE.Color(0xb08a96),  // muted rose
    new THREE.Color(0xd4a8b0),  // light blush
    new THREE.Color(0xa87a88),  // deeper rose
];

const VERT = /* glsl */`
attribute vec3 aIdlePos;
attribute vec3 aBeamPos;
attribute vec3 aHeartPos;
attribute vec3 aIdleColor;
attribute vec3 aPinkColor;
attribute vec2 aPhase;
attribute float aSize;

uniform float uTime;
uniform float uPhase;       // 0 = idle scatter · 1 = beam column · 2 = heart
uniform float uPulse;       // -1..+1, drives heart breathing/impact
uniform float uBeamGlow;    // 0..1 brightness boost while beam is active
uniform float uForm;        // 0..1 initial form-in scale

varying vec3  vColor;
varying float vAlpha;

void main() {
    // Two-stage smooth morph. The smoothstep on each segment keeps the
    // velocity continuous through the midpoints — particles never snap.
    vec3 pos;
    if (uPhase < 1.0) {
        float p = uPhase;
        float e = p * p * (3.0 - 2.0 * p);
        pos = mix(aIdlePos, aBeamPos, e);
    } else {
        float p = uPhase - 1.0;
        float e = p * p * (3.0 - 2.0 * p);
        pos = mix(aBeamPos, aHeartPos, e);
    }

    // Heart pulse — only meaningful once the heart has formed (phase ≥ 1).
    float heartness = clamp(uPhase - 1.0, 0.0, 1.0);
    pos *= 1.0 + uPulse * 0.06 * heartness;

    // Organic wobble — tiny per-particle drift so nothing is ever still.
    pos += vec3(
        sin(uTime * 1.20 + aPhase.x) * 0.025,
        sin(uTime * 1.65 + aPhase.y) * 0.025,
        0.0
    );

    // Colour: idle warm-cream → soft pink, transitioning during the reveal arc.
    float colorMix = smoothstep(0.7, 1.5, uPhase);
    vec3 color = mix(aIdleColor, aPinkColor, colorMix);

    // Brightness boost: subtle while the beam is active + a kiss during impact.
    float boost = 1.0 + uBeamGlow * 0.32 + uPulse * 0.18 * heartness;
    color *= boost;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = aSize * uForm * (180.0 / max(-mvPos.z, 0.1));

    vColor = color;
    vAlpha = uForm;
}
`;

const FRAG = /* glsl */`
varying vec3  vColor;
varying float vAlpha;

uniform float uOpacity;
uniform float uConfidence;

void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv);
    float core = smoothstep(0.45, 0.0, r) * 0.7;
    float halo = smoothstep(0.5, 0.20, r) * 0.3;
    float intensity = core + halo;
    if (intensity < 0.02) discard;

    gl_FragColor = vec4(
        vColor * (0.5 + halo * 0.25),
        vAlpha * uOpacity * uConfidence * intensity
    );
}
`;

const BEAM_VERT = /* glsl */`
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const BEAM_FRAG = /* glsl */`
varying vec2 vUv;
uniform float uOpacity;
uniform float uTime;
void main() {
    // Vertical fade so the beam reads as ethereal — no hard ends.
    float yFade = smoothstep(0.0, 0.18, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
    // Subtle slow pulse so the beam feels alive.
    float pulse = 0.85 + 0.15 * sin(uTime * 1.6);
    float a = yFade * pulse * uOpacity * 0.45;
    // Soft warm cream — never bright enough to glare.
    gl_FragColor = vec4(0.82, 0.74, 0.62, a);
}
`;

export class LightBeamHeart extends BaseObject {
    constructor() {
        super();
        this.formDuration = 0.5;
        this.exitDuration = 1.5;

        // Cinematic phase markers (seconds since the orb finished forming-in).
        // Each phase eases smoothly into the next via the morph maths below.
        this._tActivation = 0.5;   // beam begins to appear
        this._tGather     = 1.0;   // particles converging strongly
        this._tReveal     = 1.7;   // particles morph beam → heart, beam fades
        this._tImpact     = 2.7;   // single pulse + flash
        this._tStable     = 3.1;   // stable heart with breathing

        this._build();
    }

    _build() {
        // ── Heart geometry — sample for target positions ────────────────────
        const shape = new THREE.Shape();
        const s = 1.4;
        shape.moveTo(0, 0.5 * s);
        shape.bezierCurveTo(0,         0.85 * s, -0.55 * s, 1.10 * s, -0.85 * s, 0.70 * s);
        shape.bezierCurveTo(-1.15 * s, 0.30 * s, -0.70 * s, -0.30 * s, 0,        -0.85 * s);
        shape.bezierCurveTo(0.70 * s,  -0.30 * s, 1.15 * s, 0.30 * s,  0.85 * s, 0.70 * s);
        shape.bezierCurveTo(0.55 * s,  1.10 * s,  0,        0.85 * s,  0,        0.50 * s);

        const heartGeo = new THREE.ExtrudeGeometry(shape, {
            depth: 0.55,
            curveSegments: 18,
            bevelEnabled: true,
            bevelThickness: 0.18,
            bevelSize: 0.22,
            bevelSegments: 5,
        });
        heartGeo.center();
        heartGeo.rotateX(-0.06);

        const tempMat = new THREE.MeshBasicMaterial();
        const sampler = new MeshSurfaceSampler(new THREE.Mesh(heartGeo, tempMat)).build();

        // ── Per-particle attributes ─────────────────────────────────────────
        const idle       = new Float32Array(PARTICLE_COUNT * 3);
        const beam       = new Float32Array(PARTICLE_COUNT * 3);
        const heart      = new Float32Array(PARTICLE_COUNT * 3);
        const idleColors = new Float32Array(PARTICLE_COUNT * 3);
        const pinkColors = new Float32Array(PARTICLE_COUNT * 3);
        const phases     = new Float32Array(PARTICLE_COUNT * 2);
        const sizes      = new Float32Array(PARTICLE_COUNT);

        const tmp = new THREE.Vector3();
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            // Idle scatter: shell of varied radius so the field feels deep.
            const r  = 2.5 + Math.pow(Math.random(), 0.5) * 4.0;
            const th = Math.random() * Math.PI * 2;
            const ph = Math.acos(2 * Math.random() - 1);
            idle[i * 3]     = r * Math.sin(ph) * Math.cos(th);
            idle[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
            idle[i * 3 + 2] = r * Math.cos(ph) * 0.5;

            // Beam column: narrow vertical cylinder around origin.
            beam[i * 3]     = (Math.random() - 0.5) * 0.40;
            beam[i * 3 + 1] = (Math.random() - 0.5) * 5.0;
            beam[i * 3 + 2] = (Math.random() - 0.5) * 0.40;

            // Heart shape: surface-sampled.
            sampler.sample(tmp);
            heart[i * 3]     = tmp.x;
            heart[i * 3 + 1] = tmp.y;
            heart[i * 3 + 2] = tmp.z;

            const ic = IDLE_COLORS[(Math.random() * IDLE_COLORS.length) | 0];
            idleColors[i * 3]     = ic.r;
            idleColors[i * 3 + 1] = ic.g;
            idleColors[i * 3 + 2] = ic.b;

            const pc = HEART_COLORS[(Math.random() * HEART_COLORS.length) | 0];
            pinkColors[i * 3]     = pc.r;
            pinkColors[i * 3 + 1] = pc.g;
            pinkColors[i * 3 + 2] = pc.b;

            phases[i * 2]     = Math.random() * Math.PI * 2;
            phases[i * 2 + 1] = Math.random() * Math.PI * 2;

            sizes[i] = 1.0 + Math.random() * 0.8;
        }

        const geo = new THREE.BufferGeometry();
        // Position attribute is required by Three.js but unused in shader (we
        // compute position from aIdlePos/aBeamPos/aHeartPos). Allocate a zero
        // buffer to satisfy the requirement.
        geo.setAttribute('position',   new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3));
        geo.setAttribute('aIdlePos',   new THREE.BufferAttribute(idle, 3));
        geo.setAttribute('aBeamPos',   new THREE.BufferAttribute(beam, 3));
        geo.setAttribute('aHeartPos',  new THREE.BufferAttribute(heart, 3));
        geo.setAttribute('aIdleColor', new THREE.BufferAttribute(idleColors, 3));
        geo.setAttribute('aPinkColor', new THREE.BufferAttribute(pinkColors, 3));
        geo.setAttribute('aPhase',     new THREE.BufferAttribute(phases, 2));
        geo.setAttribute('aSize',      new THREE.BufferAttribute(sizes, 1));

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime:       { value: 0 },
                uPhase:      { value: 0 },
                uPulse:      { value: 0 },
                uBeamGlow:   { value: 0 },
                uForm:       { value: 0 },
                uOpacity:    { value: 1.0 },
                uConfidence: { value: 1.0 },
            },
            vertexShader:   VERT,
            fragmentShader: FRAG,
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending,
        });

        this.points = new THREE.Points(geo, this.material);
        this.group.add(this.points);

        // ── Beam mesh (separate, additive) ──────────────────────────────────
        const beamGeo = new THREE.CylinderGeometry(0.18, 0.18, 5.0, 24, 1, true);
        this.beamMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime:    { value: 0 },
                uOpacity: { value: 0 },
            },
            vertexShader:   BEAM_VERT,
            fragmentShader: BEAM_FRAG,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide,
        });
        this.beam = new THREE.Mesh(beamGeo, this.beamMat);
        this.group.add(this.beam);

        heartGeo.dispose();
        tempMat.dispose();
    }

    update(dt, time, hand, camera) {
        this._t += dt;
        const m = this.material;
        if (!m) return;
        m.uniforms.uTime.value = time;
        if (this.beamMat) this.beamMat.uniforms.uTime.value = time;

        if (this.state === 'forming') {
            const p = Math.min(this._t / this.formDuration, 1);
            m.uniforms.uForm.value = 1 - Math.pow(1 - p, 3);
            if (p >= 1) { this.state = 'idle'; this._t = 0; }
        } else if (this.state === 'idle') {
            m.uniforms.uForm.value = 1;
            const t = this._t;

            let uPhase, uBeamGlow, uPulse;

            if (t < this._tActivation) {
                // ① Ambient idle — particles drift in scatter, no beam yet.
                uPhase = 0; uBeamGlow = 0; uPulse = 0;
            } else if (t < this._tGather) {
                // ② Activation — beam fades in, particles begin drifting inward.
                const p = (t - this._tActivation) / (this._tGather - this._tActivation);
                uPhase    = p * 0.30;
                uBeamGlow = p * 0.65;
                uPulse    = 0;
            } else if (t < this._tReveal) {
                // ③ Gathering — particles converge into the beam column.
                const p = (t - this._tGather) / (this._tReveal - this._tGather);
                uPhase    = 0.30 + p * 0.70;
                uBeamGlow = 0.65 + p * 0.35;
                uPulse    = 0;
            } else if (t < this._tImpact) {
                // ④ Reveal — beam → heart morph, beam fades, colour shifts to pink.
                const p = (t - this._tReveal) / (this._tImpact - this._tReveal);
                uPhase    = 1.0 + p;
                uBeamGlow = 1.0 - p;
                uPulse    = 0;
            } else if (t < this._tStable) {
                // ⑤ Impact — single half-sine pulse + colour-bound light burst.
                const p = (t - this._tImpact) / (this._tStable - this._tImpact);
                uPhase    = 2.0;
                uBeamGlow = 0;
                uPulse    = Math.sin(p * Math.PI);
            } else {
                // ⑥ Stable heart — gentle continuous breathing.
                uPhase    = 2.0;
                uBeamGlow = 0;
                uPulse    = 0.30 * Math.sin((t - this._tStable) * 1.5);
            }

            m.uniforms.uPhase.value    = uPhase;
            m.uniforms.uBeamGlow.value = uBeamGlow;
            m.uniforms.uPulse.value    = uPulse;
            if (this.beamMat) this.beamMat.uniforms.uOpacity.value = uBeamGlow;

            this._confidenceSmooth +=
                (this._confidenceTarget - this._confidenceSmooth) * 0.12;
            m.uniforms.uConfidence.value = this._confidenceSmooth;
        } else if (this.state === 'dissolving') {
            // ⑦ Dissolve — heart smoothly reverses through beam back to scatter,
            //   while opacity fades. End state: invisible particles at idle pos.
            const p = Math.min(this._t / this.exitDuration, 1);
            const ePhase = p * p * (3 - 2 * p);
            m.uniforms.uPhase.value    = 2 - ePhase * 2;
            m.uniforms.uOpacity.value  = 1 - p;
            m.uniforms.uBeamGlow.value = 0;
            m.uniforms.uPulse.value    = 0;
            if (this.beamMat) this.beamMat.uniforms.uOpacity.value = 0;
            if (p >= 1) this.state = 'done';
        }

        this.onUpdate(dt, time, hand, camera);
    }
}
