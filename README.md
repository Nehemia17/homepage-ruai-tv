# 📺 Homepage Ruai TV — Kalimantan Barat

Website homepage statis untuk **Ruai TV**, stasiun televisi lokal terpercaya Kalimantan Barat yang menghadirkan berita, budaya, dan informasi untuk masyarakat Bumi Khatulistiwa.

> *"Jendela Inspirasi Anda"* — Ruai TV, berdiri sejak 07 Juli 2007 di Pontianak.

---

## 🌐 Demo Lokal

Jalankan perintah berikut di terminal:

```bash
cd "c:/Apps/Homepage Statis Ruai-TV"
python -m http.server 3000
```

Kemudian buka browser dan akses: **http://localhost:3000**

---

## ✨ Fitur

| Fitur | Keterangan |
|---|---|
| 🏠 **Hero Section** | Banner utama dengan Prime Time card dan animasi lingkaran |
| 📋 **Katalog Program** | Grid card program aktif & arsip dengan filter kategori |
| 🔍 **Filter & Pencarian** | Filter berdasarkan Semua / Aktif / Berita / Non-News / Kerja Sama / Arsip |
| 📅 **Jadwal Siaran** | Tabel jadwal mingguan (Senin–Minggu) per blok waktu |
| 🏛️ **Profil Lembaga** | Visi, Misi, Latar Belakang, Filosofi Logo, Jaringan |
| 📡 **Info Siaran** | Detail kanal terrestrial UHF & Satelit Telkom 4 |
| 🔴 **Indikator Live** | Tombol LIVE STREAMING aktif otomatis sesuai jam tayang Warta Ruai |
| 📱 **Responsive** | Tampilan menyesuaikan desktop, tablet, dan ponsel |

---

## 🗂️ Struktur Folder

```
Homepage Statis Ruai-TV/
│
├── index.html                  # Halaman utama
├── .gitignore
├── README.md
│
├── includes/                   # Komponen modular (dimuat via JS)
│   ├── navbar.html             # Header / navigasi
│   └── footer.html             # Footer
│
└── assets/
    ├── css/
    │   └── style.css           # Seluruh styling (CSS murni)
    │
    ├── js/
    │   ├── main.js             # Loader komponen, navbar scroll, live checker
    │   ├── catalog.js          # Render grid program & modal detail
    │   └── schedule.js         # Render tabel jadwal siaran
    │
    ├── data/
    │   └── programs.json       # Data program (sementara flat file, akan migrasi ke DB)
    │
    └── images/
        ├── logo ruai.png       # Logo resmi Ruai TV
        └── programs/           # Thumbnail gambar program
```

---

## 🛠️ Tech Stack

- **HTML5** — Struktur halaman semantik
- **CSS3 (Vanilla)** — Styling lengkap tanpa framework
- **Tailwind CSS (CDN)** — Utilitas tambahan
- **Vanilla JavaScript (ES6+)** — Logika interaktif
- **Google Fonts** — Inter + Playfair Display
- **Python HTTP Server** — Development server lokal

---

## 📦 Data Program

Saat ini data ~31 program disimpan di [`assets/data/programs.json`](assets/data/programs.json).

**Rencana migrasi** (Phase 2):
1. **XAMPP (lokal)** → PHP + MySQL + Admin Panel CRUD
2. **Supabase (produksi)** → PostgreSQL + REST API

Perubahan di frontend minimal — cukup ganti URL `fetch()` di `catalog.js`.

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
- [x] Katalog program dengan filter & modal
- [x] Jadwal siaran mingguan
- [x] Profil lembaga & jaringan
- [x] Komponen navbar & footer modular
- [x] Indikator live otomatis berdasarkan jam
- [ ] Backend PHP + MySQL via XAMPP
- [ ] Admin panel CRUD program
- [ ] Migrasi ke Supabase
- [ ] Halaman detail program per URL
- [ ] Upload thumbnail via admin panel

---

## 📄 Lisensi

© 2026 **Ruai TV Kalimantan Barat**. Seluruh hak cipta dilindungi.
