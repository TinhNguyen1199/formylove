// Daily message — one fixed message per day, deterministic by day-of-year.
// Em mở trang nhiều lần trong cùng một ngày sẽ thấy cùng câu, vẫn quay lại
// vào ngày kế tiếp để thấy câu mới. Chu kỳ lặp = messages.length ngày.
//
// Card hiện ra sau welcome card (~5.5s sau khi click Begin), tự fade sau ~9s.
// Nếu mảng rỗng thì module no-op để main.js không phải kiểm tra.

function dayOfYear(date = new Date()) {
    // Số ngày từ đầu năm (1..366). Dùng UTC để tránh lệch khi đổi mùa giờ.
    const start = Date.UTC(date.getFullYear(), 0, 0);
    const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    return Math.floor((today - start) / 86_400_000);
}

export function pickDailyMessage(messages, date = new Date()) {
    if (!messages?.length) return null;
    const idx = dayOfYear(date) % messages.length;
    return { index: idx, text: messages[idx], date };
}

function formatDate(d) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}`;
}

// Build & inject the card DOM the first time we show one. Re-using the same
// element on subsequent shows keeps the page DOM tidy.
let _cardEl = null;
function ensureCard() {
    if (_cardEl) return _cardEl;
    const card = document.createElement('div');
    card.id = 'daily-message';
    card.setAttribute('aria-live', 'polite');
    card.innerHTML = `
        <div class="dm-header"></div>
        <div class="dm-body"></div>
        <div class="dm-footer">— gửi em ·</div>
    `;
    document.body.appendChild(card);
    _cardEl = card;
    return card;
}

// Show the card with a poetic header + the picked text. Auto-fades after
// `holdMs` ms; cleared early if `dismissOn` events fire (e.g., gesture lock).
export function showDailyMessage(messages, {
    delayMs = 0,
    holdMs = 9000,
    fadeMs = 800,
} = {}) {
    const picked = pickDailyMessage(messages);
    if (!picked) return null;

    const card  = ensureCard();
    const head  = card.querySelector('.dm-header');
    const body  = card.querySelector('.dm-body');
    const foot  = card.querySelector('.dm-footer');
    head.textContent = `Lời hôm nay · ${formatDate(picked.date)}`;
    body.textContent = picked.text;
    foot.textContent = `— gửi em · ngày thứ ${picked.index + 1} của vòng tuần hoàn`;

    let dismissed = false;
    const showTimer = setTimeout(() => {
        if (dismissed) return;
        card.classList.add('visible');
    }, delayMs);
    const hideTimer = setTimeout(() => {
        card.classList.remove('visible');
    }, delayMs + holdMs);
    const removeTimer = setTimeout(() => {
        // Keep the element around (re-used on next call); just ensure not visible.
        card.classList.remove('visible');
    }, delayMs + holdMs + fadeMs);

    return {
        picked,
        dismiss() {
            if (dismissed) return;
            dismissed = true;
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
            clearTimeout(removeTimer);
            card.classList.remove('visible');
        },
    };
}
