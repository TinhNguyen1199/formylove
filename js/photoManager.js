// Photo manager — modal UI for uploading + browsing private photos.
//
// Pure DOM module, no Three.js. Reads/writes via photoStore (IndexedDB).
// Emits a custom event 'photos:changed' on document so subscribers (e.g.
// PhotoGallery's loader) can refresh their view.

import { addPhoto, deletePhoto, listAllAsObjectUrls, count } from './photoStore.js';

export class PhotoManager {
    constructor({ toggle, overlay, grid, fileInput, dropzone, closeBtn, countEl }) {
        this.toggle    = toggle;
        this.overlay   = overlay;
        this.grid      = grid;
        this.fileInput = fileInput;
        this.dropzone  = dropzone;
        this.closeBtn  = closeBtn;
        this.countEl   = countEl;
        this._urls     = [];   // blob URLs we created → must revoke on refresh

        this._wire();
        this._refreshCount();
    }

    open() {
        this.overlay.classList.add('open');
        this._refreshGrid();
    }

    close() {
        this.overlay.classList.remove('open');
    }

    _wire() {
        this.toggle?.addEventListener('click',   () => this._toggleOpen());
        this.closeBtn?.addEventListener('click', () => this.close());
        this.overlay?.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.classList.contains('open')) this.close();
        });

        // File picker
        this.dropzone?.addEventListener('click', () => this.fileInput?.click());
        this.fileInput?.addEventListener('change', (e) => {
            this._handleFiles(e.target.files);
            this.fileInput.value = '';   // allow re-uploading the same file
        });

        // Drag & drop
        ['dragenter', 'dragover'].forEach((ev) =>
            this.dropzone?.addEventListener(ev, (e) => {
                e.preventDefault();
                this.dropzone.classList.add('dragging');
            }),
        );
        ['dragleave', 'drop'].forEach((ev) =>
            this.dropzone?.addEventListener(ev, (e) => {
                e.preventDefault();
                this.dropzone.classList.remove('dragging');
            }),
        );
        this.dropzone?.addEventListener('drop', (e) => {
            this._handleFiles(e.dataTransfer?.files);
        });
    }

    _toggleOpen() {
        if (this.overlay.classList.contains('open')) this.close();
        else this.open();
    }

    async _handleFiles(fileList) {
        if (!fileList || !fileList.length) return;
        const files = [...fileList].filter((f) => f.type?.startsWith('image/'));
        if (!files.length) return;

        this.dropzone?.classList.add('busy');
        try {
            for (const f of files) {
                try { await addPhoto(f); }
                catch (err) { console.warn('addPhoto failed', err); }
            }
            await this._refreshGrid();
            this._refreshCount();
            document.dispatchEvent(new CustomEvent('photos:changed'));
        } finally {
            this.dropzone?.classList.remove('busy');
        }
    }

    async _refreshGrid() {
        if (!this.grid) return;

        // Revoke previous batch of blob URLs.
        for (const u of this._urls) URL.revokeObjectURL(u);
        this._urls = [];

        const rows = await listAllAsObjectUrls();
        this.grid.innerHTML = '';

        if (rows.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'pm-empty';
            empty.textContent = 'Chưa có ảnh nào · em thả ảnh hoặc bấm khung trên để thêm.';
            this.grid.appendChild(empty);
            return;
        }

        for (const r of rows) {
            this._urls.push(r.url);

            const card = document.createElement('div');
            card.className = 'pm-card';

            const img = document.createElement('img');
            img.src = r.url;
            img.alt = r.name || 'photo';
            img.loading = 'lazy';
            card.appendChild(img);

            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'pm-card-del';
            del.title = 'Xoá ảnh này';
            del.textContent = '×';
            del.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!confirm('Xoá ảnh này khỏi gallery?')) return;
                await deletePhoto(r.id);
                await this._refreshGrid();
                this._refreshCount();
                document.dispatchEvent(new CustomEvent('photos:changed'));
            });
            card.appendChild(del);

            this.grid.appendChild(card);
        }
    }

    async _refreshCount() {
        if (!this.countEl) return;
        try {
            const n = await count();
            this.countEl.textContent = n ? String(n) : '';
            this.toggle?.classList.toggle('has-photos', n > 0);
        } catch (_e) { /* ignore */ }
    }
}
