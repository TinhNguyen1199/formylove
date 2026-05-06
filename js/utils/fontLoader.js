import { FontLoader } from 'three/addons/loaders/FontLoader.js';

const FONT_URL = 'https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json';

let cached = null;
export function loadFont() {
    if (cached) return cached;
    cached = new Promise((resolve, reject) => {
        new FontLoader().load(FONT_URL, resolve, undefined, reject);
    });
    return cached;
}
