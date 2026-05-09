// Music player — fetches sweet love-song previews from the iTunes Search API.
// Each session opens with a "daily song" (deterministic by today's date), and
// every skip pulls a fresh random track. 30s previews auto-advance, so the
// experience reads as a continuous parade of surprise — never the same shuffle.
//
// No API key, no auth — iTunes Search is fully open with CORS. Recently-played
// trackIds are remembered in localStorage so we don't repeat for ~25 plays.

// Curated keywords — sweet / upbeat / cheerful Vietnamese love songs only.
// Searching "artist + specific happy song title" is more reliable than just
// the artist name, because iTunes' fuzzy match returns that track plus the
// closest recommendations (same vibe). Generic "ballad / acoustic" terms are
// avoided since they pull in slow melancholic tracks.
const KEYWORDS = [
    // Đức Phúc
    'Đức Phúc Hơn Cả Yêu',
    'Đức Phúc Em Đồng Ý',
    'Đức Phúc Anh Yêu Em Nhiều Lắm',
    // MIN
    'MIN Em Mới Là Người Yêu Anh',
    'MIN Yêu Đi Đừng Sợ',
    'MIN Vì Yêu Cứ Đâm Đầu',
    'MIN Có Em Chờ',
    // AMEE
    'AMEE Cuối Tuần',
    'AMEE 2 3 Con Mực',
    'AMEE Anh Nhà Ở Đâu Thế',
    'AMEE Đen Đá Không Đường',
    'AMEE Mượn Rượu Tỏ Tình',
    // Suni Hạ Linh
    'Suni Hạ Linh Cảm Nắng',
    'Suni Hạ Linh Em Bỏ Hút Thuốc Chưa',
    // Bích Phương
    'Bích Phương Bùa Yêu',
    'Bích Phương Đi Đu Đưa Đi',
    'Bích Phương Một Cú Lừa',
    // Phương Ly
    'Phương Ly Mặt Trời Của Em',
    'Phương Ly Anh Là Của Em',
    // JustaTee
    'JustaTee Đã Lỡ Yêu Em Nhiều',
    'JustaTee Cô Gái M52',
    'JustaTee Đã Có Em Lo',
    // Soobin
    'Soobin Đi Để Trở Về',
    'Soobin Heyyy',
    'Soobin BlackJack',
    // Wren Evans
    'Wren Evans Loi Choi',
    'Wren Evans Tigon',
    // GREY D
    'GREY D đưa em về',
    // Trúc Nhân
    'Trúc Nhân Lớp Trưởng',
    'Trúc Nhân Sáng Mắt Chưa',
    'Trúc Nhân Bốn Chữ Lắm',
    // Hoàng Thuỳ Linh
    'Hoàng Thuỳ Linh See Tình',
    'Hoàng Thuỳ Linh Để Mị Nói Cho Mà Nghe',
    'Hoàng Thuỳ Linh Bánh Trôi Nước',
    // Misc upbeat hits
    'Văn Mai Hương Cầu Hôn',
    'Đông Nhi Nắm Lấy Tay Anh',
    'Karik Anh Rất Cute',
    'OnlyC Yêu Là Tha Thu',
    'Lou Hoàng Tình Đầu Quá Chén',
    'Chi Pu Anh Ơi Ở Lại',
    // Broader genre fallbacks — biased toward "happy/upbeat", but iTunes
    // fuzzy match can still surface a slow track here. The sad-keyword filter
    // below catches obvious cases.
    'Vpop happy love song',
    'Vietnamese happy love song',
    'Vpop yêu vui',
    'nhạc trẻ vui yêu',
    'Vpop sweet upbeat',
];

// Soft filter: track titles containing any of these tokens get deprioritised.
// Not a hard reject — if a keyword's pool is entirely "sad" we still play
// something rather than fail. False positives (e.g. a cheerful song that
// happens to mention "nhớ") are accepted as the cost of simplicity.
const SAD_TOKENS = [
    'buồn', 'khóc', 'đau', 'chia tay', 'tan vỡ', 'cô đơn', 'một mình',
    'mất em', 'mất anh', 'tiếc', 'lỡ',
    'sad', 'goodbye', 'broken', 'alone', 'cry', 'lonely',
];

function isSadTitle(track) {
    const t = `${track.trackName || ''} ${track.collectionName || ''}`.toLowerCase();
    return SAD_TOKENS.some((kw) => t.includes(kw));
}

const ITUNES_BASE   = 'https://itunes.apple.com/search';
const RECENT_LS_KEY = 'birthday__music_recent';
const MAX_RECENT    = 25;

export class MusicPlayer {
    constructor() {
        this._buildUI();
        this._buildAudio();
        this._loadRecent();
        this._currentTrack = null;
        this._setState('idle');
        this._loading = false;
        this._wasPlayingBeforePause = false;
    }

    // ── Audio element ────────────────────────────────────────────────────────
    _buildAudio() {
        this._audio = new Audio();
        this._audio.preload = 'auto';
        this._audio.volume = 0.55;
        // crossOrigin lets a future Web Audio analyser tap the buffer for
        // visual reactions without tripping CORS.
        this._audio.crossOrigin = 'anonymous';
        this._audio.addEventListener('ended',   () => this._onTrackEnded());
        this._audio.addEventListener('error',   () => this._onError());
        this._audio.addEventListener('playing', () => this._setState('playing'));
        this._audio.addEventListener('pause',   () => {
            // Browser fires 'pause' on natural end too — don't downgrade state
            // away from 'playing' when the track is actually still going.
            if (!this._audio.ended && this._state === 'playing') {
                this._setState('paused');
            }
        });
    }

    // ── DOM ──────────────────────────────────────────────────────────────────
    _buildUI() {
        this.el = document.createElement('div');
        this.el.id = 'music-player';
        this.el.innerHTML = `
            <div id="music-art-wrap" role="button" aria-label="Bật/tắt nhạc">
                <img id="music-art" alt="" />
                <div id="music-art-icon">♪</div>
            </div>
            <div id="music-info">
                <div id="music-title">Bấm để mở nhạc</div>
                <div id="music-artist">surprise mỗi ngày</div>
            </div>
            <button id="music-skip" type="button" aria-label="Bài kế">↻</button>
        `;
        document.body.appendChild(this.el);

        this.artEl    = this.el.querySelector('#music-art');
        this.titleEl  = this.el.querySelector('#music-title');
        this.artistEl = this.el.querySelector('#music-artist');
        this.skipBtn  = this.el.querySelector('#music-skip');

        this.el.querySelector('#music-art-wrap')
            .addEventListener('click', () => this._onArtClick());
        this.skipBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.skip();
        });
    }

    _onArtClick() {
        if (this._state === 'idle' || this._state === 'error') {
            // First-ever click in this session — that's the user gesture the
            // browser's autoplay policy needs. Open with today's daily song.
            this.loadDaily();
        } else if (this._state === 'playing') {
            this._audio.pause();
        } else if (this._state === 'paused') {
            this._audio.play().catch(() => this._setState('error'));
        }
    }

    // ── Track selection ──────────────────────────────────────────────────────
    async loadDaily() {
        const seed = this._dailySeed();
        const hash = this._hashSeed(seed);
        const idx  = hash % KEYWORDS.length;
        await this._loadFromKeyword(KEYWORDS[idx]);
    }

    async skip() {
        const keyword = KEYWORDS[(Math.random() * KEYWORDS.length) | 0];
        await this._loadFromKeyword(keyword);
    }

    async _loadFromKeyword(keyword) {
        if (this._loading) return;
        this._loading = true;
        this._setState('loading');
        this.titleEl.textContent  = 'Đang tìm bài hay...';
        this.artistEl.textContent = keyword;

        try {
            const url = new URL(ITUNES_BASE);
            url.searchParams.set('term',    keyword);
            url.searchParams.set('entity',  'song');
            url.searchParams.set('country', 'vn');
            url.searchParams.set('limit',   '20');
            url.searchParams.set('media',   'music');

            const res = await fetch(url.toString());
            if (!res.ok) throw new Error('iTunes ' + res.status);
            const data = await res.json();

            const candidates = (data.results || []).filter((r) => !!r.previewUrl);
            if (!candidates.length) throw new Error('No previews for: ' + keyword);

            // Pool priority: happy + fresh > happy (allow recent) > any fresh
            // > any. Always falls through to *something* rather than failing,
            // so the surprise stream never breaks — but biases hard toward
            // upbeat tracks the user has not heard recently.
            const happyFresh = candidates.filter((r) =>
                !this._recent.includes(r.trackId) && !isSadTitle(r));
            const happyAny   = candidates.filter((r) => !isSadTitle(r));
            const anyFresh   = candidates.filter((r) => !this._recent.includes(r.trackId));
            const pool = happyFresh.length ? happyFresh
                       : happyAny.length   ? happyAny
                       : anyFresh.length   ? anyFresh
                       : candidates;
            const track = pool[(Math.random() * pool.length) | 0];

            this._addRecent(track.trackId);
            await this._playTrack(track);
        } catch (err) {
            console.warn('[MusicPlayer]', err);
            this._setState('error');
            this.titleEl.textContent  = 'Không tải được';
            this.artistEl.textContent = 'thử lại';
        } finally {
            this._loading = false;
        }
    }

    async _playTrack(track) {
        this._currentTrack = track;
        // Bump artwork resolution from 100×100 to 300×300 by URL surgery.
        const art = (track.artworkUrl100 || '').replace('100x100bb', '300x300bb');
        this.artEl.src = art;
        this.titleEl.textContent  = track.trackName  || 'Untitled';
        this.artistEl.textContent = track.artistName || '';
        this._audio.src = track.previewUrl;
        try {
            await this._audio.play();
        } catch (err) {
            // Almost always autoplay-policy related. The user has to click art
            // again — set paused state so the click toggles into play.
            console.warn('[MusicPlayer] play() blocked:', err);
            this._setState('paused');
        }
    }

    _onTrackEnded() {
        // Auto-advance to a fresh random pick — keeps the surprise rolling.
        this.skip();
    }

    _onError() {
        this._setState('error');
    }

    // ── State + pausable interface ───────────────────────────────────────────
    _setState(state) {
        this._state = state;
        this.el.classList.remove('idle', 'loading', 'playing', 'paused', 'error');
        this.el.classList.add(state);
    }

    pause() {
        if (this._paused) return;
        this._paused = true;
        if (this._state === 'playing') {
            this._wasPlayingBeforePause = true;
            this._audio.pause();
        }
    }

    resume() {
        if (!this._paused) return;
        this._paused = false;
        if (this._wasPlayingBeforePause) {
            this._wasPlayingBeforePause = false;
            this._audio.play().catch(() => this._setState('paused'));
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    _dailySeed() {
        const d = new Date();
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    }

    // FNV-1a — small, deterministic, unsigned 32-bit.
    _hashSeed(s) {
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    _loadRecent() {
        try {
            this._recent = JSON.parse(localStorage.getItem(RECENT_LS_KEY)) || [];
        } catch {
            this._recent = [];
        }
    }

    _addRecent(trackId) {
        this._recent = [trackId, ...this._recent.filter((id) => id !== trackId)]
            .slice(0, MAX_RECENT);
        try {
            localStorage.setItem(RECENT_LS_KEY, JSON.stringify(this._recent));
        } catch { /* localStorage full or disabled — ignore */ }
    }
}
