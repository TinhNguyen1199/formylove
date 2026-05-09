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

  // ── Advent calendar (1.5 → 27.5) ─────────────────────────────────────────
  // 27 small notes — one for each day of May leading up to her birthday.
  // The day's box unlocks when that calendar date arrives; future boxes are
  // locked with a 🔒 icon. Past boxes stay open so she can re-read.
  //
  // Today's box gently pulses on the calendar so she knows there's something
  // new to open. EDIT FREELY — these are heartfelt placeholders.
  adventCalendar: [
    "1.5 — Tháng 5 rồi đó · đợi thêm 26 ngày nữa thôi nha e.",
    "2.5 — Sáng nay anh nghĩ về em · ngay khi vừa mở mắt.",
    "3.5 — Anh đang đếm từng ngày · từng giờ · từng phút.",
    "4.5 — Anh hỏi cả thế giới: 'biết Như xinh không?' · ai cũng nói có.",
    "5.5 — Một ngày không có em là một ngày anh thấy thiếu một nửa.",
    "6.5 — Em là đứa duy nhất anh muốn nhắn 'chào buổi sáng' mỗi ngày.",
    "7.5 — Tuần đầu tiên qua · còn 20 ngày nữa thôi em ơi.",
    "8.5 — Anh muốn ăn cơm cùng em · xong rồi anh rửa chén nhé.",
    "9.5 — Anh thấy 1 con mèo dỗi giống em · anh cười cả buổi.",
    "10.5 — Còn 17 ngày · anh đang chuẩn bị surprise cho em.",
    "11.5 — Anh nghe 1 bài hát hôm nay · nó kể về em.",
    "12.5 — Anh muốn đi du lịch cùng em · em chọn nơi đi nhé.",
    "13.5 — Em là lý do anh muốn dậy sớm · và muốn ngủ muộn.",
    "14.5 — Còn 13 ngày · anh hồi hộp giùm em rồi này.",
    "15.5 — Một nửa tháng đã qua · một nửa anh chưa được thấy em.",
    "16.5 — Anh thấy hoa anh đào nở · anh nhớ tay em ngay.",
    "17.5 — Còn 10 ngày · anh đang đếm bằng mười đầu ngón tay.",
    "18.5 — Anh muốn làm em cười nhiều hơn mỗi ngày một chút.",
    "19.5 — Em là lý do anh tin có ngày mai sẽ đẹp hơn.",
    "20.5 — Còn 7 ngày · cả tuần nữa em sẽ là cô gái sinh nhật.",
    "21.5 — Anh đang nghĩ phải gói quà em thế nào cho đẹp...",
    "22.5 — Anh đã chuẩn bị xong rồi · giờ chỉ chờ em mở.",
    "23.5 — Còn 4 ngày · anh hồi hộp như thi đại học.",
    "24.5 — 3 ngày nữa · anh muốn ôm em chặt như sắp mất em.",
    "25.5 — 2 ngày · anh đang viết những dòng cuối cho thư em.",
    "26.5 — Mai là ngày của em · ngủ ngon một đêm cuối nhé.",
    "27.5 — 🎂 Chúc mừng sinh nhật em yêu! Hôm nay em là người hạnh phúc nhất · vì có anh yêu em nhiều như vậy.",
  ],

  // ── Daily messages (one per day, rotates by day-of-year) ────────────────
  // Một câu mỗi ngày · trang sẽ hiện cùng một câu suốt cả ngày (deterministic
  // theo day-of-year), nên em mở 5 lần trong ngày vẫn thấy cùng nội dung.
  // Mảng càng dài thì chu kỳ lặp càng xa — 30 câu = ~1 tháng mới lặp lại.
  // EDIT FREELY — viết theo giọng riêng của anh-em.
  dailyMessages: [
    "Hôm nay là một ngày anh chọn em thêm một lần nữa.",
    "Em đẹp lắm · ngay cả khi em chưa kịp soi gương.",
    "Có em ở thế giới này · anh thấy đời nhẹ tênh.",
    "Anh thương em không cần lý do · chỉ cần là em thôi.",
    "Hôm nay em làm tốt rồi · cứ thong thả nhé.",
    "Cứ là chính em · phần còn lại để anh lo.",
    "Em là điều dịu dàng nhất ngày anh.",
    "Mỗi sáng mở mắt · điều đầu tiên anh nghĩ là em.",
    "Anh đợi em · không vội đâu · cứ từ từ.",
    "Trên đời nhiều người đẹp · nhưng anh chỉ thấy em thôi.",
    "Em không cần phải hoàn hảo · em đã đủ rồi.",
    "Hôm nay anh muốn em được chiều một chút.",
    "Có em thì cái gì cũng thơm cũng đẹp.",
    "Anh thương em từ tóc xuống đến đầu ngón chân.",
    "Em mệt thì dựa vào anh nha · anh đứng vững mà.",
    "Một ngày của em là một ngày anh muốn nâng niu.",
    "Em là điều ổn định nhất trong cuộc đời nhiều biến động này.",
    "Hôm nay nhớ uống đủ nước · ăn đủ bữa · cười đủ kiểu nhé.",
    "Anh không tin định mệnh · đến khi gặp em.",
    "Em là homepage của anh · mở mắt là vào đầu tiên.",
    "Có em rồi · anh không cần ai khác nữa.",
    "Em làm điều bình thường nhất cũng thấy đáng yêu.",
    "Hôm nay nếu thấy mệt · đọc lại câu này nhé: anh đây.",
    "Em là lý do anh muốn cố gắng nhiều hơn mỗi ngày.",
    "Anh muốn nắm tay em đi qua những ngày còn lại của cuộc đời.",
    "Em là thứ ấm nhất giữa thế giới rất lạnh này.",
    "Anh thương em hôm qua · thương hôm nay · thương cả ngày mai.",
    "Em chỉ cần là em · còn anh sẽ là tất cả những gì em cần.",
    "Có em · bão nào cũng thành mưa nhỏ.",
    "Anh lưu em bằng tên thật · vì với anh em là duy nhất.",
    "Em không phải gánh thế giới một mình đâu · anh đỡ một nửa.",
    "Hôm nay anh chọn em · ngày mai cũng vậy thôi.",
    "Em xinh nhất khi em là chính mình · không cần diễn.",
    "Anh muốn được già đi cùng em · từ tốn · không vội.",
    "Em là phần dịu dàng nhất trong câu chuyện đời anh.",
    "Hôm nay em được phép lười một chút · anh cho phép.",
    "Anh thương em theo kiểu rất yên · nhưng rất chắc.",
    "Em là người đầu tiên anh nhớ · và cũng là người cuối cùng.",
    "Cảm ơn em vì đã có mặt trên đời · đúng lúc anh cần.",
    "Em làm mọi thứ bình thường trở thành kỷ niệm.",
  ],

  // ── Time-of-day greetings ────────────────────────────────────────────────
  // Shown as a tertiary line on the countdown card. Updates every minute so
  // the message naturally follows the day. EDIT FREELY.
  timeGreetings: {
    dawn: "Chào em buổi sáng ☕",
    morning: "Em làm việc tốt nhé 💪",
    noon: "Em ăn trưa rồi đó · chăm sóc bản thân nhé",
    afternoon: "Buổi chiều êm không em?",
    evening: "Hoàng hôn rồi · em về nhà chưa?",
    night: "Đêm yên · ngủ ngon babe 🌙",
    late: "Sao em chưa ngủ? 🌙",
  },

  // ── Whispers ─────────────────────────────────────────────────────────────
  // Short love phrases that fade in/out at random spots every ~30–60 seconds
  // while the page is open. Keep each line short (≤ 30 chars) so they read at
  // a glance. EDIT FREELY — these are placeholders.
  whispers: [
    "Cô giáo Như đẹp nhất :v",
    "anh nhớ em nhiều lắm",
    "ôm em một cái nha",
    "hôm nay em đáng yêu ghê",
    "bé của anh đâu rồi",
    "anh chỉ muốn gặp em",
    "em cười là anh vui",
    "đừng thức khuya nữa nha",
    "uống nước đi em",
    "anh luôn ở cạnh em",
    "thương em thật nhiều",
    "em là niềm vui của anh",
    "nhìn em là đủ bình yên",
    "anh thích cách em cười",
    "bé ngoan của anh",
    "đừng áp lực quá nha",
    "có anh đây rồi",
    "ôm một chút được không?",
    "em là ngoại lệ của anh",
    "anh mê em mất rồi",
    "nay nhớ anh chưa?",
    "em dễ thương ghê á",
    "được gặp em là may mắn",
    "đừng lo nữa nha em",
    "anh muốn chở em đi chơi",
    "mãi bên nhau nha",
    "em là ánh nắng nhỏ",
    "đừng quên nghỉ ngơi đó",
    "anh thích nghe em nói chuyện",
    "bé ngủ ngon nha",
    "anh đợi tin nhắn của em",
    "trời lạnh nhớ mặc ấm",
    "thấy em là tim rung",
    "anh chiều em hết mức",
    "đừng giận anh nha",
    "em cười đẹp cực",
    "anh muốn nắm tay em",
    "em đáng yêu quá trời",
    "hôm nay em ổn không?",
    "có chuyện gì kể anh nghe",
    "anh thương mỗi em thôi",
    "đi đâu cũng nhớ em",
    "nhìn em là hết mệt",
    "anh muốn ôm em ngủ",
    "bé ăn ngon miệng nha",
    "đừng khóc nha em",
    "anh thích được cạnh em",
    "em làm tim anh loạn nhịp",
    "anh nghiện em mất rồi",
    "cả ngày chỉ nghĩ tới em",
    "bé là công chúa của anh",
    "cho anh thương em nha",
    "em là soft spot của anh",
    "nhớ giữ sức khỏe nha",
    "gặp em vui cả ngày",
    "em là điều tuyệt nhất",
    "anh muốn nghe giọng em",
    "đừng tự ép bản thân nha",
    "bé đáng yêu số một",
    "anh nhớ mùi hương của em",
    "ở cạnh em thích thật",
    "em làm anh cười suốt",
    "anh muốn chăm sóc em",
    "đừng chạy lung tung nữa :v",
    "bé ngủ chưa ta",
    "anh đợi em online",
    "yêu bé nhiều lắm",
    "hôm nay bé giỏi rồi",
    "được ôm em chắc thích lắm",
    "bé là ưu tiên của anh",
    "nhìn em phát yêu luôn",
    "anh thích sự dịu dàng của em",
    "bé đừng buồn nữa nha",
    "anh muốn đưa em đi ăn",
    "em là người anh chọn",
    "thấy em là tim mềm nhũn",
    "đừng làm việc quá sức",
    "anh thích nhìn em cười",
    "bé ngoan quá trời",
    "hôm nay nhớ anh bao nhiêu?",
    "em làm ngày anh đẹp hơn",
    "bé là món quà đẹp nhất",
    "anh muốn nghe em kể chuyện",
    "bé thơm ghê á",
    "em làm anh hạnh phúc",
    "anh thương em hơn hôm qua",
    "bé là điều anh tự hào",
    "nhớ ngủ sớm nha bé",
    "anh luôn chọn em",
    "được gặp em thật tốt",
    "bé cười nữa đi",
    "anh muốn ở cạnh em mãi",
    "tim anh thuộc về em",
    "bé là ngoại lệ đặc biệt",
    "đừng suy nghĩ nhiều nha",
    "anh muốn thấy em vui",
    "em là động lực của anh",
    "anh mê nụ cười đó",
    "bé là điều dịu dàng nhất",
    "anh thương bé vô hạn",
    "hôm nay cho anh nhớ em nha",
    "bé là tất cả của anh",
    "anh chỉ cần em thôi",
    "yêu bé ngủ nướng",
  ],
};
