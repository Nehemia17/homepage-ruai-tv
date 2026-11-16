// ============================================================
// RUAI TV — Alamat API backend (PHP + MariaDB + Object Storage)
// File ini publik: jangan isi kunci/password apa pun di sini.
// Semua rahasia (database, kunci bucket) ada di server: api/config.php.
// ============================================================

window.RUAI_API_CONFIG = {
  // Situs dan API satu domain (disarankan): biarkan '/api'.
  // Bila API ada di domain lain (mis. frontend tetap di Vercel), isi alamat lengkapnya,
  // contoh: 'https://ruaitv.example.id/api', lalu daftarkan domain frontend
  // di cors_allowed_origins pada api/config.php.
  baseUrl: '/api'
};
