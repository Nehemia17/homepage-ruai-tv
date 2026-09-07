# 📺 Homepage Ruai TV — Kalimantan Barat

Website homepage untuk **Ruai TV**, stasiun televisi lokal terpercaya Kalimantan Barat yang menghadirkan berita, budaya, dan informasi untuk masyarakat Bumi Khatulistiwa.

> *"Jendela Inspirasi Anda"* — Ruai TV, berdiri sejak 07 Juli 2007 di Pontianak.

---

## 🌐 Cara Menjalankan

### Mode Statis (Tanpa Backend)

```bash
cd "c:/Apps/Homepage Statis Ruai-TV"
python -m http.server 3000
```

Buka browser: **http://localhost:3000**

### Mode Penuh dengan Backend PHP + MySQL (XAMPP)

1. Pastikan **XAMPP** sudah terinstall dan **Apache + MySQL** dalam status **Start**.
2. Letakkan folder proyek ini di dalam `C:/xampp/htdocs/`.
3. Import database: buka **phpMyAdmin** → buat database `ruai_tv` → import file [`database/ruai_tv.sql`](database/ruai_tv.sql).
4. Buka browser: **http://localhost/Homepage%20Statis%20Ruai-TV/**

---

## ✨ Fitur Website Publik

| Fitur | Keterangan |
|---|---|
| 🏠 **Hero Section** | Banner utama dengan Prime Time card dan animasi lingkaran |
| 📋 **Katalog Program** | Grid card program aktif & arsip dengan filter kategori |
| 🔍 **Filter & Pencarian** | Filter berdasarkan Semua / Aktif / Berita / Non-News / Kerja Sama / Arsip |
| 📅 **Jadwal Siaran** | Tabel jadwal mingguan (Senin–Minggu) per blok waktu |
| 🏛️ **Profil Lembaga** | Visi, Misi, Latar Belakang, Filosofi Logo, Jaringan |
| 📡 **Info Siaran** | Detail kanal terrestrial UHF & Satelit Telkom 4 |
| 🔴 **Indikator Live** | Tombol LIVE STREAMING aktif otomatis sesuai jam tayang Warta Ruai |
| 🎬 **Video Promo** | Pemutaran video bumper YouTube di modal detail program |
| 📱 **Responsive** | Tampilan menyesuaikan desktop, tablet, dan ponsel |

---

## 🔐 Admin Panel

Akses pengelola tersedia di `/admin/login.html` atau **http://localhost:3000/admin/login.html**

### Fitur Admin Panel

| Fitur | Keterangan |
|---|---|
| 🔒 **Login Page** | Halaman login dengan glassmorphism dark theme & SweetAlert2 |
| 📊 **Dashboard** | Statistik program (total, aktif, arsip, berita) + tabel terbaru |
| 📋 **Kelola Program** | CRUD program lengkap: tambah, edit, hapus, toggle aktif/arsip |
| 🖼️ **Upload Banner** | Upload gambar banner via PHP API (XAMPP) atau preview lokal (statis) |
| 🎬 **Video Promo** | Input link YouTube bumper promo per program |
| 🕒 **Jadwal Tayang** | Input jam & hari untuk slot Pagi, Siang/Sore, dan Malam |
| 🗄️ **MySQL Sync** | Sync otomatis ke MySQL API, fallback ke localStorage → programs.json |
| 🔔 **SweetAlert2** | Semua notifikasi, konfirmasi hapus, dan logout via SweetAlert2 |

---

## 🗂️ Struktur Folder

```
Homepage Statis Ruai-TV/
│
├── index.html                  # Halaman utama publik
├── .gitignore
├── README.md
│
├── admin/                      # Admin Panel
│   ├── login.html              # Halaman login admin
│   ├── index.html              # Dashboard pengelola
│   ├── programs.html           # Manajemen katalog program
│   └── assets/
│       ├── css/admin.css       # Design system admin panel
│       └── js/
│           ├── admin.js        # Logika CRUD + auth guard + SweetAlert2
│           └── login.js        # Logika autentikasi & session
│
├── api/                        # REST API Backend (PHP)
│   ├── db.php                  # Koneksi PDO MySQL
│   ├── programs.php            # CRUD API: GET/POST/PUT/DELETE
│   ├── upload.php              # Upload gambar banner
│   └── login.php               # Autentikasi admin
│
├── database/
│   └── ruai_tv.sql             # Schema MySQL + 35 data program + tabel users
│
├── includes/                   # Komponen modular (dimuat via JS)
│   ├── navbar.html             # Header / navigasi
│   └── footer.html             # Footer
│
└── assets/
    ├── css/
    │   └── style.css           # Seluruh styling frontend (CSS murni)
    │
    ├── js/
    │   ├── main.js             # Loader komponen, navbar scroll, live checker
    │   ├── catalog.js          # Render grid program & modal detail
    │   └── schedule.js         # Render tabel jadwal siaran
    │
    ├── data/
    │   └── programs.json       # Data program fallback (flat file)
    │
    └── images/
        ├── logo ruai.png       # Logo resmi Ruai TV
        └── programs/           # Gambar banner program
```

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| **Frontend** | HTML5, CSS3 (Vanilla), JavaScript ES6+ |
| **Backend** | PHP 8+ (REST API) |
| **Database** | MySQL 8 via XAMPP |
| **Font** | Google Fonts — Inter |
| **Notifikasi** | SweetAlert2 |
| **Dev Server** | Python HTTP Server (mode statis) / Apache XAMPP (mode penuh) |

---

## 📺 Info Siaran

| Media | Detail |
|---|---|
| **Terrestrial** | Kanal 43 UHF — 647,25 MHz — Pontianak |
| **Satelit** | Satelit Merah Putih (Telkom 4) — Frekuensi 4020 MHz — Symbol Rate 32.727 — Polaritas Vertikal — DVBS2 Mpeg 4 SD |
| **YouTube** | [youtube.com/@ruaitv](https://www.youtube.com/@ruaitv) |
| **Website** | [www.ruai.tv](https://www.ruai.tv) |

---

## 📋 Jadwal Warta Ruai (Program Unggulan)

| Sesi | Jam | Hari |
|---|---|---|
| 🌅 Pagi | 07.00 – 08.00 WIB | Senin – Sabtu |
| ☀️ Siang | 13.00 – 14.00 WIB | Senin – Sabtu |
| 🌙 Malam | 19.00 – 20.00 WIB | Senin – Sabtu |

> Indikator **LIVE STREAMING** di navbar akan aktif secara otomatis selama jam-jam di atas berlangsung.

---

## 🏢 Studio

```
JL. 28 OKTOBER NO.25-26
KEL. SIANTAN HULU, KEC. PONTIANAK UTARA
KOTA PONTIANAK, KALIMANTAN BARAT 78241

📧 ruaitvkalbar@gmail.com
📞 (+62 561) 884524
```

---

## 🗺️ Roadmap

- [x] Homepage statis (HTML/CSS/JS)
- [x] Katalog program dengan filter & modal detail
- [x] Jadwal siaran mingguan
- [x] Profil lembaga & jaringan
- [x] Komponen navbar & footer modular
- [x] Indikator live otomatis berdasarkan jam
- [x] Backend PHP + MySQL via XAMPP
- [x] Admin Panel CRUD program (tambah, edit, hapus, toggle)
- [x] Upload gambar banner via PHP API
- [x] Video promo YouTube di modal program
- [x] Jadwal tayang per slot (Pagi / Siang / Malam)
- [x] Login page admin dengan session guard
- [x] Notifikasi SweetAlert2 di seluruh admin panel
- [ ] Migrasi ke Supabase (produksi)
- [ ] Halaman detail program per URL slug

---

## 📄 Lisensi

© 2026 **Ruai TV Kalimantan Barat**. Seluruh hak cipta dilindungi.
