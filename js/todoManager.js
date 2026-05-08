// Daily-todo overlay controller.
//
// One list per day, persisted in IndexedDB (see todoDb.js). The UI only shows
// today's items; previous days remain in the DB silently.
//
// Soft callbacks let main.js wire in cánh-hoa confetti, cat XP, and a final
// celebration when the day's list goes 100% complete. All callbacks are
// optional — the manager works standalone.

import { listByDay, addTodo, setDone, removeTodo, dayKeyOf } from './todoDb.js';

const COMPLETION_LINES = [
    'Em làm hết todo hôm nay rồi · giỏi quá 💛',
    'Một ngày trọn vẹn · em xứng đáng nghỉ ngơi 🌸',
    'Hết việc rồi · ôm em một cái nè 🤍',
    'Today: hoàn thành · chúc em ngủ ngon nha 🌙',
    'Em là cô gái nhỏ làm được mọi việc · proud of you 💖',
];

export class TodoManager {
    constructor({
        toggle, overlay, list, input, addBtn, closeBtn, countEl,
        onCompleteOne,    // (item) => void   — every tick (cánh hoa rơi)
        onCompleteAll,    // ()     => void   — last todo of the day completed
    } = {}) {
        this.toggle    = toggle;
        this.overlay   = overlay;
        this.list      = list;
        this.input     = input;
        this.addBtn    = addBtn;
        this.closeBtn  = closeBtn;
        this.countEl   = countEl;
        this.onCompleteOne = onCompleteOne || null;
        this.onCompleteAll = onCompleteAll || null;

        this._dayKey = dayKeyOf();
        this._items  = [];

        this._wire();
        // Load count badge on boot so the chip reflects today's pending tasks
        // before em opens the overlay.
        this._refresh().catch((e) => console.warn('todo init', e));

        // Re-key at midnight so a session left open overnight rolls into the
        // new day cleanly. Re-checks the day every minute (cheap) and reloads
        // when it changes.
        setInterval(() => {
            const k = dayKeyOf();
            if (k !== this._dayKey) {
                this._dayKey = k;
                this._refresh().catch(() => {});
            }
        }, 60_000);
    }

    open()  { this._refresh().then(() => this.overlay?.classList.add('open')); }
    close() { this.overlay?.classList.remove('open'); }
    _toggleOpen() {
        if (this.overlay?.classList.contains('open')) this.close();
        else this.open();
    }

    _wire() {
        this.toggle?.addEventListener('click',   () => this._toggleOpen());
        this.closeBtn?.addEventListener('click', () => this.close());
        this.overlay?.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        this.addBtn?.addEventListener('click', () => this._handleAdd());
        this.input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._handleAdd();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay?.classList.contains('open')) {
                this.close();
            }
        });
    }

    async _refresh() {
        this._items = await listByDay(this._dayKey);
        this._render();
        this._refreshCount();
    }

    async _handleAdd() {
        const text = this.input?.value || '';
        if (!text.trim()) return;
        try {
            const item = await addTodo(text, this._dayKey);
            this.input.value = '';
            this._items.push(item);
            this._render();
            this._refreshCount();
            this.input?.focus();
        } catch (e) {
            console.warn('todo add failed', e);
        }
    }

    async _toggleItem(item, checkbox) {
        const wasDone = item.done;
        const nowDone = !wasDone;
        // Optimistic UI flip — rollback on failure.
        item.done = nowDone;
        item.completedAt = nowDone ? Date.now() : null;
        this._render();
        this._refreshCount();

        try {
            await setDone(item.id, nowDone);
        } catch (e) {
            console.warn('todo toggle failed', e);
            item.done = wasDone;
            this._render();
            this._refreshCount();
            return;
        }

        if (nowDone && !wasDone) {
            // Cánh hoa rơi for every tick.
            try { this.onCompleteOne?.(item); } catch (err) { console.warn(err); }

            // Final-celebration check: list is non-empty AND every item done.
            const allDone = this._items.length > 0 && this._items.every((i) => i.done);
            if (allDone) {
                try { this.onCompleteAll?.(this._pickCompletionLine()); }
                catch (err) { console.warn(err); }
            }
        }
    }

    async _deleteItem(item) {
        try {
            await removeTodo(item.id);
            this._items = this._items.filter((i) => i.id !== item.id);
            this._render();
            this._refreshCount();
        } catch (e) {
            console.warn('todo delete failed', e);
        }
    }

    _render() {
        if (!this.list) return;
        this.list.innerHTML = '';

        if (this._items.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'todo-empty';
            empty.textContent = 'Hôm nay em muốn làm gì? · viết một việc nhỏ ở dưới nhé.';
            this.list.appendChild(empty);
            return;
        }

        // Pending first, completed at the bottom — easier to scan.
        const sorted = [...this._items].sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1;
            return a.createdAt - b.createdAt;
        });

        for (const item of sorted) {
            const row = document.createElement('div');
            row.className = `todo-item ${item.done ? 'done' : ''}`;

            const check = document.createElement('button');
            check.type = 'button';
            check.className = 'todo-check';
            check.setAttribute('aria-pressed', String(item.done));
            check.setAttribute('aria-label', item.done ? 'Bỏ tick' : 'Đánh dấu xong');
            check.addEventListener('click', () => this._toggleItem(item, check));
            row.appendChild(check);

            const text = document.createElement('div');
            text.className = 'todo-text';
            text.textContent = item.text;
            row.appendChild(text);

            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'todo-del';
            del.title = 'Xoá';
            del.textContent = '×';
            del.addEventListener('click', (e) => {
                e.stopPropagation();
                this._deleteItem(item);
            });
            row.appendChild(del);

            this.list.appendChild(row);
        }
    }

    _refreshCount() {
        if (!this.countEl) return;
        const pending = this._items.filter((i) => !i.done).length;
        this.countEl.textContent = pending > 0 ? String(pending) : '';
        this.toggle?.classList.toggle('has-pending', pending > 0);
    }

    _pickCompletionLine() {
        return COMPLETION_LINES[(Math.random() * COMPLETION_LINES.length) | 0];
    }
}
