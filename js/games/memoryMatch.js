// Memory Match — flip cards to find pairs. Uses PERSONAL.photos as card faces
// when available; falls back to a small symbol set if no photos present.
// Win: all matched → confetti + best-time overlay. Best time saved per
// pair-count in localStorage.

const STORAGE_KEY = 'memory_match_best';
const FALLBACK_SYMBOLS = ['♥', '✿', '✦', '☾', '☀', '☘', '✈', '🎀'];

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

async function loadImage(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload  = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

export class MemoryMatch {
    constructor({ stage, stats, photos = [], gameAudio = null }) {
        this.stage     = stage;
        this.stats     = stats;
        this.photos    = photos.slice();
        this.gameAudio = gameAudio;

        this._matchedPairs = 0;
        this._flipped      = [];
        this._moves        = 0;
        this._startTime    = 0;
        this._cards        = [];
    }

    async start() {
        this.root = document.createElement('div');
        this.root.className = 'mm-root';
        this.stage.appendChild(this.root);

        this.overlay = document.createElement('div');
        this.overlay.className = 'game-overlay';
        this.stage.appendChild(this.overlay);

        // Decide pair count: 6 if at least 6 photos, else 4 if at least 4,
        // else 6 with symbol fallback.
        const usePhotos = this.photos.length >= 4;
        let pairCount;
        if (usePhotos) {
            pairCount = Math.min(8, Math.max(4, this.photos.length));
        } else {
            pairCount = 6;
        }

        const faces = await this._loadFaces(usePhotos, pairCount);
        this._buildBoard(faces);

        this.bestKey = `${STORAGE_KEY}_${pairCount}`;
        this.best    = Number(localStorage.getItem(this.bestKey) || 0);

        this.stats.innerHTML = `
            <div><span class="stat-key">Cặp:</span><span class="stat-val" data-k="pairs">0/${pairCount}</span></div>
            <div><span class="stat-key">Lượt:</span><span class="stat-val" data-k="moves">0</span></div>
            <div><span class="stat-key">Thời gian:</span><span class="stat-val" data-k="time">0:00</span></div>
            <div><span class="stat-key">Best:</span><span class="stat-val" data-k="best">${this._fmtTime(this.best)}</span></div>
        `;
        this._pairsEl  = this.stats.querySelector('[data-k="pairs"]');
        this._movesEl  = this.stats.querySelector('[data-k="moves"]');
        this._timeEl   = this.stats.querySelector('[data-k="time"]');
        this._bestEl   = this.stats.querySelector('[data-k="best"]');

        this._pairCount = pairCount;
        this._startTime = performance.now();
        this._timeInterval = setInterval(() => this._tickTime(), 250);
    }

    stop() {
        if (this._timeInterval) clearInterval(this._timeInterval);
        this.root?.remove();
        this.overlay?.remove();
        this.stats.innerHTML = '';
    }

    async _loadFaces(usePhotos, pairCount) {
        if (!usePhotos) {
            return FALLBACK_SYMBOLS.slice(0, pairCount).map((g) => ({ kind: 'glyph', value: g }));
        }
        const paths = this.photos.slice(0, pairCount);
        const imgs  = await Promise.all(paths.map((p) => loadImage(p)));
        const faces = [];
        for (let i = 0; i < pairCount; i++) {
            if (imgs[i]) faces.push({ kind: 'image', value: imgs[i], id: i });
            else         faces.push({ kind: 'glyph', value: FALLBACK_SYMBOLS[i % FALLBACK_SYMBOLS.length], id: i });
        }
        return faces;
    }

    _buildBoard(faces) {
        const deck = shuffle([...faces, ...faces]);     // pair up
        const total = deck.length;

        // Pick a grid that's near-square: 4×N or 3×N.
        const cols = total <= 12 ? 4 : 4;
        const rows = Math.ceil(total / cols);
        this.root.style.setProperty('--mm-cols', cols);
        this.root.style.setProperty('--mm-rows', rows);

        this._cards = [];
        deck.forEach((face, idx) => {
            const card = document.createElement('button');
            card.className = 'mm-card';
            card.type = 'button';
            card.dataset.id = face.id ?? face.value;
            card.dataset.idx = idx;

            const inner = document.createElement('div');
            inner.className = 'mm-inner';

            const back = document.createElement('div');
            back.className = 'mm-face mm-back';
            back.textContent = '♥';

            const front = document.createElement('div');
            front.className = 'mm-face mm-front';
            if (face.kind === 'image') {
                const img = document.createElement('img');
                img.src = face.value.src;
                img.alt = '';
                front.appendChild(img);
            } else {
                front.textContent = face.value;
                front.classList.add('mm-glyph');
            }

            inner.appendChild(back);
            inner.appendChild(front);
            card.appendChild(inner);

            card.addEventListener('click', () => this._flip(card));
            this.root.appendChild(card);
            this._cards.push(card);
        });
    }

    _flip(card) {
        if (card.classList.contains('flipped') || card.classList.contains('matched')) return;
        if (this._flipped.length >= 2) return;

        card.classList.add('flipped');
        this._flipped.push(card);
        this.gameAudio?.sfxFlip?.();

        if (this._flipped.length === 2) {
            this._moves += 1;
            this._movesEl.textContent = String(this._moves);

            const [a, b] = this._flipped;
            if (a.dataset.id === b.dataset.id) {
                a.classList.add('matched');
                b.classList.add('matched');
                this._flipped = [];
                this._matchedPairs += 1;
                this._pairsEl.textContent = `${this._matchedPairs}/${this._pairCount}`;
                this.gameAudio?.sfxMatch?.();
                if (this._matchedPairs === this._pairCount) {
                    this.gameAudio?.sfxWin?.();
                    this._win();
                }
            } else {
                this.gameAudio?.sfxMiss?.();
                setTimeout(() => {
                    a.classList.remove('flipped');
                    b.classList.remove('flipped');
                    this._flipped = [];
                }, 800);
            }
        }
    }

    _tickTime() {
        const elapsed = (performance.now() - this._startTime) / 1000;
        this._timeEl.textContent = this._fmtTime(elapsed);
    }

    _fmtTime(sec) {
        if (!sec) return '—';
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    _win() {
        clearInterval(this._timeInterval);
        const elapsed = (performance.now() - this._startTime) / 1000;
        const isBest = !this.best || elapsed < this.best;
        if (isBest) {
            this.best = elapsed;
            localStorage.setItem(this.bestKey, String(elapsed));
            this._bestEl.textContent = this._fmtTime(elapsed);
        }
        this.overlay.innerHTML = `
            <div class="game-overlay-card">
                <div class="game-overlay-title">${isBest ? 'Best time mới! 🎉' : 'Em ghép xong rồi!'}</div>
                <div class="game-overlay-body">
                    Thời gian: <strong>${this._fmtTime(elapsed)}</strong><br/>
                    Số lượt: <strong>${this._moves}</strong>
                </div>
                <button class="game-overlay-btn" data-act="retry">Chơi lại</button>
            </div>
        `;
        this.overlay.classList.add('show');
        this.overlay.querySelector('[data-act="retry"]').addEventListener('click', () => this._restart());
    }

    async _restart() {
        this.overlay.classList.remove('show');
        this.overlay.innerHTML = '';
        this.root.innerHTML = '';
        this._matchedPairs = 0;
        this._flipped      = [];
        this._moves        = 0;
        const usePhotos = this.photos.length >= 4;
        const faces = await this._loadFaces(usePhotos, this._pairCount);
        this._buildBoard(faces);
        this._pairsEl.textContent = `0/${this._pairCount}`;
        this._movesEl.textContent = '0';
        this._startTime = performance.now();
        this._timeInterval = setInterval(() => this._tickTime(), 250);
    }
}
