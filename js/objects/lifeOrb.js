import * as THREE from 'three';
import { TextGeometry }       from 'three/addons/geometries/TextGeometry.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { BaseObject }         from './baseObject.js';
import { loadFont }           from '../utils/fontLoader.js';

// "Life Release" — a unified particle object that holds the Earth state and
// the Sakura state in one buffer. A single uPhase uniform morphs between them,
// so position, colour, size and shape all interpolate smoothly. The same
// particles that draw the Earth become the falling petals.
//
// Anticipation phase: a brief inner glow + organic vibration (layered sin) so
// the Earth feels like it's "drawing breath" before releasing.
//
// Single particle system, single material, single Points object.

// Cheap noise for FBM-coloured continents.
function hash3(x, y, z) {
    return Math.sin(x * 12.989 + y * 78.233 + z * 37.719) * 43758.5453 % 1;
}
function smoothNoise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const w = zf * zf * (3 - 2 * zf);
    const lerp = (a, b, t) => a + (b - a) * t;
    return lerp(
        lerp(lerp(hash3(xi, yi, zi),         hash3(xi+1, yi, zi),     u),
             lerp(hash3(xi, yi+1, zi),       hash3(xi+1, yi+1, zi),   u), v),
        lerp(lerp(hash3(xi, yi, zi+1),       hash3(xi+1, yi, zi+1),   u),
             lerp(hash3(xi, yi+1, zi+1),     hash3(xi+1, yi+1, zi+1), u), v),
        w);
}
function fbm(x, y, z) {
    let v = 0, a = 0.5, f = 1;
    for (let i = 0; i < 4; i++) { v += smoothNoise(x * f, y * f, z * f) * a; a *= 0.5; f *= 2; }
    return v;
}

const EARTH_PALETTE = {
    oceanDeep:  new THREE.Color(0x261d33),
    oceanShore: new THREE.Color(0x453856),
    landMid:    new THREE.Color(0x6e5a6c),
    landHigh:   new THREE.Color(0x8a767e),
    polar:      new THREE.Color(0x8a8095),
};

const SAKURA_PALETTE = [
    new THREE.Color(0xc89aa6),
    new THREE.Color(0xb08a96),
    new THREE.Color(0xd4a8b0),
    new THREE.Color(0xa87a88),
];

// Slightly warmer cream-rose than the Earth body so the letters read against
// the mauve surface without breaking the palette.
const TEXT_EARTH_COLOR = new THREE.Color(0xe5cad0);

const RADIUS         = 2.3;
const SAKURA_TOP     = 7;
const SAKURA_BOTTOM  = -7;
const SAKURA_HEIGHT  = SAKURA_TOP - SAKURA_BOTTOM + 4;

const VERT = /* glsl */`
attribute vec2 aSakuraXZ;
attribute vec2 aSakuraSpeed;
attribute vec2 aSakuraPhase;
attribute vec3 aEarthColor;
attribute vec3 aSakuraColor;
attribute float aSize;
attribute vec3 aDispDir;
attribute float aSakuraVisible;   // 1 = visible in Sakura mode, 0 = hidden — thins the wind

uniform float uTime;
uniform float uSakuraTime;
uniform float uPhase;          // 0 = pure Earth, 1 = pure Sakura (smoothstepped)
uniform float uAnticipation;   // 0..1 anticipation glow + vibration intensity
uniform float uForm;           // 0..1 initial form-in scale
uniform float uEarthRotY;      // Earth body rotation around Y (CPU-side angle)
uniform float uTop;
uniform float uBottom;
uniform float uHeight;

varying vec3  vColor;
varying float vAlpha;
varying float vRotation;
varying float vPhase;          // ePhase exposed to fragment for shape morph

void main() {
    // ── Earth-mode position ──────────────────────────────────────────────
    // Apply the planet's slow Y-axis rotation in the shader so the rotation
    // doesn't carry over into Sakura mode. Sakura petals are anchored in
    // world space and shouldn't inherit the planet's spin.
    float cy = cos(uEarthRotY);
    float sy = sin(uEarthRotY);
    vec3 earthPos = vec3(
        position.x * cy - position.z * sy,
        position.y,
        position.x * sy + position.z * cy
    );

    // Anticipation vibration — layered sins give an organic, noise-like jitter
    // without needing a true simplex implementation in the shader.
    float n1 = sin(uTime * 9.0  + dot(position, vec3(2.1, 1.7, 1.3)));
    float n2 = sin(uTime * 13.5 + dot(position, vec3(3.3, 1.1, 2.5))) * 0.5;
    float vibrate = (n1 + n2) * uAnticipation * 0.04;
    earthPos += aDispDir * vibrate;

    // ── Sakura-mode position ─────────────────────────────────────────────
    float st = uSakuraTime + aSakuraPhase.x;
    float fallen = mod(st * aSakuraSpeed.x, uHeight);
    float yS = uTop - fallen;
    float sway  = sin(st * aSakuraSpeed.y + aSakuraPhase.y) * 0.55;
    float drift = cos(st * aSakuraSpeed.y * 0.7 + aSakuraPhase.y) * 0.30;
    vec3 sakuraPos = vec3(aSakuraXZ.x + sway, yS, aSakuraXZ.y + drift);

    // ── Smooth morph (ease-in for disintegration) ────────────────────────
    // Smoothstep: gentle start, gentle end — feels like "release" rather than
    // a violent flip. The shape/colour mixes use this same curve.
    float ePhase = uPhase * uPhase * (3.0 - 2.0 * uPhase);

    vec3 pos   = mix(earthPos,    sakuraPos,    ePhase);
    vec3 color = mix(aEarthColor, aSakuraColor, ePhase);

    // Sakura visibility cycle (off-screen wrap fade); Earth is always visible.
    float visTop = smoothstep(uTop,    uTop    - 2.0, pos.y);
    float visBot = smoothstep(uBottom, uBottom + 2.0, pos.y);
    float sakuraMask = mix(1.0, aSakuraVisible, ePhase);   // thins wind density
    float visibility = mix(1.0, visTop * visBot, ePhase) * sakuraMask;

    // Anticipation glow — gentle, never harsh.
    float glow = 1.0 + uAnticipation * 0.30;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;

    // Earth points are smaller (fine planetary detail); Sakura petals larger.
    float earthSize  = aSize * 0.40;
    float sakuraSize = aSize;
    float currentSize = mix(earthSize, sakuraSize, ePhase);
    gl_PointSize = currentSize * uForm * (180.0 / max(-mvPos.z, 0.1));

    vColor    = color * glow;
    vAlpha    = visibility * uForm;
    vRotation = aSakuraPhase.y + st * aSakuraSpeed.y * 0.55;
    vPhase    = ePhase;
}
`;

const FRAG = /* glsl */`
varying vec3  vColor;
varying float vAlpha;
varying float vRotation;
varying float vPhase;

uniform float uOpacity;
uniform float uConfidence;

void main() {
    vec2 uv = gl_PointCoord - 0.5;

    // ── Earth point shape: soft round disc ──────────────────────────────
    float r = length(uv);
    float roundShape = smoothstep(0.5, 0.0, r);

    // ── Sakura petal shape: rotated, stretched ellipse ──────────────────
    vec2 puv = uv * 2.0;
    float c = cos(vRotation), s = sin(vRotation);
    puv = mat2(c, -s, s, c) * puv;
    puv.x *= 1.45;
    float petalR = length(puv);
    float petalShape = smoothstep(0.95, 0.45, petalR);

    // Continuous shape morph — at vPhase=0 you see crisp dots; at vPhase=1
    // you see soft petals; in-between is a recognisable hybrid.
    float shape = mix(roundShape, petalShape, vPhase);
    if (shape < 0.02) discard;

    // Subtle inner highlight on petals (not on dots) for translucent feel.
    float petalHighlight = smoothstep(0.55, 0.0, petalR) * 0.18 * vPhase;

    gl_FragColor = vec4(
        vColor * (0.78 + petalHighlight),
        vAlpha * uOpacity * uConfidence * shape
    );
}
`;

export class LifeOrb extends BaseObject {
    constructor(initialMode = 'earth') {
        super();
        this.formDuration  = 1.8;
        this.exitDuration  = 1.5;
        this.morphDuration = 2.6;     // 0.0..0.4 anticipation peak, 0.3..2.6 morph

        this._mode = initialMode;
        // For 'sakura' initial mode, jumpstart the time so petals start at
        // varied points in the fall cycle rather than all at the top.
        this._sakuraTime = initialMode === 'sakura' ? 30 + Math.random() * 30 : 0;
        this._earthRotY = 0;
        this._disposed = false;

        this._build();

        if (initialMode === 'earth') {
            // Text only matters in Earth mode. Async load — slots stay invisible
            // (size = 0) until the font + sampler complete.
            this._loadText().catch((err) => console.error('LifeOrb text load failed:', err));
        }
    }

    // SceneManager calls this when it detects a fist→open_palm transition,
    // so we morph in-place rather than swapping objects (the whole point of
    // the unified system).
    canMorphTo(gesture) {
        return gesture === 'open_palm'
            && this._mode === 'earth'
            && (this.state === 'idle' || this.state === 'forming');
    }

    requestMorph() {
        if (this._mode !== 'earth') return;
        if (this.state === 'dissolving' || this.state === 'done') return;

        // If the orb is still forming, snap to fully formed first so the
        // anticipation and morph have the full Earth to act on.
        if (this.state === 'forming' && this.material) {
            this.material.uniforms.uForm.value = 1;
        }
        this.state = 'morphing';
        this._t = 0;
    }

    _build() {
        const bodyCount = 7000;
        const textCount = 1500;
        const total = bodyCount + textCount;
        this._bodyCount = bodyCount;
        this._textCount = textCount;

        const positions    = new Float32Array(total * 3);
        const sakuraXZ     = new Float32Array(total * 2);
        const sakuraSpeed  = new Float32Array(total * 2);
        const sakuraPhase  = new Float32Array(total * 2);
        const earthColors  = new Float32Array(total * 3);
        const sakuraColors = new Float32Array(total * 3);
        const sizes        = new Float32Array(total);
        const dispDirs     = new Float32Array(total * 3);
        const sakuraVisible = new Float32Array(total);

        // Roughly half of body particles participate in the Sakura wind. Earth
        // mode shows everyone; Sakura mode only shows the marked subset, which
        // halves the on-screen petal count without thinning Earth detail.
        const SAKURA_VISIBLE_RATIO = 0.5;

        const golden = Math.PI * (3 - Math.sqrt(5));

        // ── Body particles: Fibonacci-sphere with FBM-tinted continents ──
        for (let i = 0; i < bodyCount; i++) {
            const y = 1 - (i / (bodyCount - 1)) * 2;
            const r = Math.sqrt(1 - y * y);
            const theta = golden * i;
            const x = Math.cos(theta) * r;
            const z = Math.sin(theta) * r;

            positions[i * 3]     = x * RADIUS;
            positions[i * 3 + 1] = y * RADIUS;
            positions[i * 3 + 2] = z * RADIUS;

            const n   = fbm(x * 2.2, y * 2.2, z * 2.2);
            const lat = Math.abs(y);
            let color;
            if (lat > 0.93)        color = EARTH_PALETTE.polar;
            else if (n > 0.22)     color = lat > 0.6 ? EARTH_PALETTE.landMid : EARTH_PALETTE.landHigh;
            else if (n > 0.08)     color = EARTH_PALETTE.oceanShore.clone()
                                                .lerp(EARTH_PALETTE.landMid, (n - 0.08) * 6.0);
            else                   color = EARTH_PALETTE.oceanDeep.clone()
                                                .lerp(EARTH_PALETTE.oceanShore, n * 6.0 + 0.4);

            earthColors[i * 3]     = color.r;
            earthColors[i * 3 + 1] = color.g;
            earthColors[i * 3 + 2] = color.b;

            const sc = SAKURA_PALETTE[(Math.random() * SAKURA_PALETTE.length) | 0];
            sakuraColors[i * 3]     = sc.r;
            sakuraColors[i * 3 + 1] = sc.g;
            sakuraColors[i * 3 + 2] = sc.b;

            sakuraXZ[i * 2]      = (Math.random() - 0.5) * 14.0;
            sakuraXZ[i * 2 + 1]  = (Math.random() - 0.5) * 6.0;
            sakuraSpeed[i * 2]   = 0.55 + Math.random() * 0.75;
            sakuraSpeed[i * 2+1] = 0.45 + Math.random() * 0.65;
            sakuraPhase[i * 2]   = Math.random() * 18;
            sakuraPhase[i * 2+1] = Math.random() * Math.PI * 2;

            sizes[i] = 1.4 + Math.random() * 1.0;

            // Random unit vector for vibration direction.
            const dx = Math.random() - 0.5;
            const dy = Math.random() - 0.5;
            const dz = Math.random() - 0.5;
            const dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
            dispDirs[i * 3]     = dx / dl;
            dispDirs[i * 3 + 1] = dy / dl;
            dispDirs[i * 3 + 2] = dz / dl;

            sakuraVisible[i] = Math.random() < SAKURA_VISIBLE_RATIO ? 1 : 0;
        }

        // ── Text slots: sakura behaviour pre-filled, sized to 0 (invisible
        //    until _loadText fills the rest in). They still morph along with
        //    the body once the text data arrives.
        for (let i = bodyCount; i < total; i++) {
            sizes[i] = 0;
            sakuraVisible[i] = Math.random() < SAKURA_VISIBLE_RATIO ? 1 : 0;

            const sc = SAKURA_PALETTE[(Math.random() * SAKURA_PALETTE.length) | 0];
            sakuraColors[i * 3]     = sc.r;
            sakuraColors[i * 3 + 1] = sc.g;
            sakuraColors[i * 3 + 2] = sc.b;

            sakuraXZ[i * 2]      = (Math.random() - 0.5) * 14.0;
            sakuraXZ[i * 2 + 1]  = (Math.random() - 0.5) * 6.0;
            sakuraSpeed[i * 2]   = 0.55 + Math.random() * 0.75;
            sakuraSpeed[i * 2+1] = 0.45 + Math.random() * 0.65;
            sakuraPhase[i * 2]   = Math.random() * 18;
            sakuraPhase[i * 2+1] = Math.random() * Math.PI * 2;

            // dispDirs left as zeros — fine, vibration only matters in Earth mode.
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position',     new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('aSakuraXZ',    new THREE.BufferAttribute(sakuraXZ, 2));
        geo.setAttribute('aSakuraSpeed', new THREE.BufferAttribute(sakuraSpeed, 2));
        geo.setAttribute('aSakuraPhase', new THREE.BufferAttribute(sakuraPhase, 2));
        geo.setAttribute('aEarthColor',  new THREE.BufferAttribute(earthColors, 3));
        geo.setAttribute('aSakuraColor', new THREE.BufferAttribute(sakuraColors, 3));
        geo.setAttribute('aSize',        new THREE.BufferAttribute(sizes, 1));
        geo.setAttribute('aDispDir',     new THREE.BufferAttribute(dispDirs, 3));
        geo.setAttribute('aSakuraVisible', new THREE.BufferAttribute(sakuraVisible, 1));

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime:         { value: 0 },
                uSakuraTime:   { value: this._sakuraTime },
                uPhase:        { value: this._mode === 'sakura' ? 1.0 : 0.0 },
                uAnticipation: { value: 0 },
                uForm:         { value: 0 },
                uOpacity:      { value: 1.0 },
                uConfidence:   { value: 1.0 },
                uEarthRotY:    { value: 0 },
                uTop:          { value: SAKURA_TOP },
                uBottom:       { value: SAKURA_BOTTOM },
                uHeight:       { value: SAKURA_HEIGHT },
            },
            vertexShader:   VERT,
            fragmentShader: FRAG,
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending,
        });

        this.points = new THREE.Points(geo, this.material);
        this.group.add(this.points);
    }

    async _loadText() {
        const font = await loadFont();
        if (this._disposed) return;

        // If the user already triggered a morph, applying text mid-morph would
        // cause new points to flash in en route to Sakura positions. Skip.
        if (this.state !== 'forming' && this.state !== 'idle') return;
        if (this._mode !== 'earth') return;

        const textGeo = new TextGeometry('T  &  N', {
            font,
            size: 0.42,
            depth: 0.05,
            curveSegments: 5,
            bevelEnabled: false,
        });
        textGeo.center();

        const tempMat = new THREE.MeshBasicMaterial();
        const sampler = new MeshSurfaceSampler(new THREE.Mesh(textGeo, tempMat)).build();

        const positions    = this.points.geometry.attributes.position.array;
        const earthColors  = this.points.geometry.attributes.aEarthColor.array;
        const sizes        = this.points.geometry.attributes.aSize.array;

        const tmp   = new THREE.Vector3();
        const start = this._bodyCount;
        const limit = RADIUS * 0.85;     // text must fit within front hemisphere

        for (let i = 0; i < this._textCount; i++) {
            sampler.sample(tmp);
            tmp.z = 0;
            const r2 = tmp.x * tmp.x + tmp.y * tmp.y;
            if (r2 > limit * limit) {
                sizes[start + i] = 0;
                continue;
            }
            // Project (x, y) onto the sphere's front hemisphere, then push out
            // a hair so the letters read as embossed rather than buried.
            const sphereZ = Math.sqrt(RADIUS * RADIUS - r2);
            const len     = Math.sqrt(r2 + sphereZ * sphereZ);
            const factor  = (RADIUS + 0.06) / len;
            const idx = (start + i) * 3;
            positions[idx]     = tmp.x   * factor;
            positions[idx + 1] = tmp.y   * factor;
            positions[idx + 2] = sphereZ * factor;

            earthColors[idx]     = TEXT_EARTH_COLOR.r;
            earthColors[idx + 1] = TEXT_EARTH_COLOR.g;
            earthColors[idx + 2] = TEXT_EARTH_COLOR.b;

            sizes[start + i] = 0.7 + Math.random() * 0.4;
        }

        textGeo.dispose();
        tempMat.dispose();

        this.points.geometry.attributes.position.needsUpdate    = true;
        this.points.geometry.attributes.aSize.needsUpdate       = true;
        this.points.geometry.attributes.aEarthColor.needsUpdate = true;
    }

    update(dt, time, hand, camera) {
        this._t += dt;
        const m = this.material;
        if (!m) return;
        m.uniforms.uTime.value = time;

        // Earth's slow rotation only ticks in Earth mode (frozen once morphed).
        if (this._mode === 'earth') {
            this._earthRotY += dt * 0.16;
            m.uniforms.uEarthRotY.value = this._earthRotY;
        }

        if (this.state === 'forming') {
            const p = Math.min(this._t / this.formDuration, 1);
            m.uniforms.uForm.value = 1 - Math.pow(1 - p, 3);    // easeOutCubic
            if (p >= 1) { this.state = 'idle'; this._t = 0; }
        } else if (this.state === 'morphing') {
            const t = this._t;

            // Anticipation envelope: 0..0.4s ramp up, 0.4..1.0s decay back.
            let antic;
            if (t < 0.4)        antic = t / 0.4;
            else if (t < 1.0)   antic = 1 - (t - 0.4) / 0.6;
            else                antic = 0;
            m.uniforms.uAnticipation.value = antic;

            // Morph: 0.3 .. morphDuration. Linear here — the shader applies the
            // smoothstep so position/colour/size all morph along an S-curve.
            const morphP = Math.max(0, Math.min(1, (t - 0.3) / (this.morphDuration - 0.3)));
            m.uniforms.uPhase.value = morphP;

            if (t >= this.morphDuration) {
                this.state = 'idle';
                this._mode = 'sakura';
                m.uniforms.uPhase.value        = 1;
                m.uniforms.uAnticipation.value = 0;
                this._t = 0;
            }
        } else if (this.state === 'dissolving') {
            const p = Math.min(this._t / this.exitDuration, 1);
            m.uniforms.uOpacity.value = 1 - p * p * p;          // easeInCubic
            if (p >= 1) this.state = 'done';
        }

        // Idle bookkeeping (works for both Earth and Sakura idle).
        if (this.state === 'idle') {
            m.uniforms.uForm.value = 1;
            this._confidenceSmooth +=
                (this._confidenceTarget - this._confidenceSmooth) * 0.12;
            m.uniforms.uConfidence.value = this._confidenceSmooth;
        }

        // Sakura time advances proportional to morph phase — petals start
        // moving as they morph in, full speed once Sakura mode locks.
        // (At uPhase=1 in pure Sakura mode this is just regular fall time.)
        const phase = m.uniforms.uPhase.value;
        this._sakuraTime += dt * phase;
        m.uniforms.uSakuraTime.value = this._sakuraTime;

        this.onUpdate(dt, time, hand, camera);
    }

    dispose() {
        this._disposed = true;
        super.dispose();
    }
}
