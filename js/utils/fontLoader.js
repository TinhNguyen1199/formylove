import { FontLoader } from 'three/addons/loaders/FontLoader.js';

// Available three.js example fonts on the CDN. Add more keys here as needed.
const FONT_URLS = {
    helvetiker:    'https://unpkg.com/three@0.160.0/examples/fonts/helvetiker_regular.typeface.json',
    gentilis_bold: 'https://unpkg.com/three@0.160.0/examples/fonts/gentilis_bold.typeface.json',
};

const cached = new Map();

export function loadFont(name = 'helvetiker') {
    if (cached.has(name)) return cached.get(name);
    const url = FONT_URLS[name];
    if (!url) return Promise.reject(new Error(`Unknown font: ${name}`));
    const p = new Promise((resolve, reject) => {
        new FontLoader().load(url, resolve, undefined, reject);
    });
    cached.set(name, p);
    return p;
}
