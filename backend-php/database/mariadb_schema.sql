-- ============================================================
-- RUAI TV — Skema MariaDB / MySQL (shared hosting IDCloudHost)
--
-- Cara pakai:
--   1. cPanel → "MySQL Databases": buat database + user, beri semua hak akses.
--   2. cPanel → phpMyAdmin → pilih database tsb → tab "Import" (atau "SQL")
--      → jalankan file ini.
--   3. Isi data program: lihat api/tools/import-programs.php (hasilnya bisa
--      berupa file .sql untuk diimpor lewat phpMyAdmin).
--   4. Buat akun admin: lihat api/tools/create-admin.php.
--
-- Aman dijalankan ulang: hanya CREATE TABLE IF NOT EXISTS, tidak menyentuh data.
-- Kompatibel: MariaDB 10.2+ dan MySQL 5.7/8.x. Semua waktu disimpan dalam UTC.
-- ============================================================

SET NAMES utf8mb4;

-- ------------------------------------------------------------
-- Program siaran
-- (aturan CHECK baru ditegakkan di MariaDB 10.2+ / MySQL 8.0.16+;
--  API PHP memvalidasi hal yang sama sehingga aman di versi lama)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS programs (
  id               VARCHAR(64)   NOT NULL,
  title            VARCHAR(255)  NOT NULL,
  slug             VARCHAR(255)  NOT NULL,
  category         VARCHAR(50)   NOT NULL DEFAULT 'berita',
  category_label   VARCHAR(100)  NULL,
  status           VARCHAR(20)   NOT NULL DEFAULT 'aktif',
  format           VARCHAR(100)  NULL DEFAULT '—',
  duration         VARCHAR(50)   NULL DEFAULT '—',
  description      TEXT          NULL,
  thumbnail_url    TEXT          NULL,
  promo_video_url  TEXT          NULL,
  youtube_live_url TEXT          NULL,
  schedule_json    JSON          NULL,
  featured         TINYINT(1)    NOT NULL DEFAULT 0,
  created_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_programs_category (category),
  KEY idx_programs_status (status),
  KEY idx_programs_slug (slug),
  CONSTRAINT chk_programs_category CHECK (category IN ('berita', 'non-news', 'kerja-sama')),
  CONSTRAINT chk_programs_status   CHECK (status IN ('aktif', 'arsip'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Akun admin (pengganti Supabase Auth). Hanya menyimpan hash password.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id            INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  email         VARCHAR(190)  NOT NULL,
  full_name     VARCHAR(120)  NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  role          VARCHAR(20)   NOT NULL DEFAULT 'admin',
  created_at    DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_login_at DATETIME(3)   NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Sesi login admin. Browser hanya memegang token acak (cookie HttpOnly);
-- di sini disimpan SHA-256 dari token itu, jadi isi tabel tidak bisa dipakai
-- untuk membajak sesi.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash CHAR(64)     NOT NULL,
  admin_id   INT UNSIGNED NOT NULL,
  csrf_token CHAR(48)     NOT NULL,
  created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at DATETIME(3)  NOT NULL,
  ip_hash    CHAR(64)     NULL,
  user_agent VARCHAR(255) NULL,
  PRIMARY KEY (token_hash),
  KEY idx_sessions_admin (admin_id),
  KEY idx_sessions_expires (expires_at),
  CONSTRAINT fk_sessions_admin FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- Percobaan login gagal (pembatas laju). IP dan email disimpan sebagai hash.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_attempts (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ip_hash      CHAR(64)    NOT NULL,
  email_hash   CHAR(64)    NOT NULL,
  attempted_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_attempts_time (attempted_at),
  KEY idx_attempts_ip (ip_hash, attempted_at),
  KEY idx_attempts_email (email_hash, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
