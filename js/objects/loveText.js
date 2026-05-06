import * as THREE from 'three';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

import { BaseObject } from './baseObject.js';
import { makeParticleMaterial, buildParticleGeometry } from '../utils/particleMaterial.js';
import { loadFont } from '../utils/fontLoader.js';

// "I love you ♥" — a 3D text point cloud with a heart sampled alongside it.

export class LoveText extends BaseObject {
    constructor() {
        super();
        this.ready = false;
        this.formDuration = 1.7;
        this.exitDuration = 1.0;
        this._build().catch((err) => console.error('LoveText build failed', err));
    }

    async _build() {
        const font = await loadFont();
        if (this._disposed) return;

        // Letters
        const textGeo = new TextGeometry('I  love  you', {
            font,
            size: 0.85,
            height: 0.25,
            curveSegments: 8,
            bevelEnabled: true,
            bevelThickness: 0.03,
            bevelSize: 0.02,
            bevelSegments: 2,
        });
        textGeo.computeBoundingBox();
        textGeo.center();

        // Solid heart that sits to the right of the text.
        const heartShape = new THREE.Shape();
        heartShape.moveTo(0, 0.5);
        heartShape.bezierCurveTo(0, 0.85, -0.55, 1.1, -0.85, 0.7);
        heartShape.bezierCurveTo(-1.15, 0.3, -0.7, -0.3, 0, -0.85);
        heartShape.bezierCurveTo(0.7, -0.3, 1.15, 0.3, 0.85, 0.7);
        heartShape.bezierCurveTo(0.55, 1.1, 0, 0.85, 0, 0.5);

        const heartGeo = new THREE.ExtrudeGeometry(heartShape, {
            depth: 0.35,
            bevelEnabled: true,
            bevelThickness: 0.05,
            bevelSize: 0.05,
            bevelSegments: 2,
        });
        heartGeo.center();
        heartGeo.scale(0.7, 0.7, 0.7);

        const textWidth = textGeo.boundingBox.max.x - textGeo.boundingBox.min.x;
        heartGeo.translate(textWidth / 2 + 0.95, 0, 0);

        // Both colours are muted — additive blending plus bloom can compound bright
        // pixels into glare, so we start dim and let the glow lift them gently.
        const samples = [
            ...this._sampleSurface(textGeo,  4200, new THREE.Color(0xb59ea2), 0.03, [0.55, 0.85]),
            ...this._sampleSurface(heartGeo, 1400, new THREE.Color(0x82606e), 0.04, [0.40, 0.65]),
        ];

        const geometry = buildParticleGeometry(samples);
        this.material = makeParticleMaterial({ pointScale: 0.7, scatter: 7.0, breath: 0.05 });
        this.points = new THREE.Points(geometry, this.material);
        this.group.add(this.points);

        textGeo.dispose();
        heartGeo.dispose();

        // If we were waiting in 'forming' since enter() — restart cleanly now that we exist.
        if (this.state !== 'dissolving' && this.state !== 'done') {
            this._t = 0;
            this.state = 'forming';
            this.material.uniforms.uDissolve.value = 0;
        }
        this.ready = true;
    }

    _sampleSurface(geometry, count, baseColor, jitter, sizeRange = [0.55, 0.85]) {
        const mat = new THREE.MeshBasicMaterial();
        const mesh = new THREE.Mesh(geometry, mat);
        const sampler = new MeshSurfaceSampler(mesh).build();
        const out = [];
        const tmp = new THREE.Vector3();
        const [sMin, sMax] = sizeRange;
        for (let i = 0; i < count; i++) {
            sampler.sample(tmp);
            const c = baseColor.clone();
            c.r = Math.min(1, c.r + (Math.random() - 0.5) * jitter);
            c.g = Math.min(1, c.g + (Math.random() - 0.5) * jitter);
            c.b = Math.min(1, c.b + (Math.random() - 0.5) * jitter);
            out.push({
                pos: { x: tmp.x, y: tmp.y, z: tmp.z },
                color: { r: c.r, g: c.g, b: c.b },
                size: sMin + Math.random() * (sMax - sMin),
            });
        }
        mat.dispose();
        return out;
    }

    update(dt, time, hand, camera) {
        if (!this.ready) return;
        super.update(dt, time, hand, camera);
    }

    onUpdate(dt, time, _hand) {
        this.group.rotation.y = Math.sin(time * 0.5) * 0.18;
        this.group.position.y = Math.sin(time * 0.8) * 0.05;
    }

    isDone() {
        // If we got dissolved before loading finished, treat as done immediately.
        if (!this.ready && this.state === 'dissolving') return true;
        return super.isDone();
    }

    dispose() {
        this._disposed = true;
        super.dispose();
    }
}
