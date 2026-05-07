import * as THREE from 'three';
import { TextGeometry }       from 'three/addons/geometries/TextGeometry.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { BaseObject }         from './baseObject.js';
import { loadFont }           from '../utils/fontLoader.js';

// "Life Release" — unified particle object for the fist (Earth) and open_palm
// (Sakura) gestures. Same buffers; a uPhase uniform smoothly morphs the field
// from a glowing pastel globe into a falling-petal field.
//
// Earth design goals:
//   • Dense fine particles laid out on a Fibonacci sphere — reads as a solid
//     luminous globe, not a sparse cloud.
//   • Smooth marbled colour pattern (multi-octave noise) blending pastel cyan,
//     soft pink, lavender and white-glow without hard continent borders.
//   • Half-Lambert directional shading + a subtle rim glow give cinematic
//     depth. The terminator drifts as the planet rotates.
//   • Particles do NOT drift or vibrate while idle — the globe holds its
//     shape and only the planet rotation animates the surface.
//   • T & N letters share the same surface plane as the body particles,
//     painted on in pearly-white so they read as embossed glow rather than
//     a flat overlay floating above the surface.
//   • One thin elegant ring + a very subtle fresnel halo round out the look.

// ────────────────────────────────────────────────────────────────────────────
// CPU multi-octave noise — used during build to tint each surface particle.
// Smooth, deterministic. Result is a flowing marbled pattern.
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
        lerp(lerp(hash3(xi, yi, zi),       hash3(xi+1, yi, zi),     u),
             lerp(hash3(xi, yi+1, zi),     hash3(xi+1, yi+1, zi),   u), v),
        lerp(lerp(hash3(xi, yi, zi+1),     hash3(xi+1, yi, zi+1),   u),
             lerp(hash3(xi, yi+1, zi+1),   hash3(xi+1, yi+1, zi+1), u), v),
        w);
}
function fbm(x, y, z) {
    let v = 0, a = 0.5, f = 1;
    for (let i = 0; i < 5; i++) { v += smoothNoise(x * f, y * f, z * f) * a; a *= 0.5; f *= 2; }
    return v;
}

// Luxury green palette — deep teal-green at the equator, sage forest mids,
// pale mint highlights, warm pearl at the poles. Saturation is restrained so
// the planet reads as elegant rather than candy-bright. The text colour is a
// distinct warm cream so the letters never blend into the surface.
const C_MINT     = new THREE.Color(0xb6d3c0);   // pale pastel mint (highlight)
const C_LEAF     = new THREE.Color(0x88b09a);   // mid leaf green
const C_FOREST   = new THREE.Color(0x547764);   // sage forest
const C_DEEP     = new THREE.Color(0x32503e);   // deep teal-green depth
const C_PEARL    = new THREE.Color(0xe6e6d6);   // soft cool pearl (polar)
const C_TEXT     = new THREE.Color(0xf6e2b6);   // warm cream-gold (contrasts green)

const SAKURA_PALETTE = [
    new THREE.Color(0xc89aa6),
    new THREE.Color(0xb08a96),
    new THREE.Color(0xd4a8b0),
    new THREE.Color(0xa87a88),
];

const RADIUS         = 2.3;
const SAKURA_TOP     = 7;
const SAKURA_BOTTOM  = -7;
const SAKURA_HEIGHT  = SAKURA_TOP - SAKURA_BOTTOM + 4;

// ── Body / text shader ─────────────────────────────────────────────────────
const BODY_VERT = /* glsl */`
attribute vec2  aSakuraXZ;
attribute vec2  aSakuraSpeed;
attribute vec2  aSakuraPhase;
attribute vec3  aEarthColor;
attribute vec3  aSakuraColor;
attribute float aSize;
attribute float aSakuraVisible;

uniform float uTime;
uniform float uSakuraTime;
uniform float uPhase;          // 0 = pure Earth, 1 = pure Sakura
uniform float uPulse;          // 0..1 anticipation pulse — uniform inward squeeze
uniform float uForm;           // 0..1 initial form-in scale
uniform float uEarthRotY;      // CPU-driven Y-axis rotation
uniform vec3  uLightDir;       // unit vector for the cinematic key light
uniform float uTop;
uniform float uBottom;
uniform float uHeight;

varying vec3  vColor;
varying float vAlpha;
varying float vRotation;
varying float vPhase;

void main() {
    // ── Earth-mode position ──────────────────────────────────────────────
    // Rotate around Y, then a uniform anticipation squeeze (same factor for
    // every particle so the sphere stays spherical — no random vibration).
    float cy = cos(uEarthRotY);
    float sy = sin(uEarthRotY);
    vec3 earthPos = vec3(
        position.x * cy - position.z * sy,
        position.y,
        position.x * sy + position.z * cy
    );
    earthPos *= 1.0 - uPulse * 0.045;

    // ── Sakura-mode position ─────────────────────────────────────────────
    float st = uSakuraTime + aSakuraPhase.x;
    float fallen = mod(st * aSakuraSpeed.x, uHeight);
    float yS = uTop - fallen;
    float sway  = sin(st * aSakuraSpeed.y + aSakuraPhase.y) * 0.55;
    float drift = cos(st * aSakuraSpeed.y * 0.7 + aSakuraPhase.y) * 0.30;
    vec3 sakuraPos = vec3(aSakuraXZ.x + sway, yS, aSakuraXZ.y + drift);

    // Smoothstep morph factor — gentle ease-in/out.
    float ePhase = uPhase * uPhase * (3.0 - 2.0 * uPhase);

    vec3 pos   = mix(earthPos,    sakuraPos,    ePhase);
    vec3 color = mix(aEarthColor, aSakuraColor, ePhase);

    // ── Cinematic Earth shading ─────────────────────────────────────────
    // Half-Lambert keeps the dark side velvety, never black. A soft rim glow
    // bumps the silhouette so the planet pops gently against the starfield.
    // Both effects fade off as we morph into petals (ePhase → 1).
    //
    // Safety: if earthPos is the zero vector (e.g. text-slot particles in
    // fresh sakura mode whose position attribute is (0,0,0)), normalize
    // returns NaN and the NaN propagates through colour into the framebuffer.
    // Guard with a length check and a benign default normal so no fragment
    // ever writes NaN — this was causing intermittent black frames on open_palm.
    float earthLen = length(earthPos);
    vec3 worldNormal = earthLen > 0.0001 ? earthPos / earthLen : vec3(0.0, 1.0, 0.0);

    float halfLambert = 0.5 + 0.5 * dot(worldNormal, uLightDir);
    halfLambert = halfLambert * halfLambert;       // softens the falloff
    float lit = 0.65 + 0.45 * halfLambert;         // 0.65..1.10 envelope

    vec3 worldEarthPos = (modelMatrix * vec4(earthPos, 1.0)).xyz;
    vec3 viewDir = normalize(cameraPosition - worldEarthPos);
    float rim = pow(1.0 - max(dot(worldNormal, viewDir), 0.0), 2.6);

    color *= mix(1.0, lit, 1.0 - ePhase);
    // Soft mint-aqua rim glow — complements the green palette without warming.
    color += vec3(0.08, 0.16, 0.13) * rim * (1.0 - ePhase);

    // Slight glow during the anticipation pulse — Earth-only.
    color *= 1.0 + uPulse * 0.22 * (1.0 - ePhase);

    // ── Visibility (Sakura wrap-fade + density mask) ─────────────────────
    float visTop = smoothstep(uTop,    uTop    - 2.0, pos.y);
    float visBot = smoothstep(uBottom, uBottom + 2.0, pos.y);
    float sakuraMask = mix(1.0, aSakuraVisible, ePhase);
    float visibility = mix(1.0, visTop * visBot, ePhase) * sakuraMask;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;

    // Earth points: tiny so the sparse Fibonacci grid reads as scattered glow.
    // Sakura petals: deliberately larger so each petal has clear shape and the
    // wind feels full even with the same particle pool driving the planet.
    float earthSize  = aSize * 0.34;
    float sakuraSize = aSize * 1.20;
    float currentSize = mix(earthSize, sakuraSize, ePhase);
    gl_PointSize = currentSize * uForm * (180.0 / max(-mvPos.z, 0.1));

    vColor    = color;
    vAlpha    = visibility * uForm;
    vRotation = aSakuraPhase.y + st * aSakuraSpeed.y * 0.55;
    vPhase    = ePhase;
}
`;

const BODY_FRAG = /* glsl */`
varying vec3  vColor;
varying float vAlpha;
varying float vRotation;
varying float vPhase;

uniform float uOpacity;
uniform float uConfidence;

void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv);

    // Earth: soft round disc — dense overlap reads as continuous marble.
    float roundShape = smoothstep(0.5, 0.0, r);

    // Sakura petal: rotated stretched ellipse.
    vec2 puv = uv * 2.0;
    float c = cos(vRotation), s = sin(vRotation);
    puv = mat2(c, -s, s, c) * puv;
    puv.x *= 1.45;
    float petalR = length(puv);
    float petalShape = smoothstep(0.95, 0.45, petalR);

    float shape = mix(roundShape, petalShape, vPhase);
    if (shape < 0.02) discard;

    float petalHighlight = smoothstep(0.55, 0.0, petalR) * 0.18 * vPhase;

    gl_FragColor = vec4(
        vColor * (0.92 + petalHighlight),
        vAlpha * uOpacity * uConfidence * shape
    );
}
`;

// ── Atmospheric halo ───────────────────────────────────────────────────────
// Single soft fresnel-rim sphere. Very low alpha so it lifts the silhouette
// without competing with the planet — pure cinematic mood.

const HALO_RADIUS = 2.55;

const HALO_VERT = /* glsl */`
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const HALO_FRAG = /* glsl */`
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
uniform float uOpacity;
uniform float uForm;
uniform float uVisible;
uniform vec3  uColor;
void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = 1.0 - max(dot(vWorldNormal, viewDir), 0.0);
    fresnel = pow(fresnel, 2.8);
    float a = fresnel * 0.22 * uOpacity * uForm * uVisible;
    gl_FragColor = vec4(uColor, a);
}
`;

// ── Orbital ring ───────────────────────────────────────────────────────────
// Single thin band of soft particles. Independent slow rotation, gentle
// twinkle, additive blending for a luminous glow trail.

const RING_RADIUS = 3.25;
const RING_TILT   = 0.20;          // ≈ 11.5° tip
const RING_COUNT  = 700;

const RING_PALETTE = [
    new THREE.Color(0xc8d4cc),     // pale mint pearl
    new THREE.Color(0xc0cec4),     // soft sage pearl
    new THREE.Color(0xd6dcd0),     // warm pale sage
    new THREE.Color(0xe2dcc8),     // warm cream pearl
];

const RING_VERT = /* glsl */`
attribute float aRingAngle;
attribute float aRingOffset;     // small radial offset around RING_RADIUS
attribute float aRingY;
attribute float aRingPhase;
attribute float aRingSize;
attribute vec3  aRingColor;

uniform float uTime;
uniform float uForm;
uniform float uVisible;
uniform float uRingRadius;

varying vec3  vColor;
varying float vTwinkle;

void main() {
    // Independent slow rotation, decoupled from the planet's spin.
    float angle = aRingAngle + uTime * 0.16;
    float r = uRingRadius + aRingOffset;
    vec3 pos = vec3(r * cos(angle), aRingY, r * sin(angle));

    // Tilt the orbit plane on the X axis.
    float c = cos(${RING_TILT.toFixed(3)});
    float s = sin(${RING_TILT.toFixed(3)});
    pos = vec3(pos.x, pos.y * c - pos.z * s, pos.y * s + pos.z * c);

    vColor = aRingColor;
    // Diffused twinkle — narrow band so the ring breathes rather than blinks.
    vTwinkle = 0.55 + 0.20 * sin(uTime * 1.5 + aRingPhase);

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aRingSize * uForm * uVisible * (140.0 / max(-mv.z, 0.1));
}
`;

const RING_FRAG = /* glsl */`
varying vec3  vColor;
varying float vTwinkle;
uniform float uOpacity;
uniform float uConfidence;
uniform float uVisible;
void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv);
    if (r > 0.5) discard;
    // Wide soft falloff — additive overlap reads as a diffused luminous trail.
    float core = smoothstep(0.5, 0.05, r);
    float a = core * vTwinkle * uOpacity * uConfidence * uVisible * 0.35;
    gl_FragColor = vec4(vColor, a);
}
`;

export class LifeOrb extends BaseObject {
    constructor(initialMode = 'earth') {
        super();
        this.formDuration  = 1.8;
        this.exitDuration  = 1.5;
        this.morphDuration = 2.6;     // 0.0..0.4 pulse peak, 0.3..2.6 morph

        this._mode       = initialMode;
        this._sakuraTime = initialMode === 'sakura' ? 30 + Math.random() * 30 : 0;
        this._earthRotY  = 0;
        this._disposed   = false;

        this._build();

        if (initialMode === 'earth') {
            // Async font load; text slots remain invisible (size 0) until done.
            this._loadText().catch((err) => console.error('LifeOrb text load failed:', err));
        }
    }

    // SceneManager calls this when it detects a fist→open_palm transition,
    // so the orb morphs in place rather than being swapped out.
    canMorphTo(gesture) {
        return gesture === 'open_palm'
            && this._mode === 'earth'
            && (this.state === 'idle' || this.state === 'forming');
    }

    requestMorph() {
        if (this._mode !== 'earth') return;
        if (this.state === 'dissolving' || this.state === 'done') return;
        if (this.state === 'forming' && this.material) {
            this.material.uniforms.uForm.value = 1;
        }
        this.state = 'morphing';
        this._t = 0;
    }

    // ── Marbled-glass colour mapper ─────────────────────────────────────────
    // Two low-frequency noise channels blend forest ↔ leaf ↔ mint in a flowing
    // wash; latitude pulls toward warm pearl at the poles and toward the deep
    // teal-green at the equator. No hard thresholds — purely continuous
    // gradients, so the surface reads as marbled emerald glass.
    _earthColorAt(x, y, z) {
        const lat = Math.abs(y);
        const n1  = fbm(x * 1.6, y * 1.6, z * 1.6);
        const n2  = fbm(x * 0.9 + 4.2, y * 0.9 + 1.7, z * 0.9 + 9.1);

        // Forest → leaf along n1, then a mint highlight where n2 is high.
        const c = C_FOREST.clone().lerp(C_LEAF, n1);
        c.lerp(C_MINT, Math.max(0, n2 - 0.35) * 1.6);

        // Polar caps fade to soft pearl.
        const polarPull = Math.pow(lat, 4.0);
        c.lerp(C_PEARL, polarPull * 0.80);

        // Equatorial belt darkens to deep teal-green.
        const equatorPull = Math.pow(1 - lat, 3.0) * 0.22;
        c.lerp(C_DEEP, equatorPull);

        return c;
    }

    _build() {
        // Sparser body density — the surface should read as scattered glowing
        // points across an emerald sphere, not as a continuous marble shell.
        const bodyCount = 6500;
        const textCount = 2200;
        const total = bodyCount + textCount;
        this._bodyCount = bodyCount;
        this._textCount = textCount;

        const positions     = new Float32Array(total * 3);
        const sakuraXZ      = new Float32Array(total * 2);
        const sakuraSpeed   = new Float32Array(total * 2);
        const sakuraPhase   = new Float32Array(total * 2);
        const earthColors   = new Float32Array(total * 3);
        const sakuraColors  = new Float32Array(total * 3);
        const sizes         = new Float32Array(total);
        const sakuraVisible = new Float32Array(total);

        // ~72% of body particles participate in Sakura mode. Earth stays
        // sparse (we cut bodyCount and use a small earth size multiplier),
        // but the wind reads as a fuller petal field.
        const SAKURA_VISIBLE_RATIO = 0.72;
        const golden = Math.PI * (3 - Math.sqrt(5));

        // ── Body — Fibonacci sphere with marbled colours ──────────────────
        for (let i = 0; i < bodyCount; i++) {
            const y = 1 - (i / (bodyCount - 1)) * 2;
            const r = Math.sqrt(1 - y * y);
            const theta = golden * i;
            const x = Math.cos(theta) * r;
            const z = Math.sin(theta) * r;

            positions[i * 3]     = x * RADIUS;
            positions[i * 3 + 1] = y * RADIUS;
            positions[i * 3 + 2] = z * RADIUS;

            const col = this._earthColorAt(x, y, z);
            earthColors[i * 3]     = col.r;
            earthColors[i * 3 + 1] = col.g;
            earthColors[i * 3 + 2] = col.b;

            const sc = SAKURA_PALETTE[(Math.random() * SAKURA_PALETTE.length) | 0];
            sakuraColors[i * 3]     = sc.r;
            sakuraColors[i * 3 + 1] = sc.g;
            sakuraColors[i * 3 + 2] = sc.b;

            sakuraXZ[i * 2]      = (Math.random() - 0.5) * 16.0;
            sakuraXZ[i * 2 + 1]  = (Math.random() - 0.5) * 10.0;
            sakuraSpeed[i * 2]   = 0.65 + Math.random() * 0.80;
            sakuraSpeed[i * 2+1] = 0.50 + Math.random() * 0.70;
            sakuraPhase[i * 2]   = Math.random() * 18;
            sakuraPhase[i * 2+1] = Math.random() * Math.PI * 2;

            sizes[i] = 1.40 + Math.random() * 0.90;
            sakuraVisible[i] = Math.random() < SAKURA_VISIBLE_RATIO ? 1 : 0;
        }

        // ── Text slots — sized to 0; _loadText fills them in once font ready
        // Even though they're invisible (size 0), give them a real position on
        // the sphere so the shader's normalize(earthPos) can't blow up when
        // _loadText never runs (fresh open_palm path).
        for (let i = bodyCount; i < total; i++) {
            sizes[i] = 0;
            sakuraVisible[i] = Math.random() < SAKURA_VISIBLE_RATIO ? 1 : 0;

            const ty = 1 - 2 * Math.random();
            const tr = Math.sqrt(Math.max(0, 1 - ty * ty));
            const tt = Math.random() * Math.PI * 2;
            positions[i * 3]     = Math.cos(tt) * tr * RADIUS;
            positions[i * 3 + 1] = ty * RADIUS;
            positions[i * 3 + 2] = Math.sin(tt) * tr * RADIUS;

            const sc = SAKURA_PALETTE[(Math.random() * SAKURA_PALETTE.length) | 0];
            sakuraColors[i * 3]     = sc.r;
            sakuraColors[i * 3 + 1] = sc.g;
            sakuraColors[i * 3 + 2] = sc.b;

            sakuraXZ[i * 2]      = (Math.random() - 0.5) * 16.0;
            sakuraXZ[i * 2 + 1]  = (Math.random() - 0.5) * 10.0;
            sakuraSpeed[i * 2]   = 0.65 + Math.random() * 0.80;
            sakuraSpeed[i * 2+1] = 0.50 + Math.random() * 0.70;
            sakuraPhase[i * 2]   = Math.random() * 18;
            sakuraPhase[i * 2+1] = Math.random() * Math.PI * 2;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position',       new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('aSakuraXZ',      new THREE.BufferAttribute(sakuraXZ, 2));
        geo.setAttribute('aSakuraSpeed',   new THREE.BufferAttribute(sakuraSpeed, 2));
        geo.setAttribute('aSakuraPhase',   new THREE.BufferAttribute(sakuraPhase, 2));
        geo.setAttribute('aEarthColor',    new THREE.BufferAttribute(earthColors, 3));
        geo.setAttribute('aSakuraColor',   new THREE.BufferAttribute(sakuraColors, 3));
        geo.setAttribute('aSize',          new THREE.BufferAttribute(sizes, 1));
        geo.setAttribute('aSakuraVisible', new THREE.BufferAttribute(sakuraVisible, 1));

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                uTime:       { value: 0 },
                uSakuraTime: { value: this._sakuraTime },
                uPhase:      { value: this._mode === 'sakura' ? 1.0 : 0.0 },
                uPulse:      { value: 0 },
                uForm:       { value: 0 },
                uOpacity:    { value: 1.0 },
                uConfidence: { value: 1.0 },
                uEarthRotY:  { value: 0 },
                // Cinematic key light — slightly up + to the right + toward camera.
                uLightDir:   { value: new THREE.Vector3(0.45, 0.40, 0.80).normalize() },
                uTop:        { value: SAKURA_TOP },
                uBottom:     { value: SAKURA_BOTTOM },
                uHeight:     { value: SAKURA_HEIGHT },
            },
            vertexShader:   BODY_VERT,
            fragmentShader: BODY_FRAG,
            transparent: true,
            depthWrite: false,
            blending: THREE.NormalBlending,
        });

        this.points = new THREE.Points(geo, this.material);
        this.group.add(this.points);

        this._buildHalo();
        this._buildRing();
    }

    _buildHalo() {
        const geo = new THREE.SphereGeometry(HALO_RADIUS, 48, 32);
        this.haloMat = new THREE.ShaderMaterial({
            uniforms: {
                uOpacity: { value: 1.0 },
                uForm:    { value: 0 },
                uVisible: { value: this._mode === 'sakura' ? 0 : 1 },
                uColor:   { value: new THREE.Color(0xa8c8b4) },   // mint-cyan glow
            },
            vertexShader:   HALO_VERT,
            fragmentShader: HALO_FRAG,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            side: THREE.FrontSide,
        });
        this.halo = new THREE.Mesh(geo, this.haloMat);
        this.group.add(this.halo);
    }

    _buildRing() {
        const angles    = new Float32Array(RING_COUNT);
        const offsets   = new Float32Array(RING_COUNT);
        const ys        = new Float32Array(RING_COUNT);
        const phases    = new Float32Array(RING_COUNT);
        const sizes     = new Float32Array(RING_COUNT);
        const colors    = new Float32Array(RING_COUNT * 3);
        const positions = new Float32Array(RING_COUNT * 3);   // unused; shader rebuilds pos

        for (let i = 0; i < RING_COUNT; i++) {
            angles[i] = Math.random() * Math.PI * 2;
            // Tight Gaussian-style spread (avg of two uniforms) around the band centre.
            offsets[i] = (Math.random() + Math.random() - 1) * 0.06;
            ys[i]      = (Math.random() - 0.5) * 0.04;
            phases[i]  = Math.random() * Math.PI * 2;
            sizes[i]   = 0.45 + Math.random() * 0.55;

            const c = RING_PALETTE[(Math.random() * RING_PALETTE.length) | 0];
            colors[i * 3]     = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position',    new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('aRingAngle',  new THREE.BufferAttribute(angles, 1));
        geo.setAttribute('aRingOffset', new THREE.BufferAttribute(offsets, 1));
        geo.setAttribute('aRingY',      new THREE.BufferAttribute(ys, 1));
        geo.setAttribute('aRingPhase',  new THREE.BufferAttribute(phases, 1));
        geo.setAttribute('aRingSize',   new THREE.BufferAttribute(sizes, 1));
        geo.setAttribute('aRingColor',  new THREE.BufferAttribute(colors, 3));

        this.ringMat = new THREE.ShaderMaterial({
            uniforms: {
                uTime:       { value: 0 },
                uForm:       { value: 0 },
                uVisible:    { value: this._mode === 'sakura' ? 0 : 1 },
                uOpacity:    { value: 1.0 },
                uConfidence: { value: 1.0 },
                uRingRadius: { value: RING_RADIUS },
            },
            vertexShader:   RING_VERT,
            fragmentShader: RING_FRAG,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });

        this.ring = new THREE.Points(geo, this.ringMat);
        this.group.add(this.ring);
    }

    async _loadText() {
        // gentilis_bold has rounder, friendlier glyphs than helvetiker.
        const font = await loadFont('gentilis_bold');
        if (this._disposed) return;
        if (this.state !== 'forming' && this.state !== 'idle') return;
        if (this._mode !== 'earth') return;

        const textGeo = new TextGeometry('T  &  N', {
            font,
            size: 0.55,
            depth: 0.08,
            curveSegments: 8,
            bevelEnabled: true,
            bevelThickness: 0.04,
            bevelSize: 0.035,
            bevelSegments: 3,
        });
        textGeo.center();

        const tempMat = new THREE.MeshBasicMaterial();
        const sampler = new MeshSurfaceSampler(new THREE.Mesh(textGeo, tempMat)).build();

        const positions   = this.points.geometry.attributes.position.array;
        const earthColors = this.points.geometry.attributes.aEarthColor.array;
        const sizes       = this.points.geometry.attributes.aSize.array;

        const tmp   = new THREE.Vector3();
        const start = this._bodyCount;
        const limit = RADIUS * 0.85;

        for (let i = 0; i < this._textCount; i++) {
            sampler.sample(tmp);
            tmp.z = 0;
            const r2 = tmp.x * tmp.x + tmp.y * tmp.y;
            if (r2 > limit * limit) {
                sizes[start + i] = 0;
                continue;
            }
            // Sit just barely proud of the surface so the letters share the
            // planet's lighting and rim glow — they read as part of the marble
            // rather than a flat overlay.
            const sphereZ = Math.sqrt(RADIUS * RADIUS - r2);
            const len     = Math.sqrt(r2 + sphereZ * sphereZ);
            const factor  = (RADIUS + 0.02) / len;
            const idx = (start + i) * 3;
            positions[idx]     = tmp.x   * factor;
            positions[idx + 1] = tmp.y   * factor;
            positions[idx + 2] = sphereZ * factor;

            earthColors[idx]     = C_TEXT.r;
            earthColors[idx + 1] = C_TEXT.g;
            earthColors[idx + 2] = C_TEXT.b;

            sizes[start + i] = 0.85 + Math.random() * 0.35;
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

        // Steady Y-axis rotation drives the cinematic terminator drift.
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
            // Anticipation pulse: brief uniform inward squeeze that peaks at
            // 0.4s and decays by 1.0s. Replaces the old chaotic vibration.
            let pulse;
            if (t < 0.4)        pulse = t / 0.4;
            else if (t < 1.0)   pulse = 1 - (t - 0.4) / 0.6;
            else                pulse = 0;
            m.uniforms.uPulse.value = pulse;

            const morphP = Math.max(0, Math.min(1, (t - 0.3) / (this.morphDuration - 0.3)));
            m.uniforms.uPhase.value = morphP;

            if (t >= this.morphDuration) {
                this.state = 'idle';
                this._mode = 'sakura';
                m.uniforms.uPhase.value = 1;
                m.uniforms.uPulse.value = 0;
                this._t = 0;
            }
        } else if (this.state === 'dissolving') {
            const p = Math.min(this._t / this.exitDuration, 1);
            m.uniforms.uOpacity.value = 1 - p * p * p;          // easeInCubic
            if (p >= 1) this.state = 'done';
        }

        if (this.state === 'idle') {
            m.uniforms.uForm.value = 1;
            this._confidenceSmooth +=
                (this._confidenceTarget - this._confidenceSmooth) * 0.12;
            m.uniforms.uConfidence.value = this._confidenceSmooth;
        }

        // Sakura time advances proportional to morph phase.
        const phase = m.uniforms.uPhase.value;
        this._sakuraTime += dt * phase;
        m.uniforms.uSakuraTime.value = this._sakuraTime;

        // Ring + halo share form / opacity / confidence with the planet, and
        // fade out as the morph crosses ~30% — they disappear before the
        // petals start falling.
        const ringFade = 1 - Math.min(1, Math.max(0, phase / 0.30));
        if (this.ringMat) {
            const ru = this.ringMat.uniforms;
            ru.uTime.value       = time;
            ru.uForm.value       = m.uniforms.uForm.value;
            ru.uOpacity.value    = m.uniforms.uOpacity.value;
            ru.uConfidence.value = m.uniforms.uConfidence.value;
            ru.uVisible.value    = ringFade;
        }
        if (this.haloMat) {
            const hu = this.haloMat.uniforms;
            hu.uForm.value    = m.uniforms.uForm.value;
            hu.uOpacity.value = m.uniforms.uOpacity.value;
            hu.uVisible.value = ringFade;
        }

        this.onUpdate(dt, time, hand, camera);
    }

    dispose() {
        this._disposed = true;
        super.dispose();
    }
}
