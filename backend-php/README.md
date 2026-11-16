# Backend PHP + MariaDB (arsip, belum dipakai)

Folder ini berisi backend alternatif yang menggantikan **Supabase + Vercel** sepenuhnya dengan
**PHP + MariaDB/MySQL + Object Storage S3**. Sudah dibangun dan diuji (API 55 kasus, UI 25 kasus
di Chrome, tanda tangan S3 dicocokkan dengan contoh resmi AWS), tetapi **tidak aktif**: situs
saat ini memakai Supabase untuk database dan login, dan hanya bucket banner yang dipindah
(lewat [`../api/banner.js`](../api/banner.js)).

Folder ini sengaja tidak ikut ter-deploy ke Vercel (lihat `.vercelignore`).

## Isi

| Path | Fungsi |
|---|---|
| `api/` | Backend PHP 8.0+: `auth.php`, `programs.php`, `upload.php`, `health.php`, `lib/`, `tools/` |
| `database/mariadb_schema.sql` | Skema MariaDB 10.2+ / MySQL 5.7+ |
| `apache/` | `.htaccess` untuk root, `admin/`, dan `database/` (ganti nama menjadi `.htaccess` di tempat tujuan) |
| `frontend/` | `api-client.js` dan `api-config.js`: pengganti `supabase-client.js` |
| `frontend-for-php.patch` | Perubahan pada file frontend yang ada (`admin.js`, `login.js`, `system.js`, `catalog.js`, `schedule.js`, halaman HTML, README) agar memakai `RuaiAPI` |

## Kalau suatu saat dipakai

Butuh hosting PHP (shared hosting cPanel atau VM). Garis besarnya:

1. Salin `backend-php/api/` ke `api/` di root situs, `database/mariadb_schema.sql` ke `database/`, dan `frontend/*.js` ke `assets/js/`.
2. Terapkan perubahan frontend: `git apply backend-php/frontend-for-php.patch` (patch ini juga **menghapus** file Supabase dan mengubah README).
3. Taruh `apache/*.htaccess` sebagai `.htaccess` di root, `admin/`, dan `database/`.
4. Salin `api/config.example.php` menjadi `ruai-config.php` di luar web root, isi database dan bucket.
5. Impor skema, lalu: `php api/tools/import-programs.php --from=supabase --copy-images` dan `php api/tools/create-admin.php EMAIL "Nama"`.

Catatan: `api/` di root juga dipakai Vercel untuk Functions. Jangan menaruh backend PHP dan `api/banner.js` di folder yang sama pada deployment Vercel.
