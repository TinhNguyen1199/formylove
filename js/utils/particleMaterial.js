import * as THREE from 'three';

// Shared GLSL for all gesture objects. Particles can:
//   - form up from a random scatter (dissolve = 0 → 1)
//   - hold their target shape (dissolve = 1)
//   - shatter outward (dissolve = 1 → 2)
// They also breathe gently while idle, which sells the "alive" feeling.

const VERT = /* glsl */`
attribute vec3 dispDir;
attribute vec3 pColor;
attribute float pSize;

uniform float uTime;
uniform float uDissolve;     // 0 .. 1 forming · 1 idle · 1 .. 2 dissolving
uniform float uPointScale;
uniform float uScatter;      // distance particles start from (forming) / fly to (dissolving)
uniform float uBreath;
uniform float uGravity;      // 0 = expand outward · 1 = fall under gravity (cleanup)

varying vec3 vColor;
varying float vAlpha;

void main() {
    vColor = pColor;

    vec3 pos;
    float alpha;

    if (uDissolve <= 1.0) {
        float p = clamp(uDissolve, 0.0, 1.0);
        float e = 1.0 - pow(1.0 - p, 3.0);     // easeOutCubic
        vec3 scatter = position + dispDir * uScatter;
        pos = mix(scatter, position, e);
        alpha = smoothstep(0.0, 0.85, p);
    } else {
        float p = clamp(uDissolve - 1.0, 0.0, 1.0);
        float e = pow(p, 1.4);

        // Outward shatter — used when one gesture replaces another.
        vec3 expandPos = position + dispDir * uScatter * e;

        // Gravity cleanup — used when no gesture is held. Particles get a small
        // horizontal kick (so they don't fall in a perfect column) and a t² fall.
        vec3 horizontal = vec3(dispDir.x, 0.0, dispDir.z) * uScatter * 0.18 * p;
        vec3 gravityPos = position + horizontal;
        gravityPos.y -= 9.0 * p * p;

        pos = mix(expandPos, gravityPos, uGravity);

        // Under gravity, fade slightly later so particles travel before vanishing.
        float fadeStart = mix(0.4, 0.6, uGravity);
        alpha = 1.0 - smoothstep(fadeStart, 1.0, p);
    }

    float breath = sin(uTime * 1.4 + dot(position, vec3(1.7, 0.9, 1.3))) * uBreath;
    pos += dispDir * breath;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPos;
    gl_PointSize = pSize * uPointScale * (180.0 / max(-mvPos.z, 0.1));

    vAlpha = clamp(alpha, 0.0, 1.0);
}
`;

const FRAG = /* glsl */`
varying vec3 vColor;
varying float vAlpha;
uniform float uOpacity;

void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;

    // Soft round glow — narrow bright core + gentle halo. Multipliers kept low so
    // additive overlap stays muted instead of compounding into glare.
    float core = smoothstep(0.45, 0.0, d) * 0.7;
    float halo = smoothstep(0.5, 0.20, d) * 0.3;
    float intensity = core + halo;

    gl_FragColor = vec4(vColor * (0.5 + halo * 0.25), vAlpha * uOpacity * intensity);
}
`;

export function makeParticleMaterial({ pointScale = 1.0, scatter = 8.0, breath = 0.05 } = {}) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime:       { value: 0.0 },
            uDissolve:   { value: 0.0 },
            uPointScale: { value: pointScale },
            uScatter:    { value: scatter },
            uBreath:     { value: breath },
            uOpacity:    { value: 1.0 },
            uGravity:    { value: 0.0 },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    });
}

// Helper: build BufferGeometry from an array of target {pos, color, size}.
// Each particle gets a random unit direction used by both form-in and dissolve-out.
export function buildParticleGeometry(samples) {
    const n = samples.length;
    const positions = new Float32Array(n * 3);
    const dirs      = new Float32Array(n * 3);
    const colors    = new Float32Array(n * 3);
    const sizes     = new Float32Array(n);

    for (let i = 0; i < n; i++) {
        const s = samples[i];
        positions[i * 3]     = s.pos.x;
        positions[i * 3 + 1] = s.pos.y;
        positions[i * 3 + 2] = s.pos.z;

        // Bias direction outward from origin so dissolves fly away rather than collapse.
        const len = Math.hypot(s.pos.x, s.pos.y, s.pos.z) || 1.0;
        const ox = s.pos.x / len, oy = s.pos.y / len, oz = s.pos.z / len;
        const rx = (Math.random() - 0.5) * 0.8;
        const ry = (Math.random() - 0.5) * 0.8;
        const rz = (Math.random() - 0.5) * 0.8;
        let dx = ox + rx, dy = oy + ry, dz = oz + rz;
        const dl = Math.hypot(dx, dy, dz) || 1.0;
        dirs[i * 3]     = dx / dl;
        dirs[i * 3 + 1] = dy / dl;
        dirs[i * 3 + 2] = dz / dl;

        colors[i * 3]     = s.color.r;
        colors[i * 3 + 1] = s.color.g;
        colors[i * 3 + 2] = s.color.b;

        sizes[i] = s.size ?? 1.0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('dispDir',  new THREE.BufferAttribute(dirs, 3));
    geo.setAttribute('pColor',   new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('pSize',    new THREE.BufferAttribute(sizes, 1));
    return geo;
}
