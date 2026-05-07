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
    "photos/01.jpg",
    "photos/02.jpg",
    "photos/03.jpg",
    "photos/04.jpg",
    "photos/05.jpg",
    "photos/06.jpg",
  ],

  // ── Birthday poem (typed out one line per unique gesture) ───────────────
  // Each unique gesture she completes unlocks the next line of the poem,
  // typed letter-by-letter into the poem card. After all 5 lines are typed,
  // the card glows softly and a small confetti burst celebrates.
  //
  // Order of `lines` is fixed — the line that types is always the next
  // un-typed one, regardless of which gesture she discovered. So write the
  // 5 lines as a flowing poem, not 5 isolated thoughts.
  //
  // EDIT FREELY — these are placeholders. Make them yours.
  poem: {
    header: "Gửi Như · 27.5",
    lines: [
      "Em ơi, hôm nay là ngày 27.5,",
      "Một ngày anh đã đợi · một mùa của riêng em.",
      "Anh gửi em cả thế giới — hoa, nắng, và sao trời,",
      "Tất cả những gì đẹp nhất, anh muốn em là người nhận.",
      "Như ơi · chúc mừng sinh nhật · anh thương em rất nhiều.",
    ],
  },
};
