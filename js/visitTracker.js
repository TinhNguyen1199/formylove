// Visit tracker — persists how many times Như has opened this gift in
// localStorage and crafts a tiered welcome message that "remembers" her.
// All errors fail soft (incognito mode, storage full, etc.) so the experience
// always works even if persistence is unavailable.

const STORAGE_KEY = 'birthday_visits_for_nhu';

function safeRead() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (_err) {
        return null;
    }
}

function safeWrite(payload) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (_err) { /* incognito / quota — ignore */ }
}

// YYYY-MM-DD key used for daily streak comparisons.
function ymd(d) {
    const y  = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
}

function computeStreak(stored, today) {
    const todayKey = ymd(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = ymd(yesterday);

    const lastDay  = stored?.lastVisitDay;
    const lastSeen = stored?.streak ?? 0;

    if (!lastDay)                    return 1;             // first visit
    if (lastDay === todayKey)        return lastSeen || 1; // same day → no change
    if (lastDay === yesterdayKey)    return lastSeen + 1;  // consecutive
    return 1;                                              // streak broke
}

// Increment & persist. Returns the visit info needed by the UI:
//   count          — this visit's number (1-based)
//   lastVisit      — timestamp of the PREVIOUS visit (null on first)
//   firstVisit     — timestamp of visit #1
//   isFirstVisit
//   streak         — consecutive-day streak that includes this visit
//   longestStreak  — best streak achieved so far
//   streakIncreased — true if this visit grew the streak
export function recordVisit() {
    const stored = safeRead() ?? {
        count: 0, firstVisit: null, lastVisit: null,
        streak: 0, longestStreak: 0, lastVisitDay: null,
    };
    const now = new Date();
    const ts  = now.getTime();

    const newStreak = computeStreak(stored, now);
    const streakIncreased = newStreak > (stored.streak ?? 0);

    const result = {
        count:           stored.count + 1,
        firstVisit:      stored.firstVisit ?? ts,
        lastVisit:       stored.lastVisit,           // previous visit, or null
        isFirstVisit:    stored.count === 0,
        streak:          newStreak,
        longestStreak:   Math.max(stored.longestStreak ?? 0, newStreak),
        streakIncreased,
    };

    safeWrite({
        count:         result.count,
        firstVisit:    result.firstVisit,
        lastVisit:     ts,                           // becomes "last" for next time
        streak:        result.streak,
        longestStreak: result.longestStreak,
        lastVisitDay:  ymd(now),
    });

    return result;
}

// Tier badges keyed off the consecutive-day streak.
//   <3   💚  Mới bắt đầu
//   3+   🌱  Hạt giống
//   7+   🌸  Cánh hoa nở
//   14+  🌳  Cây lớn
//   30+  🌟  Trung thành
export function streakBadge(streak) {
    if (streak >= 30) return { emoji: '🌟', name: 'Trung thành' };
    if (streak >= 14) return { emoji: '🌳', name: 'Cây lớn' };
    if (streak >= 7)  return { emoji: '🌸', name: 'Cánh hoa nở' };
    if (streak >= 3)  return { emoji: '🌱', name: 'Hạt giống' };
    return                   { emoji: '💚', name: 'Mới bắt đầu' };
}

// Tiered, sentimental welcome copy. Visit number drives the tone — first
// visit is an introduction, late visits playfully tease how often she comes.
export function welcomeMessage(visit) {
    const last = formatLastVisit(visit.lastVisit);

    if (visit.isFirstVisit) {
        return {
            icon:     '🎁',
            title:    'Chào em',
            body:     'Anh dành món quà này riêng cho em · 27.5',
            footnote: '',
        };
    }

    if (visit.count === 2) {
        return {
            icon:     '🌸',
            title:    'Em quay lại rồi',
            body:     'Anh đợi em đấy · có chút điều mới em sẽ thấy',
            footnote: last,
        };
    }

    if (visit.count <= 5) {
        return {
            icon:     '✨',
            title:    `Lần thứ ${visit.count}`,
            body:     'Mỗi lần em ghé là một niềm vui nhỏ của anh',
            footnote: last,
        };
    }

    if (visit.count <= 10) {
        return {
            icon:     '💕',
            title:    `Lần thứ ${visit.count}`,
            body:     'Em yêu trang này hơn cả anh à? 😄',
            footnote: last,
        };
    }

    if (visit.count <= 27) {
        return {
            icon:     '🎀',
            title:    `${visit.count} lần em ghé`,
            body:     'Anh thấy em ghé hoài · em làm anh hạnh phúc lắm',
            footnote: last,
        };
    }

    // Devotee tier — 28 lần trở lên (lưu ý 27 = số ngày sinh nhật).
    return {
        icon:     '👑',
        title:    `${visit.count} lần`,
        body:     'Em là người duy nhất xem trang này nhiều như vậy · anh yêu em',
        footnote: last,
    };
}

// Relative time for the previous visit. Vietnamese phrasings.
//   < 1 phút        → "Em vừa rời đi · anh chưa kịp nhớ em"
//   < 60 phút       → "Em mới ghé X phút trước"
//   < 24 giờ        → "Lần trước em ghé lúc HH:mm"
//   = 1 ngày        → "Lần trước em ghé hôm qua, HH:mm"
//   < 7 ngày        → "Lần trước em ghé X ngày trước, HH:mm"
//   ≥ 7 ngày        → "Lần trước em ghé DD/MM lúc HH:mm"
export function formatLastVisit(timestamp) {
    if (!timestamp) return '';
    const last = new Date(timestamp);
    const now  = new Date();
    const diffMs  = now - last;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr  = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    const pad     = (n) => String(n).padStart(2, '0');
    const timeStr = `${pad(last.getHours())}:${pad(last.getMinutes())}`;

    if (diffMin < 1)   return 'Em vừa rời đi · anh chưa kịp nhớ em';
    if (diffMin < 60)  return `Em mới ghé ${diffMin} phút trước`;
    if (diffHr < 24)   return `Lần trước em ghé lúc ${timeStr}`;
    if (diffDay === 1) return `Lần trước em ghé hôm qua, ${timeStr}`;
    if (diffDay < 7)   return `Lần trước em ghé ${diffDay} ngày trước, ${timeStr}`;

    const dateStr = `${last.getDate()}/${last.getMonth() + 1}`;
    return `Lần trước em ghé ${dateStr} lúc ${timeStr}`;
}
