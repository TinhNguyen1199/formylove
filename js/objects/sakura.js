import * as THREE from 'three';
import { BaseObject } from './baseObject.js';

// Open palm → a soft sakura storm. Each petal owns its fall speed, sway phase,
// and rotation, so the field looks naturally varied without per-frame JS work —
// every animation runs on the GPU from `uTime` and immutable per-particle data.
//
// The y position cycles through a tall vertical range so petals are continuously
// renewed; the wraparound happens above the viewport (faded by visibility math),
// so visually petals just keep falling forever.

const VERT = /* glsl */`
attribute vec2 aSpeed;     // x: fall velocity, y: sway frequency
attribute vec2 aPhase;     // x: time offset, y: rotation phase
attribute vec3 aColor;
attribute float aSize;

uniform float uTime;
uniform float uForm;       // 0..1 form-in scale (petals grow into view)
uniform float uTop;
uniform float uBottom;
uniform float uHeight;     // vertical wrap distance (slightly bigger than viewport)

varying vec3 vColor;
varying float vAlpha;
varying float vRotation;

void main() {
    float t = uTime + aPhase.x;

    // Vertical fall, cycling so each petal falls forever.
    float fallen = mod(t * aSpeed.x, uHeight);
    float y = uTop - fallen;

    // Horizontal sway + small z drift so petals waft as they fall.
    float sway  = sin(t * aSpeed.y + aPhase.y) * 0.55;
    float drift = cos(t * aSpeed.y * 0.7 + aPhase.y) * 0.30;
    float x = position.x + sway;
    float z = position.z + drift;

    vec3 pos = vec3(x, y, z);

    // Edge fade so the wraparound at top/bottom is invisible.
    float visTop = smoothstep(uTop,    uTop    - 2.0, y);
    float visBot = smoothstep(uBottom, uBottom + 2.0, y);

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = aSize * uForm * (180.0 / max(-mvPos.z, 0.1));

    vColor = aColor;
    vAlpha = visTop * visBot * uForm;
    vRotation = aPhase.y + t * aSpeed.y * 0.55;
}
`;

const FRAG = /* glsl */`
varying vec3 vColor;
varying float vAlpha;
varying float vRotation;

uniform float uOpacity;
uniform float uConfidence;

void main() {
    // Rotated, slightly stretched ellipse — reads as a soft sakura petal that
    // spins as it falls. Cheap and recognisable.
    vec2 uv = (gl_PointCoord - vec2(0.5)) * 2.0;
    float c = cos(vRotation), s = sin(vRotation);
    uv = mat2(c, -s, s, c) * uv;
    uv.x *= 1.45;

    float r = length(uv);
    float a = smoothstep(0.95, 0.45, r);
    if (a < 0.02) discard;

    // Soft inner core highlight — makes the petal look slightly translucent.
    float inner = smoothstep(0.55, 0.0, r) * 0.18;

    gl_FragColor = vec4(vColor * (0.78 + inner), vAlpha * uOpacity * uConfidence * a);
}
`;

const PALETTE = [
    new THREE.Color(0xc89aa6),  // dusty sakura
    new THREE.Color(0xb08a96),  // muted rose
    new THREE.Color(0xd4a8b0),  // light blush
    new THREE.Color(0xa87a88),  // deeper rose
];

const TOP = 7;
const BOTTOM = -7;
const HEIGHT = TOP - BOTTOM + 4;   // +4 keeps the wrap above the viewport

export class Sakura extends BaseObject {
    constructor() {
        super();
        this.formDuration = 1.7;
        this.exitDuration = 1.5;

        const count = 4000;
        const positions = new Float32Array(count * 3);
        const speeds    = new Float32Array(count * 2);
        const phases    = new Float32Array(count * 2);
        const colors    = new Float32Array(count * 3);
        const sizes     = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            // position carries the (x, z) spawn column; y is computed in the shader.
            positions[i * 3]     = (Math.random() - 0.5) * 14.0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 6.0;

            speeds[i * 2]     = 0.55 + Math.random() * 0.75;   // fall speed (units/s)
            speeds[i * 2 + 1] = 0.45 + Math.random() * 0.65;   // sway frequency

            // Time offset so petals don't all wrap on the same beat.
            phases[i * 2]     = Math.random() * 18.0;
            // Random rotation start.
            phases[i * 2 + 1] = Math.random() * Math.PI * 2;

            // Pick a colour from the romantic palette and jitter slightly.
            const c = PALETTE[(Math.random() * PALETTE.length) | 0].clone();
            c.r = Math.min(1, Math.max(0, c.r + (Math.random() - 0.5) * 0.05));
            c.g = Math.min(1, Math.max(0, c.g + (Math.random() - 0.5) * 0.05));
            c.b = Math.min(1, Math.max(0, c.b + (Math.random() - 0.5) * 0.05));
            colors[i * 3]     = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;

            sizes[i] = 1.5 + Math.random() * 1.1;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('aSpeed',   new THREE.BufferAttribute(speeds, 2));
        geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 2));
        geo.setAttribute('aColor',   new THREE.BufferAttribute(colors, 3));
        geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime:       { value: 0 },
                uForm:       { value: 0 },
                uOpacity:    { value: 1.0 },
                uConfidence: { value: 1.0 },
                uTop:        { value: TOP },
                uBottom:     { value: BOTTOM },
                uHeight:     { value: HEIGHT },
            },
            vertexShader:   VERT,
            fragmentShader: FRAG,
            transparent: true,
            depthWrite: false,
            // NormalBlending: petals should look like physical sprites, not glow.
            blending: THREE.NormalBlending,
        });

        this.points = new THREE.Points(geo, this.material);
        this.group.add(this.points);
    }

    // Sakura has its own uniform scheme (uForm + uOpacity rather than uDissolve),
    // so we override the lifecycle update to drive them appropriately:
    //   forming    → uForm  eases 0 → 1   (petals scale + alpha-fade in)
    //   idle       → uForm  pinned at 1
    //   dissolving → uOpacity eases 1 → 0 (petals keep falling, fade away)
    update(dt, time, hand, camera) {
        this._t += dt;
        const m = this.material;
        if (!m) return;
        m.uniforms.uTime.value = time;

        if (this.state === 'forming') {
            const p = Math.min(this._t / this.formDuration, 1);
            // easeOutCubic — quick bloom, then settle.
            m.uniforms.uForm.value = 1 - Math.pow(1 - p, 3);
            if (p >= 1) this.state = 'idle';
        } else if (this.state === 'dissolving') {
            const p = Math.min(this._t / this.exitDuration, 1);
            // easeInCubic — slow drift away, accelerating to gone.
            m.uniforms.uOpacity.value = 1 - p * p * p;
            if (p >= 1) this.state = 'done';
        } else {
            m.uniforms.uForm.value = 1;
        }

        // Confidence lerp — only meaningful during idle.
        if (this.state === 'idle') {
            this._confidenceSmooth += (this._confidenceTarget - this._confidenceSmooth) * 0.12;
            m.uniforms.uConfidence.value = this._confidenceSmooth;
        }

        this.onUpdate(dt, time, hand, camera);
    }
}
