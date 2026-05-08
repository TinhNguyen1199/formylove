// Private photo store — IndexedDB-backed.
//
// Stores user-uploaded image blobs locally on her device. Nothing leaves the
// browser. Each entry: { id (auto), blob, type, addedAt, name }.
// PhotoGallery reads via `listAllAsObjectUrls()` which returns blob: URLs that
// can be passed straight into <img>.src; the caller is responsible for
// revoking them when the gallery disposes.

const DB_NAME    = 'birthday_private_photos';
const DB_VERSION = 1;
const STORE      = 'photos';

let _dbPromise = null;

function openDb() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                const os = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
                os.createIndex('addedAt', 'addedAt', { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
    });
    return _dbPromise;
}

function tx(db, mode = 'readonly') {
    return db.transaction(STORE, mode).objectStore(STORE);
}

// Resize/encode an image File before storing — keeps IndexedDB lean and
// matches the rest of the gallery's expected resolution (~1200px long side).
async function compressImage(file, maxSide = 1400, quality = 0.85) {
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise((res, rej) => {
            const i = new Image();
            i.onload  = () => res(i);
            i.onerror = () => rej(new Error('Decode failed'));
            i.src = url;
        });
        let { width, height } = img;
        const scale = Math.min(1, maxSide / Math.max(width, height));
        width  = Math.round(width  * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement('canvas');
        canvas.width  = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);

        const blob = await new Promise((res) =>
            canvas.toBlob(res, 'image/jpeg', quality),
        );
        return blob ?? file;
    } finally {
        URL.revokeObjectURL(url);
    }
}

export async function addPhoto(file) {
    if (!file || !file.type?.startsWith('image/')) {
        throw new Error('Chỉ chấp nhận file ảnh.');
    }
    const blob = await compressImage(file);
    const db   = await openDb();
    return new Promise((resolve, reject) => {
        const req = tx(db, 'readwrite').add({
            blob,
            type:    blob.type || 'image/jpeg',
            name:    file.name || 'photo',
            addedAt: Date.now(),
        });
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
    });
}

export async function deletePhoto(id) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const req = tx(db, 'readwrite').delete(id);
        req.onsuccess = () => resolve();
        req.onerror   = () => reject(req.error);
    });
}

export async function listAll() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const req = tx(db).getAll();
        req.onsuccess = () => resolve(req.result ?? []);
        req.onerror   = () => reject(req.error);
    });
}

// Convenience for code that just needs URLs. Caller MUST revoke each URL
// (URL.revokeObjectURL) when it no longer needs them.
export async function listAllAsObjectUrls() {
    const rows = await listAll();
    return rows.map((r) => ({
        id:      r.id,
        url:     URL.createObjectURL(r.blob),
        name:    r.name,
        addedAt: r.addedAt,
    }));
}

export async function count() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const req = tx(db).count();
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
    });
}
