import * as THREE from 'three';
import { BaseObject } from './baseObject.js';
import { makeParticleMaterial, buildParticleGeometry } from '../utils/particleMaterial.js';

// Cheap continuous noise — gives the planet's surface gentle variation without a lib.
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
    const c000 = hash3(xi, yi, zi),     c100 = hash3(xi + 1, yi, zi);
    const c010 = hash3(xi, yi + 1, zi), c110 = hash3(xi + 1, yi + 1, zi);
    const c001 = hash3(xi, yi, zi + 1), c101 = hash3(xi + 1, yi, zi + 1);
    const c011 = hash3(xi, yi + 1, zi + 1), c111 = hash3(xi + 1, yi + 1, zi + 1);
    return lerp(
        lerp(lerp(c000, c100, u), lerp(c010, c110, u), v),
        lerp(lerp(c001, c101, u), lerp(c011, c111, u), v),
        w,
    );
}
function fbm(x, y, z) {
    let v = 0, a = 0.5, f = 1;
    for (let i = 0; i < 4; i++) { v += smoothNoise(x * f, y * f, z * f) * a; a *= 0.5; f *= 2; }
    return v;
}

// Restrained mauve / dusty-rose palette, dimmed and desaturated so the planet
// reads as soft watercolour rather than glowing neon. No whites anywhere.
const PALETTE = {
    oceanDeep:  new THREE.Color(0x261d33),  // very deep mauve
    oceanShore: new THREE.Color(0x453856),  // soft mauve
    landMid:    new THREE.Color(0x6e5a6c),  // muted dusty rose
    landHigh:   new THREE.Color(0x8a767e),  // muted blush
    polar:      new THREE.Color(0x8a8095),  // muted lavender-grey
    ringWarm:   new THREE.Color(0x9a8470),  // muted champagne
    ringCool:   new THREE.Color(0x8a7882),  // muted pink-grey
};

export class Earth extends BaseObject {
    constructor() {
        super();
        this.formDuration = 1.9;
        this.exitDuration = 1.2;

        // One material shared between planet and ring — uniforms (uTime, uDissolve,
        // uGravity) tick in lockstep, so both form, breathe, and dissolve together.
        this.material = makeParticleMaterial({ pointScale: 0.55, scatter: 9.0, breath: 0.04 });

        this._buildBody();
        this._buildRing();
    }

    _buildBody() {
        const radius = 2.3;
        const count = 11000;
        const samples = [];

        // Fibonacci sphere — even coverage, no polar clumping.
        const golden = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < count; i++) {
            const y = 1 - (i / (count - 1)) * 2;
            const r = Math.sqrt(1 - y * y);
            const theta = golden * i;
            const x = Math.cos(theta) * r;
            const z = Math.sin(theta) * r;

            const px = x * radius, py = y * radius, pz = z * radius;
            const n = fbm(x * 2.2, y * 2.2, z * 2.2);
            const lat = Math.abs(y);

            // Three-tier classification within ONE colour family — limited and harmonious.
            let color;
            if (lat > 0.93) {
                color = PALETTE.polar;
            } else if (n > 0.22) {
                color = lat > 0.6 ? PALETTE.landMid : PALETTE.landHigh;
            } else if (n > 0.08) {
                color = PALETTE.oceanShore.clone().lerp(PALETTE.landMid, (n - 0.08) * 6.0);
            } else {
                color = PALETTE.oceanDeep.clone().lerp(PALETTE.oceanShore, n * 6.0 + 0.4);
            }

            samples.push({
                pos: { x: px, y: py, z: pz },
                color: { r: color.r, g: color.g, b: color.b },
                size: 0.42 + Math.random() * 0.30,
            });
        }

        this.bodyPoints = new THREE.Points(buildParticleGeometry(samples), this.material);
        this.bodyGroup = new THREE.Group();
        this.bodyGroup.add(this.bodyPoints);
        this.group.add(this.bodyGroup);
    }

    _buildRing() {
        const inner = 3.05;
        const outer = 4.55;
        const count = 5500;
        const tilt  = 0.42;          // ~24° — the Saturn look without being parallel to camera
        const samples = [];

        for (let i = 0; i < count; i++) {
            // Square-root sampling gives roughly equal density across the annulus.
            const r = Math.sqrt(inner * inner + Math.random() * (outer * outer - inner * inner));
            const theta = Math.random() * Math.PI * 2;
            const x = r * Math.cos(theta);
            const z = r * Math.sin(theta);
            const y = (Math.random() - 0.5) * 0.08;   // very thin disk

            // Two kinds of variation: a smooth radial gradient, and high-frequency
            // banding (Cassini-division-style gaps and dense regions).
            const t = (r - inner) / (outer - inner);
            const band = 0.55 + 0.45 * (Math.sin(t * 22) * 0.5 + 0.5);
            const c = PALETTE.ringWarm.clone().lerp(PALETTE.ringCool, t).multiplyScalar(band);

            samples.push({
                pos: { x, y, z },
                color: { r: c.r, g: c.g, b: c.b },
                size: 0.32 + Math.random() * 0.22,
            });
        }

        this.ringPoints = new THREE.Points(buildParticleGeometry(samples), this.material);
        this.ringGroup = new THREE.Group();
        this.ringGroup.rotation.x = tilt;
        this.ringGroup.add(this.ringPoints);
        this.group.add(this.ringGroup);
    }

    onUpdate(dt, time, _hand) {
        // Planet rotates slowly on its axis; ring spins independently around its own.
        this.bodyGroup.rotation.y += dt * 0.16;
        this.bodyGroup.rotation.x = Math.sin(time * 0.22) * 0.05;

        // Local-Y rotation inside the tilted ringGroup → ring orbits, then the parent
        // applies the 24° tilt, so the spin reads as a true 3D Saturn ring.
        this.ringPoints.rotation.y += dt * 0.32;
    }

    dispose() {
        // Material is shared between two Points — dispose explicitly to avoid the
        // BaseObject.traverse calling .dispose() on it twice.
        if (this.bodyPoints) this.bodyPoints.geometry.dispose();
        if (this.ringPoints) this.ringPoints.geometry.dispose();
        if (this.material) this.material.dispose();
    }
}
