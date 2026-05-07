// Personal data for the birthday gift. Edit this file to swap photos, names,
// nicknames, anniversaries — all the bits that make this experience hers.
//
// Add new keys here as new personalised features are added; everything else
// reads from this single object.

export const PERSONAL = {
    // ── Photo gallery (peace gesture) ───────────────────────────────────────
    // Drop 5–7 portrait photos into the photos/ folder and list them here.
    // Polaroids appear when the peace gesture fires.
    //
    // Tips:
    //   • portrait orientation works best (the polaroid frame is taller than wide).
    //   • ~800px–1200px on the long side is plenty — bigger files just slow load.
    //   • paths are relative to index.html (so "photos/01.jpg", not "/photos/01.jpg").
    //
    // If a file is missing, it's silently skipped — no error.
    photos: [
        'photos/01.jpg',
        'photos/02.jpg',
        'photos/03.jpg',
        'photos/04.jpg',
        'photos/05.jpg',
        'photos/06.jpg',
    ],
};
