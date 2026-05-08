// Time-capsule UI controller.
//
// Three modals work together:
//   #capsule-overlay  — list of all capsules, "+ Viết thư mới" button
//   #capsule-write    — compose form (title + textarea + save)
//   #capsule-reveal   — opens an unlocked capsule (decrypted text shown)
//
// Decrypt prompts for the password (which is the same start-gate password by
// default — DDMMYYYY of em's birthday). If decryption fails we surface a
// friendly Vietnamese error.

import {
    listCapsules,
    createCapsule,
    decryptCapsule,
    deleteCapsule,
    isUnlocked,
    lockCountdownLabel,
    formatDate,
    computeUnlockAt,
} from './timeCapsule.js';

export class CapsuleManager {
    constructor({
        toggle, overlay, list, newBtn, closeBtn, countEl,
        write, writeClose, writeTitle, writeBody, writeSave, writeError,
        reveal, revealClose, revealTitle, revealMeta, revealBody,
        defaultPassword,
    }) {
        this.toggle      = toggle;
        this.overlay     = overlay;
        this.list        = list;
        this.newBtn      = newBtn;
        this.closeBtn    = closeBtn;
        this.countEl     = countEl;

        this.write       = write;
        this.writeClose  = writeClose;
        this.writeTitle  = writeTitle;
        this.writeBody   = writeBody;
        this.writeSave   = writeSave;
        this.writeError  = writeError;

        this.reveal      = reveal;
        this.revealClose = revealClose;
        this.revealTitle = revealTitle;
        this.revealMeta  = revealMeta;
        this.revealBody  = revealBody;

        this.defaultPassword = defaultPassword || '';

        this._wire();
        this._refreshCount();

        // Tick the countdown labels every minute so locked capsules look alive.
        setInterval(() => {
            if (this.overlay.classList.contains('open')) this._renderList();
        }, 60_000);
    }

    open() {
        this._renderList();
        this.overlay.classList.add('open');
    }
    close() { this.overlay.classList.remove('open'); }
    _toggleOpen() {
        if (this.overlay.classList.contains('open')) this.close();
        else this.open();
    }

    _wire() {
        this.toggle?.addEventListener('click',   () => this._toggleOpen());
        this.closeBtn?.addEventListener('click', () => this.close());
        this.overlay?.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });

        this.newBtn?.addEventListener('click', () => this._openWrite());
        this.writeClose?.addEventListener('click', () => this._closeWrite());
        this.write?.addEventListener('click', (e) => {
            if (e.target === this.write) this._closeWrite();
        });
        this.writeSave?.addEventListener('click', () => this._handleSave());

        this.revealClose?.addEventListener('click', () => this._closeReveal());
        this.reveal?.addEventListener('click', (e) => {
            if (e.target === this.reveal) this._closeReveal();
        });

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (this.reveal?.classList.contains('open')) this._closeReveal();
            else if (this.write?.classList.contains('open')) this._closeWrite();
            else if (this.overlay?.classList.contains('open')) this.close();
        });
    }

    // ── List ───────────────────────────────────────────────────────────────
    _renderList() {
        if (!this.list) return;
        const capsules = listCapsules();
        this.list.innerHTML = '';

        if (capsules.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'capsule-empty';
            empty.textContent = 'Em chưa khoá lá thư nào · viết một thư cho năm sau nhé.';
            this.list.appendChild(empty);
            return;
        }

        for (const cap of capsules) {
            const unlocked = isUnlocked(cap);
            const card = document.createElement('div');
            card.className = `capsule-card ${unlocked ? 'unlocked' : 'locked'}`;

            const info = document.createElement('div');
            info.className = 'cc-info';

            const title = document.createElement('div');
            title.className = 'cc-title';
            title.textContent = cap.title || `Thư viết ${formatDate(cap.createdAt)}`;
            info.appendChild(title);

            const meta = document.createElement('div');
            meta.className = 'cc-meta';
            meta.textContent = unlocked
                ? `Mở được · viết ${formatDate(cap.createdAt)} · khoá đến ${formatDate(cap.unlockAt)}`
                : `${lockCountdownLabel(cap)} · mở vào ${formatDate(cap.unlockAt)}`;
            info.appendChild(meta);

            card.appendChild(info);

            const state = document.createElement('div');
            state.className = 'cc-state';
            state.textContent = unlocked ? '🔓' : '🔒';
            card.appendChild(state);

            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'cc-del';
            del.title = 'Xoá';
            del.textContent = '×';
            del.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!confirm('Xoá lá thư này? Sau khi xoá sẽ không lấy lại được.')) return;
                deleteCapsule(cap.id);
                this._renderList();
                this._refreshCount();
            });
            card.appendChild(del);

            if (unlocked) {
                card.addEventListener('click', () => this._openReveal(cap));
            }

            this.list.appendChild(card);
        }
    }

    // ── Compose ────────────────────────────────────────────────────────────
    _openWrite() {
        if (!this.write) return;
        this.writeTitle.value = '';
        this.writeBody.value  = '';
        this.writeError.textContent = '';
        this.write.classList.add('open');
        setTimeout(() => this.writeBody?.focus(), 250);
    }
    _closeWrite() { this.write?.classList.remove('open'); }

    async _handleSave() {
        const title = this.writeTitle?.value || '';
        const body  = this.writeBody?.value  || '';
        if (!body.trim()) {
            this.writeError.textContent = 'Em viết gì đó để khoá nhé.';
            return;
        }
        this.writeSave.disabled = true;
        try {
            await createCapsule({
                title,
                body,
                password: this.defaultPassword,
                unlockAt: computeUnlockAt(Date.now()),
            });
            this._closeWrite();
            this._renderList();
            this._refreshCount();
        } catch (err) {
            console.error(err);
            this.writeError.textContent = err.message || 'Có lỗi khi khoá thư.';
        } finally {
            this.writeSave.disabled = false;
        }
    }

    // ── Reveal ─────────────────────────────────────────────────────────────
    async _openReveal(capsule) {
        let password = this.defaultPassword;
        // If the saved default doesn't decrypt (capsule was made with another
        // password), prompt em.
        let plaintext;
        try {
            plaintext = await decryptCapsule(capsule, password);
        } catch (_e) {
            password = prompt('Mật khẩu để mở thư này?') ?? '';
            if (!password) return;
            try {
                plaintext = await decryptCapsule(capsule, password);
            } catch (_err) {
                alert('Sai mật khẩu rồi em ạ.');
                return;
            }
        }

        this.revealTitle.textContent = capsule.title || 'Thư em viết hôm trước';
        this.revealMeta.textContent  = `Em viết ngày ${formatDate(capsule.createdAt)} · mở ngày ${formatDate(capsule.unlockAt)}`;
        this.revealBody.textContent  = plaintext;
        this.reveal.classList.add('open');
    }
    _closeReveal() { this.reveal?.classList.remove('open'); }

    // ── Count badge ────────────────────────────────────────────────────────
    _refreshCount() {
        if (!this.countEl) return;
        const capsules = listCapsules();
        const unlockedNow = capsules.filter((c) => isUnlocked(c)).length;
        // Show badge only when there's an unlocked-and-unread capsule.
        this.countEl.textContent = unlockedNow > 0 ? String(unlockedNow) : '';
        this.toggle?.classList.toggle('has-unlocked', unlockedNow > 0);
    }
}
