// Time-of-day awareness — drives a slow tonal shift in the page background
// so the experience feels like it lives with her through the day, plus a
// short greeting that flows into the countdown card.
//
// Tones are subtle nudges only — bg-1 / bg-2 vary within ±0.05 luminance from
// the brand defaults so the 3D scene's bloom + dark backdrop assumptions keep
// holding (no neon).

const SLOTS = [
    { name: 'dawn',      from: 5,  to: 9,  bg1: '#0e0814', bg2: '#2c1828' },   // sunrise rose-violet
    { name: 'morning',   from: 9,  to: 12, bg1: '#080d18', bg2: '#162a3a' },   // cool blue active
    { name: 'noon',      from: 12, to: 14, bg1: '#100a14', bg2: '#3a2820' },   // warm golden
    { name: 'afternoon', from: 14, to: 17, bg1: '#0c0a14', bg2: '#322238' },   // soft amber-purple
    { name: 'evening',   from: 17, to: 20, bg1: '#160814', bg2: '#3a1828' },   // hoàng hôn
    { name: 'night',     from: 20, to: 23, bg1: '#0a081a', bg2: '#1a1a36' },   // deep blue evening
    { name: 'late',      from: 23, to: 5,  bg1: '#06061a', bg2: '#10102e' },   // midnight
];

export function currentSlot(now = new Date()) {
    const h = now.getHours();
    return SLOTS.find((s) =>
        s.from < s.to ? (h >= s.from && h < s.to) : (h >= s.from || h < s.to),
    ) ?? SLOTS[1];
}

// Apply the current slot's tonal shift to the page background.
// We update CSS custom properties so any element using --bg-1 / --bg-2 inherits.
export function applyTone(slot) {
    const root = document.documentElement;
    root.style.setProperty('--bg-1', slot.bg1);
    root.style.setProperty('--bg-2', slot.bg2);
    document.body.dataset.timeSlot = slot.name;
}

// Convenience: run on load + every minute to follow the day.
export function watchTimeOfDay(onChange) {
    let prev = null;
    const tick = () => {
        const slot = currentSlot();
        if (!prev || prev.name !== slot.name) {
            applyTone(slot);
            onChange?.(slot);
        }
        prev = slot;
    };
    tick();
    setInterval(tick, 60_000);
}
