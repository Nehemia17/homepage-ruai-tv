<?php
/**
 * RUAI TV — contoh konfigurasi API.
 *
 * Cara pakai (pilih satu, urutan pencarian dari yang teratas):
 *   1. DISARANKAN: simpan sebagai  ../ruai-config.php  di LUAR public_html
 *      (satu tingkat di atas folder situs), jadi tidak pernah bisa diunduh.
 *   2. Variabel lingkungan RUAI_CONFIG = path lengkap file konfigurasi.
 *   3. Simpan sebagai api/config.php (dilindungi api/.htaccess dan .gitignore).
 *
 * JANGAN isi kunci asli di file contoh ini, dan jangan commit file konfigurasi asli.
 */
return [
    // true = pesan galat teknis ikut dikirim ke browser. Hanya untuk debugging lokal.
    'debug' => false,

    // Database dari cPanel → MySQL Databases. Di cPanel, nama database dan user
    // biasanya berawalan nama akun, mis. "akunku_ruaitv".
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'GANTI_NAMA_DATABASE',
        'user' => 'GANTI_USER_DATABASE',
        'pass' => 'GANTI_PASSWORD_DATABASE',
    ],

    'storage' => [
        // 's3'    = bucket Object Storage IDCloudHost (produksi)
        // 'local' = simpan di folder uploads/ (hanya untuk pengembangan lokal)
        'driver' => 's3',

        // Batas ukuran satu file banner (byte). Admin panel sudah mengompres ke ≤ 100 KB.
        'max_upload_bytes' => 1048576,

        's3' => [
            // Salin persis dari panel IDCloudHost → Object Storage, tanpa garis miring di akhir.
            'endpoint'   => 'https://GANTI-ENDPOINT-DARI-PANEL-IDCLOUDHOST',
            'region'     => 'us-east-1',          // biarkan jika panel tidak menampilkan region
            'bucket'     => 'storage-homepage-statis',
            'access_key' => 'GANTI_ACCESS_KEY',
            'secret_key' => 'GANTI_SECRET_KEY',
            // true  = https://endpoint/bucket/file   (umumnya untuk S3 kompatibel / Ceph)
            // false = https://bucket.endpoint/file
            'path_style' => true,
            // Alamat publik tempat gambar dibuka browser, tanpa garis miring di akhir.
            // Contoh path-style: https://ENDPOINT/storage-homepage-statis
            'public_base_url' => 'https://GANTI-ENDPOINT-DARI-PANEL-IDCLOUDHOST/storage-homepage-statis',
            // Header ACL saat upload. Isi '' (kosong) jika bucket sudah publik lewat policy
            // dan layanan menolak header ACL.
            'acl' => 'public-read',
        ],

        'local' => [
            'dir'             => null,         // null = <folder situs>/uploads
            'public_base_url' => '/uploads',
        ],
    ],

    'session' => [
        'default_hours'   => 12,   // login tanpa "ingat saya"
        'remember_days'   => 30,   // login dengan "ingat saya"
        // 'Strict' bila situs dan API satu domain. 'None' (wajib HTTPS) hanya bila
        // frontend ada di domain lain dan didaftarkan di cors_allowed_origins.
        'cookie_samesite' => 'Strict',
    ],

    // Kosongkan jika frontend dan API satu domain (disarankan).
    // Contoh bila frontend tetap di Vercel: ['https://ruaitv.vercel.app']
    'cors_allowed_origins' => [],

    // true hanya jika server di belakang proxy tepercaya (mis. Cloudflare):
    // memakai X-Forwarded-Proto / X-Forwarded-For. Jika tidak yakin, biarkan false.
    'trust_proxy_headers' => false,
];
