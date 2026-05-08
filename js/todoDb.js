// IndexedDB wrapper for daily todos.
//
// One object store `todos` keyed by auto-increment id, with an index on
// `dayKey` (YYYY-MM-DD in local time) so we can efficiently query "today's
// list" without scanning the whole store. History from past days is kept
// silently — the UI only shows today, but the data is available later if a
// "lịch sử" view is added.

const DB_NAME    = 'birthday_todos';
const DB_VERSION = 1;
const STORE      = 'todos';

let _dbPromise = null;

function openDb() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE)) {
                const store = db.createObjectStore(STORE, {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                store.createIndex('dayKey', 'dayKey', { unique: false });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
    });
    return _dbPromise;
}

function tx(mode) {
    return openDb().then((db) => {
        const t = db.transaction(STORE, mode);
        return { store: t.objectStore(STORE), done: txDone(t) };
    });
}

function txDone(t) {
    return new Promise((resolve, reject) => {
        t.oncomplete = () => resolve();
        t.onerror    = () => reject(t.error);
        t.onabort    = () => reject(t.error);
    });
}

function reqAsPromise(req) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
    });
}

// Local-time YYYY-MM-DD. Using local time (not UTC) so the day rolls over at
// her midnight, not London's.
export function dayKeyOf(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export async function listByDay(dayKey) {
    const { store, done } = await tx('readonly');
    const idx = store.index('dayKey');
    const items = await reqAsPromise(idx.getAll(IDBKeyRange.only(dayKey)));
    await done;
    items.sort((a, b) => a.createdAt - b.createdAt);
    return items;
}

export async function addTodo(text, dayKey = dayKeyOf()) {
    const trimmed = String(text || '').trim();
    if (!trimmed) throw new Error('empty');
    const item = {
        text: trimmed,
        done: false,
        dayKey,
        createdAt: Date.now(),
        completedAt: null,
    };
    const { store, done } = await tx('readwrite');
    item.id = await reqAsPromise(store.add(item));
    await done;
    return item;
}

export async function setDone(id, isDone) {
    const { store, done } = await tx('readwrite');
    const cur = await reqAsPromise(store.get(id));
    if (!cur) { await done; return null; }
    cur.done = !!isDone;
    cur.completedAt = isDone ? Date.now() : null;
    await reqAsPromise(store.put(cur));
    await done;
    return cur;
}

export async function removeTodo(id) {
    const { store, done } = await tx('readwrite');
    await reqAsPromise(store.delete(id));
    await done;
}
