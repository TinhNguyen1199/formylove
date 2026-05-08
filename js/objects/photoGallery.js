import * as THREE from 'three';
import { listAllAsObjectUrls } from '../photoStore.js';

// Polaroid photo gallery — composites each user photo onto a cream paper
// background with the classic asymmetric polaroid border, then floats them
// as Sprites in a soft ring around the scene.
//
// Lifecycle helpers (load, addTo, setOpacity, update, dispose) let a parent
// gesture object plug the gallery into its own forming/idle/dissolving state
// without the gallery needing to know about it.
//
// Sources photos from two places, in this order:
//   1. file paths passed to the constructor (PERSONAL.photos — bundled)
//   2. IndexedDB blobs uploaded via PhotoManager (private, on-device only)

const PAPER_COLOR = '#f5ecdf';     // warm cream
const PHOTO_INSET = { top: 30, side: 30, bottom: 100 };   // px on a 512×600 canvas
const POLAROID_W  = 512;
const POLAROID_H  = 600;

function loadImageElement(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload  = () => resolve(img);
        img.onerror = () => reject(new Error(`PhotoGallery: failed to load ${src}`));
        img.src = src;
    });
}

// Paint photo + paper border onto a canvas, return the canvas. Photo is
// "cover-fit" inside the photo slot — never stretched, never letterboxed.
function compositePolaroid(image) {
    const canvas = document.createElement('canvas');
    canvas.width  = POLAROID_W;
    canvas.height = POLAROID_H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = PAPER_COLOR;
    ctx.fillRect(0, 0, POLAROID_W, POLAROID_H);

    const slotX = PHOTO_INSET.side;
    const slotY = PHOTO_INSET.top;
    const slotW = POLAROID_W - PHOTO_INSET.side * 2;
    const slotH = POLAROID_H - PHOTO_INSET.top - PHOTO_INSET.bottom;

    // Cover-fit (crop to fill slot).
    const imgRatio  = image.width / image.height;
    const slotRatio = slotW / slotH;
    let sx, sy, sw, sh;
    if (imgRatio > slotRatio) {
        sh = image.height;
        sw = sh * slotRatio;
        sx = (image.width - sw) / 2;
        sy = 0;
    } else {
        sw = image.width;
        sh = sw / slotRatio;
        sx = 0;
        sy = (image.height - sh) / 2;
    }
    ctx.drawImage(image, sx, sy, sw, sh, slotX, slotY, slotW, slotH);

    // Subtle inner shadow on the photo edge so the photo reads as inset, not
    // pasted on top.
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.10)';
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(slotX + 0.5, slotY + 0.5, slotW - 1, slotH - 1);

    return canvas;
}

export class PhotoGallery {
    constructor(paths = []) {
        this.paths = paths;
        this.group = new THREE.Group();
        this.entries = [];      // { sprite, mat, tex, basePos, phase }
        this._opacity = 0;
        this._opacityTarget = 0;
        this._loaded = false;
        this._privateUrls = []; // blob: URLs from IndexedDB — must revoke on dispose
    }

    // Async — call early, may resolve after the parent has already started
    // ticking. The sprites simply pop in (faded by setOpacity) once ready.
    async load() {
        // Bundled photos (file paths in PERSONAL.photos)
        const bundled = await Promise.allSettled(
            this.paths.map((p) => loadImageElement(p)),
        );

        // Private photos (IndexedDB) — fail-soft if storage is unavailable
        let privateRows = [];
        try { privateRows = await listAllAsObjectUrls(); }
        catch (_e) { privateRows = []; }

        this._privateUrls = privateRows.map((r) => r.url);
        const privateLoads = await Promise.allSettled(
            privateRows.map((r) => loadImageElement(r.url)),
        );

        const ok = [...bundled, ...privateLoads]
            .map((r) => (r.status === 'fulfilled' ? r.value : null))
            .filter(Boolean);

        if (ok.length === 0) {
            // No photos to show — quietly bail. The peace gesture still works
            // with just the "I love you" text.
            this._loaded = true;
            return;
        }

        // Oval layout: WIDE horizontally, SHORT vertically. The "I love you"
        // text sits at the centre (X span ≈ ±3, Y span ≈ ±0.5, plus the heart
        // off to the right). Polaroids ride an oval well outside that bounding
        // box, so positions at the equator (angle 0/π) sit far left/right and
        // positions at top/bottom angles sit clearly above/below the text.
        const X_RADIUS = 6.0;
        const Y_RADIUS = 2.7;
        const SCALE_W  = 1.35;
        const SCALE_H  = 1.60;

        const count = ok.length;
        for (let i = 0; i < count; i++) {
            const canvas = compositePolaroid(ok[i]);
            const tex = new THREE.CanvasTexture(canvas);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 8;

            const mat = new THREE.SpriteMaterial({
                map: tex,
                transparent: true,
                opacity: 0,
                depthWrite: false,
            });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(SCALE_W, SCALE_H, 1);

            // Even angular spacing with a small jitter so the ring doesn't
            // look stiff or geometric.
            const baseAngle    = (i / count) * Math.PI * 2;
            const angle        = baseAngle + (Math.random() - 0.5) * 0.22;
            const radiusJitter = 0.94 + Math.random() * 0.14;

            const x = Math.cos(angle) * X_RADIUS * radiusJitter;
            const y = Math.sin(angle) * Y_RADIUS * radiusJitter;
            // Tight z-jitter only — keeping polaroids near the text plane so
            // none of them push visually in front of the letters.
            const z = (Math.random() - 0.5) * 0.30;
            sprite.position.set(x, y, z);

            // Slight tilt — classic polaroid scatter.
            mat.rotation = (Math.random() - 0.5) * 0.32;

            const basePos = sprite.position.clone();
            const phase   = Math.random() * Math.PI * 2;
            this.entries.push({ sprite, mat, tex, basePos, phase });
            this.group.add(sprite);
        }

        this._loaded = true;
    }

    addTo(parent) { parent.add(this.group); }
    removeFrom(parent) { parent.remove(this.group); }

    // Driven by the parent (LoveText) so polaroids form/dissolve in lockstep
    // with the "I love you" particles.
    setOpacity(target) {
        this._opacityTarget = Math.max(0, Math.min(1, target));
    }

    update(dt, time) {
        // Smooth opacity tracking — avoids any pop when forming/dissolving.
        this._opacity += (this._opacityTarget - this._opacity) * 0.08;

        // No group rotation: with the oval lying in the XY plane, rotating
        // around Y would swing the side polaroids forward toward the camera
        // and they'd overlap the central text. Polaroids hold their slots; a
        // tiny per-sprite bob keeps the field alive without breaking layout.
        for (const entry of this.entries) {
            entry.mat.opacity = this._opacity;
            entry.sprite.position.y =
                entry.basePos.y + Math.sin(time * 0.4 + entry.phase) * 0.08;
        }
    }

    dispose() {
        for (const entry of this.entries) {
            entry.mat.dispose();
            entry.tex.dispose();
        }
        this.entries = [];
        for (const u of this._privateUrls) URL.revokeObjectURL(u);
        this._privateUrls = [];
    }
}
