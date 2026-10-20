// ============================================================
// RUAI TV — schedule-utils.js
// Aturan jadwal yang dipakai bersama oleh katalog (urutan program)
// dan tabel Jadwal Siaran Sepekan. Sumber data: kolom schedule
// tiap program (diisi dari dashboard admin) — tidak ada jadwal
// yang ditulis permanen di sini.
// ============================================================

window.RuaiSchedule = (() => {
  const DAYS = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];
  const SLOT_KEYS = ['pagi', 'siang', 'malam'];

  const dayIndex = (name) => DAYS.indexOf(name);

  // "Senin - Sabtu", "Selasa & Jumat", "Senin, Rabu", "Setiap hari" -> [indeks hari 0..6]
  const parseDays = (text) => {
    if (!text) return [];
    const s = String(text).toUpperCase();
    if (/SETIAP\s*HARI|SEMUA\s*HARI|SETIAP\s*MINGGU/.test(s)) return DAYS.map((_, i) => i);

    const found = new Set();
    const names = DAYS.join('|');

    // Rentang: "Senin - Kamis", "Sabtu s/d Senin" (boleh melewati akhir pekan)
    const range = new RegExp(`(${names})\\s*(?:-|–|—|S/D|SD|SAMPAI|HINGGA)\\s*(${names})`, 'g');
    let m;
    while ((m = range.exec(s))) {
      const from = dayIndex(m[1]);
      const to = dayIndex(m[2]);
      for (let i = from; ; i = (i + 1) % 7) {
        found.add(i);
        if (i === to) break;
      }
    }

    // Hari yang disebut satu per satu
    DAYS.forEach((d, i) => { if (s.includes(d)) found.add(i); });

    return [...found].sort((a, b) => a - b);
  };

  // "07.00 – 08.00 WIB" / "18.30 WIB" -> { minutes, label: "07.00" } (jam mulai); null bila tidak ada jam
  const parseStartTime = (text) => {
    const m = /(\d{1,2})[.:](\d{2})/.exec(String(text || ''));
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) return null;
    return { minutes: h * 60 + min, label: `${String(h).padStart(2, '0')}.${m[2]}` };
  };

  // Pengelompokan blok waktu berdasarkan jam mulai
  const blockOf = (minutes) => {
    if (minutes < 11 * 60) return 'PAGI';
    if (minutes < 15 * 60) return 'SIANG';
    if (minutes < 19 * 60) return 'SORE';
    return 'MALAM';
  };

  // Entri tayang terjadwal milik satu program: hanya slot aktif yang punya jam DAN hari terbaca
  const getEntries = (program) => {
    if (!program || !program.schedule) return [];
    const entries = [];
    SLOT_KEYS.forEach((key) => {
      const slot = program.schedule[key];
      if (!slot || !slot.active) return;
      const start = parseStartTime(slot.time);
      const days = parseDays(slot.days);
      if (!start || days.length === 0) return;
      entries.push({ slot: key, start, days });
    });
    return entries;
  };

  // Berapa kali program tayang dalam sepekan (dipakai untuk mengurutkan "paling sering tayang")
  const countWeeklyAirings = (program) =>
    getEntries(program).reduce((sum, e) => sum + e.days.length, 0);

  return { DAYS, parseDays, parseStartTime, blockOf, getEntries, countWeeklyAirings };
})();
