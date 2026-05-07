// Advent calendar — 27 boxes leading up to Như's birthday on 27.5.
// Past + today's boxes unlock; future boxes show a 🔒 with "X ngày nữa".
// Today's box pulses softly to draw attention. Click an unlocked box → reveal
// modal with that day's note.

const BIRTHDAY_MONTH = 5;       // May
const BIRTHDAY_DAY   = 27;
const TARGET_YEAR    = 2026;    // calendar year for the layout

const VIETNAMESE_WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function startOfDay(d) {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    return c;
}

// Day of May 1..27 if today is in May 2026 and ≤27, else null.
function todayMayDay(now = new Date()) {
    if (now.getFullYear() !== TARGET_YEAR) return null;
    if (now.getMonth() + 1 !== BIRTHDAY_MONTH) return null;
    if (now.getDate() > BIRTHDAY_DAY) return null;
    return now.getDate();
}

export class AdventCalendar {
    /**
     * @param {object} opts
     * @param {string[]} opts.entries   - 27 strings (one per day 1..27)
     * @param {HTMLElement} opts.toggle - button that opens the calendar
     * @param {HTMLElement} opts.overlay   - calendar grid overlay
     * @param {HTMLElement} opts.grid      - container for cells
     * @param {HTMLElement} opts.closeBtn  - calendar close button
     * @param {HTMLElement} opts.reveal     - reveal modal
     * @param {HTMLElement} opts.revealDay  - day-number element inside reveal
     * @param {HTMLElement} opts.revealText - text element inside reveal
     * @param {HTMLElement} opts.revealCloseBtn
     */
    constructor(opts) {
        this.entries = (opts.entries ?? []).slice(0, BIRTHDAY_DAY);
        this.toggle  = opts.toggle;
        this.overlay = opts.overlay;
        this.grid    = opts.grid;
        this.closeBtn    = opts.closeBtn;
        this.reveal      = opts.reveal;
        this.revealDay   = opts.revealDay;
        this.revealText  = opts.revealText;
        this.revealCloseBtn = opts.revealCloseBtn;

        this._buildGrid();
        this._wireEvents();
        this._refreshTodayPulse();
        // Tick every minute so the calendar respects "today" if she leaves the
        // page open across midnight.
        setInterval(() => {
            this._refreshTodayPulse();
        }, 60_000);
    }

    open()  { this.overlay.classList.add('open'); }
    close() { this.overlay.classList.remove('open'); }
    toggleOpen() { this.overlay.classList.toggle('open'); }

    _wireEvents() {
        this.toggle?.addEventListener('click', () => this.toggleOpen());
        this.closeBtn?.addEventListener('click', () => this.close());
        // Click outside the inner card → close
        this.overlay?.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
        this.revealCloseBtn?.addEventListener('click', () => this._closeReveal());
        this.reveal?.addEventListener('click', (e) => {
            if (e.target === this.reveal) this._closeReveal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (this.reveal?.classList.contains('open')) this._closeReveal();
            else if (this.overlay?.classList.contains('open')) this.close();
        });
    }

    _buildGrid() {
        this.grid.innerHTML = '';

        // Weekday header row (Vietnamese)
        for (const w of VIETNAMESE_WEEKDAYS) {
            const h = document.createElement('div');
            h.className = 'advent-weekday';
            h.textContent = w;
            this.grid.appendChild(h);
        }

        // Calendar cells with weekday alignment
        const may1 = new Date(TARGET_YEAR, BIRTHDAY_MONTH - 1, 1);
        const startWeekday = may1.getDay();    // 0 = Sunday
        for (let i = 0; i < startWeekday; i++) {
            const blank = document.createElement('div');
            blank.className = 'advent-cell empty';
            this.grid.appendChild(blank);
        }

        for (let d = 1; d <= BIRTHDAY_DAY; d++) {
            const cell = document.createElement('button');
            cell.className = 'advent-cell';
            cell.type = 'button';
            cell.dataset.day = String(d);

            const dayLabel = document.createElement('span');
            dayLabel.className = 'advent-cell-day';
            dayLabel.textContent = d;
            cell.appendChild(dayLabel);

            const stateIcon = document.createElement('span');
            stateIcon.className = 'advent-cell-icon';
            cell.appendChild(stateIcon);

            cell.addEventListener('click', () => this._handleClick(d));
            this.grid.appendChild(cell);
        }

        this._refreshLockState();
    }

    _refreshLockState() {
        const today = todayMayDay();
        // If we're after the target window, unlock every day so she can revisit.
        const allUnlocked = today === null && (new Date()) > new Date(TARGET_YEAR, BIRTHDAY_MONTH - 1, BIRTHDAY_DAY);

        const cells = this.grid.querySelectorAll('.advent-cell:not(.empty)');
        cells.forEach((cell) => {
            const d = Number(cell.dataset.day);
            const icon = cell.querySelector('.advent-cell-icon');
            cell.classList.remove('locked', 'today', 'past', 'birthday');
            if (allUnlocked || (today !== null && d <= today)) {
                cell.classList.add(d === today ? 'today' : 'past');
                if (d === BIRTHDAY_DAY && (allUnlocked || d === today || d < today)) {
                    cell.classList.add('birthday');
                }
                icon.textContent = d === BIRTHDAY_DAY ? '🎂' : '✦';
            } else {
                cell.classList.add('locked');
                icon.textContent = '🔒';
            }
        });
    }

    _refreshTodayPulse() {
        this._refreshLockState();

        // Highlight the toggle button if today's box exists and hasn't been
        // opened yet this session.
        if (!this.toggle) return;
        const today = todayMayDay();
        const opened = this._openedToday;
        this.toggle.classList.toggle('has-today', today !== null && !opened);
    }

    _handleClick(day) {
        const cell = this.grid.querySelector(`.advent-cell[data-day="${day}"]`);
        if (!cell || cell.classList.contains('locked')) {
            this._showLockedHint(day);
            return;
        }
        const today = todayMayDay();
        if (day === today) this._openedToday = true;
        this._refreshTodayPulse();
        this._openReveal(day);
    }

    _showLockedHint(day) {
        const today = todayMayDay() ?? 0;
        const days = day - today;
        this._openReveal(day, {
            locked: true,
            text: days > 0
                ? `🔒 Còn ${days} ngày nữa hộp này mới mở ra · cố lên em ơi.`
                : '🔒 Hộp này chưa đến lượt mở.',
        });
    }

    _openReveal(day, override) {
        const text = override?.text ?? this.entries[day - 1] ?? `Ngày ${day}.5`;
        this.revealDay.textContent  = `${day}.5`;
        this.revealText.textContent = text;
        this.reveal.classList.toggle('locked', !!override?.locked);
        this.reveal.classList.add('open');
    }

    _closeReveal() {
        this.reveal?.classList.remove('open');
    }
}
