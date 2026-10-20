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

### Mode Produksi (Vercel + Supabase)

Website di-deploy ke **Vercel**; data program, login admin, dan banner memakai **Supabase**.
Kredensial publik (URL + anon key) ada di [`assets/js/supabase-config.js`](assets/js/supabase-config.js).

Setup Supabase (sekali saja, di SQL Editor, berurutan):

1. [`database/supabase_schema.sql`](database/supabase_schema.sql) — tabel `programs`, RLS, bucket `banners`, seed data. **Jangan dijalankan ulang** pada database yang sudah berjalan (seed menimpa data dengan id yang sama).
2. [`database/supabase_security.sql`](database/supabase_security.sql) — policy RLS: publik hanya baca, hanya admin yang bisa tulis/upload. Aman dijalankan ulang.
3. Buat akun admin: **Authentication → Users → Add user** (centang *Auto Confirm User*), lalu jalankan `UPDATE` di LANGKAH 5 file security dengan email tersebut agar akun diberi `app_metadata.role = 'admin'`.
4. Nonaktifkan pendaftaran publik: **Authentication → Sign In / Providers → matikan "Allow new users to sign up"**. (Policy sudah menolak non-admin, ini lapisan tambahan.)

---

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

### Fitur Admin Panel

| Fitur | Keterangan |
|---|---|
| **Login Page** | Login email + password via Supabase Auth, sesi diverifikasi ke server, hanya role `admin` |
| **Dashboard** | Statistik program (total, aktif, arsip, berita) + tabel 5 program terbaru |
| **Kelola Program** | CRUD lengkap: tambah, edit, hapus, toggle aktif/arsip |
| **Upload Banner** | Crop 16:9, kompres WebP ≤ 100 KB, upload ke Supabase Storage (khusus admin) |
| **Video Promo** | Input link YouTube bumper promosi per program |
| **Jadwal Tayang** | Input jam & hari tayang untuk slot Pagi, Siang/Sore, dan Malam |
| **Sinkron Supabase** | Semua perubahan langsung ke database; gagal simpan ditampilkan sebagai error, bukan sukses palsu |
| **Notifikasi** | Konfirmasi hapus, logout, dan toast notifikasi via SweetAlert2 |

---

## Struktur Folder

```
Homepage Statis Ruai-TV/
│
├── index.html                  # Halaman utama publik
├── .gitignore
├── .vercelignore               # File yang tidak ikut ter-deploy
├── vercel.json                 # Header keamanan & cache
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
└── assets/
    ├── css/
    │   └── style.css           # Seluruh styling frontend (CSS murni)
    │
    ├── js/
    │   ├── main.js             # Loader komponen, navbar scroll, live status checker
    │   ├── catalog.js          # Render grid program, filter, pencarian, modal detail
    │   ├── schedule.js         # Render tabel jadwal siaran mingguan dinamis
    │   ├── supabase-config.js  # URL & anon key Supabase (publik)
    │   └── supabase-client.js  # Client Supabase: auth, CRUD, storage
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
| **Backend** | Supabase (Auth, PostgREST, Storage) |
| **Database** | PostgreSQL (Supabase) dengan Row Level Security |
| **Font** | Google Fonts — Inter |
| **Notifikasi** | SweetAlert2 |
| **Hosting** | Vercel (static) / Python HTTP Server (lokal) |

---

## Arsitektur Data

Data program dibaca publik dari Supabase, dengan cadangan statis agar situs tetap tampil:

```
1. Supabase (tabel programs)           → data terkini
        |
        v (jika gagal / kosong)
2. assets/data/programs.json           → data statis bawaan
```

Penulisan data hanya lewat Admin Panel dan hanya diterima Supabase jika
JWT pengirim memiliki `app_metadata.role = 'admin'` (ditegakkan oleh RLS, bukan oleh JavaScript).

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
- [x] Migrasi ke Supabase (produksi cloud) + login Supabase Auth & RLS
- [ ] Halaman detail program per URL slug

---

## Lisensi

2026 **Ruai TV Kalimantan Barat**. Seluruh hak cipta dilindungi.
