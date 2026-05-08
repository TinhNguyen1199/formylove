// Time capsule — encrypted letters that unlock on a future birthday.
//
// Em viết một lá thư cho mình-tương-lai; nội dung được mã hoá bằng password
// (default: ngày sinh của em — same as the start gate). Capsule chỉ "mở" khi
// đã đến hoặc qua mốc unlockAt (mặc định: 27.5 năm sau).
//
// Ciphertext + IV + salt are stored in localStorage; nothing leaves the
// browser. Password derivation: PBKDF2-SHA256 (200k iterations) → AES-GCM.

const STORAGE_KEY = 'birthday_capsules';
const PBKDF2_ITERS = 200_000;
const BIRTHDAY_MONTH_INDEX = 4; // May (0-indexed)
const BIRTHDAY_DAY = 27;
const ONE_YEAR_MS = 365 * 24 * 3600 * 1000;

// ── Storage primitives ─────────────────────────────────────────────────────

function safeRead() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (_e) {
        return [];
    }
}

function safeWrite(list) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (_e) { /* incognito / quota — ignore */ }
}

// Compute the unlock timestamp: next May 27 that is at least one year out
// from createdAt, so a capsule written today always waits ~1y to ~2y.
export function computeUnlockAt(createdAt) {
    const created = new Date(createdAt);
    const minTarget = createdAt + ONE_YEAR_MS;
    let y = created.getFullYear();
    for (let i = 0; i < 4; i++) {
        const candidate = new Date(y, BIRTHDAY_MONTH_INDEX, BIRTHDAY_DAY).getTime();
        if (candidate >= minTarget) return candidate;
        y++;
    }
    return minTarget;   // fallback (unreachable)
}

// ── Crypto helpers ─────────────────────────────────────────────────────────

function bufToB64(buf) {
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

function b64ToBuf(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
}

async function deriveKey(password, saltBuf) {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey'],
    );
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: saltBuf, iterations: PBKDF2_ITERS, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt'],
    );
}

async function encryptText(plaintext, password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const key  = await deriveKey(password, salt);
    const ct   = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(plaintext),
    );
    return {
        ciphertext: bufToB64(ct),
        iv:         bufToB64(iv),
        salt:       bufToB64(salt),
    };
}

async function decryptText({ ciphertext, iv, salt }, password) {
    const key = await deriveKey(password, b64ToBuf(salt));
    const pt  = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: b64ToBuf(iv) },
        key,
        b64ToBuf(ciphertext),
    );
    return new TextDecoder().decode(pt);
}

// ── Public API ─────────────────────────────────────────────────────────────

export function listCapsules() {
    return safeRead().sort((a, b) => a.unlockAt - b.unlockAt);
}

export async function createCapsule({ title, body, password, unlockAt }) {
    if (!body || !body.trim()) throw new Error('Em viết gì đó nhé.');
    if (!password) throw new Error('Cần password để khoá lá thư này.');
    const createdAt = Date.now();
    const enc = await encryptText(body, password);
    const capsule = {
        id:        `cap_${createdAt}_${Math.random().toString(36).slice(2, 8)}`,
        title:     (title || '').trim().slice(0, 60),
        ...enc,
        createdAt,
        unlockAt:  unlockAt ?? computeUnlockAt(createdAt),
    };
    const list = safeRead();
    list.push(capsule);
    safeWrite(list);
    return capsule;
}

export async function decryptCapsule(capsule, password) {
    return decryptText(capsule, password);
}

export function deleteCapsule(id) {
    const list = safeRead().filter((c) => c.id !== id);
    safeWrite(list);
}

export function isUnlocked(capsule, now = Date.now()) {
    return now >= capsule.unlockAt;
}

// "Còn 134 ngày" / "Còn 5 giờ" / "Đã có thể mở"
export function lockCountdownLabel(capsule, now = Date.now()) {
    if (isUnlocked(capsule, now)) return 'Đã có thể mở';
    const ms = capsule.unlockAt - now;
    const days = Math.floor(ms / 86400000);
    if (days >= 1)   return `Còn ${days} ngày`;
    const hours = Math.floor(ms / 3600000);
    if (hours >= 1)  return `Còn ${hours} giờ`;
    const mins = Math.floor(ms / 60000);
    return `Còn ${mins} phút`;
}

export function formatDate(ts) {
    const d = new Date(ts);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}
