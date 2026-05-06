import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

import { BaseObject } from './baseObject.js';
import { makeParticleMaterial, buildParticleGeometry } from '../utils/particleMaterial.js';

// 3D heart of light, with HTML overlays for Vietnamese text.
// Two overlays: "Như" floats inside the heart, the birthday line drifts beneath it.
// Overlays are positioned by projecting world anchors to screen each frame, so they
// follow the scene's gentle hand-driven drift naturally.

const ANCHOR_INNER  = new THREE.Vector3(0, 0, 0.2);
const ANCHOR_BOTTOM = new THREE.Vector3(0, -2.5, 0);
const _projected = new THREE.Vector3();

export class FingerHeart extends BaseObject {
    constructor() {
        super();
        this.formDuration = 1.9;
        this.exitDuration = 1.3;

        this._buildHeartParticles();
        this._buildSparkles();
        this._buildOverlays();
    }

    _buildHeartParticles() {
        // Heart cross-section as a 2D Shape, then extrude into 3D.
        const shape = new THREE.Shape();
        const s = 1.2;
        shape.moveTo(0, 0.5 * s);
        shape.bezierCurveTo(0, 0.85 * s, -0.55 * s, 1.1 * s, -0.85 * s, 0.7 * s);
        shape.bezierCurveTo(-1.15 * s, 0.3 * s, -0.7 * s, -0.3 * s, 0, -0.85 * s);
        shape.bezierCurveTo(0.7 * s, -0.3 * s, 1.15 * s, 0.3 * s, 0.85 * s, 0.7 * s);
        shape.bezierCurveTo(0.55 * s, 1.1 * s, 0, 0.85 * s, 0, 0.5 * s);

        const geo = new THREE.ExtrudeGeometry(shape, {
            depth: 0.7,
            curveSegments: 24,
            bevelEnabled: true,
            bevelThickness: 0.18,
            bevelSize: 0.22,
            bevelSegments: 6,
        });
        geo.center();
        // Tilt slightly toward the viewer for a more dimensional look.
        geo.rotateX(-0.08);

        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
        const sampler = new MeshSurfaceSampler(mesh).build();

        const surfaceCount = 4500;
        const innerCount = 1200;

        // All four tones dimmed and desaturated. Even the brightest accent (colSoft)
        // sits well below 0.8 luminance so additive overlap never clips into glare.
        const colHot   = new THREE.Color(0x9a4868);
        const colWarm  = new THREE.Color(0xa07a8a);
        const colSoft  = new THREE.Color(0xb09599);
        const colDeep  = new THREE.Color(0x5d2a40);

        const samples = [];
        const tmp = new THREE.Vector3();

        // Outer surface — variation between hot pink and pale rose.
        for (let i = 0; i < surfaceCount; i++) {
            sampler.sample(tmp);
            const t = Math.random();
            const c = colHot.clone().lerp(colWarm, t);
            if (Math.random() < 0.05) c.lerp(colSoft, 0.6);
            samples.push({
                pos: { x: tmp.x, y: tmp.y, z: tmp.z },
                color: { r: c.r, g: c.g, b: c.b },
                size: 1.0 + Math.random() * 0.9,
            });
        }

        // Inner glow — a tighter, deeper-coloured cluster slightly recessed.
        for (let i = 0; i < innerCount; i++) {
            sampler.sample(tmp);
            tmp.multiplyScalar(0.62);
            const c = colDeep.clone().lerp(colHot, Math.random());
            samples.push({
                pos: { x: tmp.x, y: tmp.y, z: tmp.z },
                color: { r: c.r, g: c.g, b: c.b },
                size: 0.8 + Math.random() * 0.6,
            });
        }

        this.material = makeParticleMaterial({ pointScale: 1.0, scatter: 9.0, breath: 0.06 });
        this.points = new THREE.Points(buildParticleGeometry(samples), this.material);
        this.group.add(this.points);

        geo.dispose();
        mesh.material.dispose();
    }

    _buildSparkles() {
        // Drifting fairy dust around the heart.
        const count = 600;
        const positions = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const phases = new Float32Array(count);
        const colors = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            const r = 1.8 + Math.random() * 1.6;
            const th = Math.random() * Math.PI * 2;
            const ph = Math.acos(2 * Math.random() - 1);
            positions[i * 3]     = r * Math.sin(ph) * Math.cos(th);
            positions[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
            positions[i * 3 + 2] = r * Math.cos(ph) * 0.6;
            sizes[i] = 0.6 + Math.random() * 1.2;
            phases[i] = Math.random() * Math.PI * 2;

            // Sparkles in dim warm rose / champagne tones — far from white, so they
            // blend with the heart instead of competing with it.
            const tone = Math.random();
            colors[i * 3]     = 0.55 + tone * 0.10;       // R 0.55..0.65
            colors[i * 3 + 1] = 0.42 + tone * 0.12;       // G 0.42..0.54
            colors[i * 3 + 2] = 0.48 + tone * 0.12;       // B 0.48..0.60
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes, 1));
        geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1));
        geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.ShaderMaterial({
            uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            vertexShader: /* glsl */`
                attribute float aSize;
                attribute float aPhase;
                attribute vec3 color;
                uniform float uTime;
                varying vec3 vColor;
                varying float vTwinkle;
                void main() {
                    vColor = color;
                    float t = uTime + aPhase;
                    vec3 pos = position;
                    pos.x += sin(t * 0.8) * 0.05;
                    pos.y += cos(t * 0.6) * 0.05;
                    pos.z += sin(t * 0.7) * 0.05;
                    vTwinkle = 0.5 + 0.5 * sin(t * 2.0);
                    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
                    gl_Position = projectionMatrix * mv;
                    gl_PointSize = aSize * (115.0 / -mv.z);
                }
            `,
            fragmentShader: /* glsl */`
                varying vec3 vColor;
                varying float vTwinkle;
                uniform float uOpacity;
                void main() {
                    vec2 uv = gl_PointCoord - 0.5;
                    float d = length(uv);
                    if (d > 0.5) discard;
                    float a = smoothstep(0.5, 0.0, d) * vTwinkle * uOpacity;
                    gl_FragColor = vec4(vColor, a);
                }
            `,
        });

        this.sparkles = new THREE.Points(geo, mat);
        this.sparkleMat = mat;
        this.group.add(this.sparkles);
    }

    _buildOverlays() {
        const root = document.body;

        const inner = document.createElement('div');
        inner.className = 'fh-overlay fh-inner';
        inner.textContent = 'Như';

        const bottom = document.createElement('div');
        bottom.className = 'fh-overlay fh-bottom';
        bottom.innerHTML = 'Happy birthday babe<br/><span class="fh-sub">Như · 27.5</span>';

        root.appendChild(inner);
        root.appendChild(bottom);
        this.overlays = { inner, bottom };

        // Lazy-inject styles only once.
        if (!document.getElementById('fh-overlay-style')) {
            const style = document.createElement('style');
            style.id = 'fh-overlay-style';
            style.textContent = `
                .fh-overlay {
                    position: fixed;
                    left: 0; top: 0;
                    transform: translate(-50%, -50%);
                    pointer-events: none;
                    color: #fff;
                    text-align: center;
                    z-index: 6;
                    opacity: 0;
                    transition: opacity 0.6s ease;
                    will-change: transform, opacity;
                    font-family: 'Segoe UI', 'Helvetica Neue', system-ui, sans-serif;
                }
                .fh-inner {
                    font-size: 56px;
                    font-weight: 700;
                    letter-spacing: 1px;
                    color: #fff8fa;
                    text-shadow:
                        0 0 18px rgba(255, 111, 163, 0.95),
                        0 0 42px rgba(255, 111, 163, 0.6),
                        0 0 80px rgba(255, 200, 220, 0.45);
                }
                .fh-bottom {
                    font-size: 22px;
                    font-weight: 500;
                    letter-spacing: 1.5px;
                    color: #fff0f5;
                    text-shadow: 0 0 16px rgba(255, 111, 163, 0.6);
                    line-height: 1.5;
                }
                .fh-sub {
                    display: inline-block;
                    margin-top: 6px;
                    font-size: 16px;
                    letter-spacing: 4px;
                    text-transform: uppercase;
                    opacity: 0.85;
                }
                .fh-overlay.shown { opacity: 1; }
            `;
            document.head.appendChild(style);
        }
    }

    onUpdate(dt, time, _hand, camera) {
        this.group.rotation.y = Math.sin(time * 0.5) * 0.18;
        this.group.position.y = Math.sin(time * 0.9) * 0.04;

        // Pulse the heart with a heartbeat envelope (lub-dub).
        const beat = 1 + 0.04 * Math.exp(-((time * 1.2) % 1.0) * 6) + 0.025 * Math.exp(-((time * 1.2 + 0.3) % 1.0) * 6);
        this.points.scale.setScalar(beat);

        if (this.sparkleMat) {
            this.sparkleMat.uniforms.uTime.value = time;
            // Sparkles track the dissolve curve AND live gesture confidence — so
            // the entire composition (heart + glitter) breathes together with the pose.
            const d = this.material.uniforms.uDissolve.value;
            const formAlpha = Math.min(d, 1);
            const dissolveAlpha = d > 1 ? Math.max(0, 1 - (d - 1)) : 1;
            this.sparkleMat.uniforms.uOpacity.value = formAlpha * dissolveAlpha * this._confidenceSmooth;
            this.sparkles.rotation.z = time * 0.05;
        }

        this._positionOverlays(camera);
    }

    _positionOverlays(camera) {
        if (!camera || !this.overlays) return;
        const wantShown = this.state === 'forming' || this.state === 'idle';

        // Inner "Như"
        _projected.copy(ANCHOR_INNER).applyMatrix4(this.group.matrixWorld).project(camera);
        let sx = (_projected.x * 0.5 + 0.5) * window.innerWidth;
        let sy = (-_projected.y * 0.5 + 0.5) * window.innerHeight;
        this.overlays.inner.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`;

        _projected.copy(ANCHOR_BOTTOM).applyMatrix4(this.group.matrixWorld).project(camera);
        sx = (_projected.x * 0.5 + 0.5) * window.innerWidth;
        sy = (-_projected.y * 0.5 + 0.5) * window.innerHeight;
        this.overlays.bottom.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`;

        this.overlays.inner.classList.toggle('shown', wantShown);
        this.overlays.bottom.classList.toggle('shown', wantShown);
    }

    dispose() {
        super.dispose();
        if (this.overlays) {
            this.overlays.inner.classList.remove('shown');
            this.overlays.bottom.classList.remove('shown');
            // Let the CSS transition finish before removing.
            const innerEl = this.overlays.inner;
            const bottomEl = this.overlays.bottom;
            setTimeout(() => {
                innerEl.remove();
                bottomEl.remove();
            }, 700);
            this.overlays = null;
        }
    }
}
