# Homepage Ruai TV — Kalimantan Barat

Website homepage untuk **Ruai TV**, stasiun televisi lokal Kalimantan Barat yang menyiarkan berita, budaya, dan informasi untuk masyarakat Bumi Khatulistiwa.

> *"Jendela Inspirasi Anda"* — Ruai TV, berdiri sejak 07 Juli 2007 di Pontianak.

---

## Cara Menjalankan

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

## Fitur Website Publik

| Fitur | Keterangan |
|---|---|
| **Hero Section** | Banner utama dengan Prime Time card dan animasi lingkaran |
| **Katalog Program** | Grid card program aktif & arsip dengan filter kategori dan pencarian real-time |
| **Filter & Pencarian** | Filter Semua / Aktif / Berita / Non-News / Kerja Sama / Arsip, sinkron dengan search bar navbar |
| **Jadwal Siaran** | Tabel jadwal mingguan (Senin–Minggu) per blok waktu, diisi otomatis dari data program |
| **Profil Lembaga** | Visi, Misi, Latar Belakang, Filosofi Logo, Tim, Jaringan |
| **Info Siaran** | Detail kanal terrestrial UHF & Satelit Telkom 4 |
| **Indikator Live** | Tombol Live Streaming aktif otomatis sesuai jam tayang Warta Ruai (WIB) |
| **Modal Detail Program** | Popup detail lengkap: sinopsis, jadwal slot, video bumper autoplay, tombol tonton live |
| **Video Promo Autoplay** | Video bumper YouTube diputar otomatis saat modal program dibuka |
| **Responsive** | Tampilan menyesuaikan desktop, tablet, dan ponsel |

---

## Admin Panel

Akses pengelola tersedia di `/admin/login.html`

Jika menggunakan mode statis: **http://localhost:3000/admin/login.html**
Jika menggunakan XAMPP: **http://localhost/Homepage%20Statis%20Ruai-TV/admin/login.html**

### Fitur Admin Panel

| Fitur | Keterangan |
|---|---|
| **Login Page** | Halaman login dengan session guard, toggle show/hide password, SweetAlert2 |
| **Dashboard** | Statistik program (total, aktif, arsip, berita) + tabel 5 program terbaru |
| **Kelola Program** | CRUD lengkap: tambah, edit, hapus, toggle aktif/arsip |
| **Upload Banner** | Upload gambar banner via PHP API (XAMPP) atau base64 fallback (mode statis) |
| **Video Promo** | Input link YouTube bumper promosi per program |
| **Jadwal Tayang** | Input jam & hari tayang untuk slot Pagi, Siang/Sore, dan Malam |
| **MySQL Sync** | Sync otomatis ke MySQL API, fallback ke localStorage, fallback ke programs.json |
| **Notifikasi** | Konfirmasi hapus, logout, dan toast notifikasi via SweetAlert2 |

---

## Struktur Folder

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
│           ├── admin.js        # Logika CRUD, auth guard, SweetAlert2
│           └── login.js        # Logika autentikasi & session
│
├── api/                        # REST API Backend (PHP)
│   ├── db.php                  # Koneksi PDO MySQL
│   ├── programs.php            # CRUD API: GET / POST / PUT / DELETE
│   ├── upload.php              # Upload gambar banner
│   └── login.php               # Autentikasi admin
│
├── database/
│   └── ruai_tv.sql             # Schema MySQL + data program + tabel users
│
├── includes/                   # Komponen modular (dimuat via JS fetch)
│   ├── navbar.html             # Header / navigasi + search bar
│   └── footer.html             # Footer
│
├── scratch/                    # Script utilitas sementara (tidak untuk produksi)
│
└── assets/
    ├── css/
    │   └── style.css           # Seluruh styling frontend (CSS murni)
    │
    ├── js/
    │   ├── main.js             # Loader komponen, navbar scroll, live status checker
    │   ├── catalog.js          # Render grid program, filter, pencarian, modal detail
    │   └── schedule.js         # Render tabel jadwal siaran mingguan dinamis
    │
    ├── data/
    │   └── programs.json       # Data program fallback (flat file, offline mode)
    │
    └── images/
        ├── logo ruai.png       # Logo resmi Ruai TV
        └── programs/           # Gambar banner program
```

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| **Frontend** | HTML5, CSS3 (Vanilla), JavaScript ES6+ |
| **Backend** | PHP 8+ (REST API, PDO) |
| **Database** | MySQL 8 via XAMPP |
| **Font** | Google Fonts — Inter |
| **Notifikasi** | SweetAlert2 |
| **Dev Server** | Python HTTP Server (mode statis) / Apache XAMPP (mode penuh) |

---

## Arsitektur Data

Website menggunakan sistem fallback 3 lapis agar tetap berfungsi dalam kondisi apapun:

```
1. MySQL REST API (api/programs.php)   → data terkini dari database
        |
        v (jika API tidak tersedia)
2. localStorage                        → cache dari sesi sebelumnya
        |
        v (jika localStorage kosong)
3. assets/data/programs.json           → data statis bawaan
```

---

## Info Siaran

| Media | Detail |
|---|---|
| **Terrestrial** | Kanal 43 UHF, 647,25 MHz, Pontianak |
| **Satelit** | Satelit Merah Putih (Telkom 4), Frekuensi 4020 MHz, Symbol Rate 32.727, Polaritas Vertikal, DVBS2 Mpeg 4 SD |
| **YouTube Live** | [youtube.com/@livestreamingruaitelevisi5647/streams](https://www.youtube.com/@livestreamingruaitelevisi5647/streams) |
| **Website** | [www.ruai.tv](https://www.ruai.tv) |

---

## Jadwal Warta Ruai (Program Unggulan)

| Sesi | Jam | Hari |
|---|---|---|
| Pagi | 07.00 – 08.00 WIB | Senin – Sabtu |
| Siang | 13.00 – 14.00 WIB | Senin – Sabtu |
| Malam | 19.00 – 20.00 WIB | Senin – Sabtu |

> Indikator **Live Streaming** di navbar aktif otomatis selama jam-jam di atas berlangsung.

---

## Studio

```
JL. 28 OKTOBER NO.25-26
KEL. SIANTAN HULU, KEC. PONTIANAK UTARA
KOTA PONTIANAK, KALIMANTAN BARAT 78241

Email : ruaitvkalbar@gmail.com
Telp  : (+62 561) 884524
```

---

## Roadmap

- [x] Homepage statis (HTML/CSS/JS)
- [x] Katalog program dengan filter, pencarian real-time, dan modal detail
- [x] Jadwal siaran mingguan dinamis (multi-program per slot)
- [x] Profil lembaga & jaringan
- [x] Komponen navbar & footer modular
- [x] Indikator live otomatis berdasarkan jam WIB
- [x] Search bar navbar sinkron dengan filter katalog
- [x] Backend PHP + MySQL via XAMPP
- [x] Admin Panel CRUD program (tambah, edit, hapus, toggle status)
- [x] Upload gambar banner via PHP API dengan fallback base64
- [x] Video promo YouTube autoplay di modal detail program
- [x] Jadwal tayang per slot (Pagi / Siang / Malam) dengan auto-check
- [x] Login page admin dengan session guard & SweetAlert2
- [x] Link live streaming diperbarui ke channel resmi Ruai TV
- [ ] Migrasi ke Supabase (produksi cloud)
- [ ] Halaman detail program per URL slug

---

## Lisensi

2026 **Ruai TV Kalimantan Barat**. Seluruh hak cipta dilindungi.
