-- ============================================================
-- RUAI TV — Supabase PostgreSQL Schema & Seeder
-- Copy-paste semua script ini ke Supabase SQL Editor lalu klik "RUN"
-- ============================================================

-- 1. Buat Tabel programs
DROP TABLE IF EXISTS programs CASCADE;

CREATE TABLE programs (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'berita' CHECK (category IN ('berita', 'non-news', 'kerja-sama')),
  category_label VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'arsip')),
  format VARCHAR(100) DEFAULT '—',
  duration VARCHAR(50) DEFAULT '—',
  description TEXT,
  thumbnail_url TEXT,
  promo_video_url TEXT,
  youtube_live_url TEXT,
  schedule_json JSONB,
  featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pencarian dan filter
CREATE INDEX idx_programs_category ON programs(category);
CREATE INDEX idx_programs_status ON programs(status);
CREATE INDEX idx_programs_slug ON programs(slug);

-- 2. Buat Tabel users (Admin)
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  fullname VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin', 'editor')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Akun Default Admin
-- Password default: admin123 (hash MD5/plain fallback)
INSERT INTO users (username, password_hash, fullname, role)
VALUES ('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin Redaksi Ruai TV', 'superadmin')
ON CONFLICT (username) DO NOTHING;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Policy untuk programs: Siapapun boleh membaca (SELECT), Siapapun dengan anon key boleh modifikasi (bisa disesuaikan)
CREATE POLICY "Public Read Access on Programs"
  ON programs FOR SELECT
  USING (true);

CREATE POLICY "Allow All Actions on Programs"
  ON programs FOR ALL
  USING (true)
  WITH CHECK (true);

-- Policy untuk users
CREATE POLICY "Public Read Access on Users"
  ON users FOR SELECT
  USING (true);

-- 4. Setup Storage Bucket untuk Upload Banner Thumbnail
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy agar public bisa melihat dan mengunggah gambar
CREATE POLICY "Public Access Banners Bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'banners');

CREATE POLICY "Allow Upload to Banners Bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'banners');

CREATE POLICY "Allow Update in Banners Bucket"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'banners');

CREATE POLICY "Allow Delete in Banners Bucket"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'banners');

-- 5. Seed Data Program Awal
INSERT INTO programs (id, title, slug, category, category_label, status, format, duration, description, thumbnail_url, promo_video_url, youtube_live_url, schedule_json, featured) VALUES
('warta-ruai', 'Warta Ruai', 'warta-ruai', 'berita', 'Program Berita', 'aktif', 'Berita', '60 Menit', 'Paket buletin berita hasil liputan harian pada peristiwa dan isu aktual yang terjadi di Pontianak dan sekitarnya, serta Kalimantan Barat pada umumnya. Tayang tiga kali sehari — pagi, siang, dan malam — untuk memastikan pemirsa selalu mendapatkan informasi terkini.', 'assets/images/programs/Warta-Ruai.png', 'https://www.youtube.com/embed/live_stream?channel=UCruaitv', 'https://www.youtube.com/@ruaitv/live', '{"pagi": {"active": true, "days": "Senin - Sabtu", "time": "07.00 – 08.00 WIB", "label": "PAGI"}, "siang": {"active": true, "days": "Senin - Sabtu", "time": "13.00 – 14.00 WIB", "label": "SIANG"}, "malam": {"active": true, "days": "Senin - Sabtu", "time": "19.00 – 20.00 WIB", "label": "MALAM"}}'::jsonb, true),
('ruai-sepekan', 'Ruai Sepekan', 'ruai-sepekan', 'berita', 'Program Berita', 'aktif', 'Buletin Berita', '30 Menit', 'Rangkuman berita terhangat atau berita-berita utama selama sepekan dari Warta Ruai. Disajikan secara interaktif di mana publik memiliki ruang untuk mengomentari, mempertanyakan, dan memberikan opini terhadap materi berita atau permasalahan yang menjadi isi berita.', 'assets/images/programs/Ruai-Sepekan.png', NULL, 'https://www.youtube.com/@ruaitv/live', '{"pagi": {"active": false, "days": null, "time": null, "label": "PAGI"}, "siang": {"active": false, "days": null, "time": null, "label": "SIANG"}, "malam": {"active": true, "days": "Minggu", "time": "19.30 – 20.00 WIB", "label": "MALAM"}}'::jsonb, false),
('warta-warganet', 'Warta Warganet', 'warta-warganet', 'berita', 'Program Berita', 'aktif', 'Buletin Berita', '30 Menit', 'Acara yang digagas untuk memberi ruang dan menghargai WargaNet di Media Arustama. Memberikan apresiasi atas karya spontanitas maupun terencana terhadap segala kekayaan adat budaya, lingkungan, alam dan bahkan kesenjangan sosial yang tertangkap mata kamera Warganet.', 'assets/images/programs/WargaNet.png', NULL, 'https://www.youtube.com/@ruaitv/live', '{"pagi": {"active": false, "days": null, "time": null, "label": "PAGI"}, "siang": {"active": true, "days": "Selasa & Jumat", "time": "18.30 – 19.00 WIB", "label": "SIANG"}, "malam": {"active": false, "days": null, "time": null, "label": "MALAM"}}'::jsonb, false),
('rumah-kita', 'Rumah Kita', 'rumah-kita', 'berita', 'Program Berita', 'aktif', 'Talkshow / Podcast', '60 Menit', 'Program bincang-bincang/podcast inspiratif yang mengangkat kisah hidup, dedikasi, perjuangan, serta kiprah para tokoh publik, pemuka agama, pelaku seni, maupun individu inspiratif di Kalimantan Barat dalam melayani dan memberikan dampak positif bagi komunitas serta masyarakat luas.', 'assets/images/programs/Rumah-Kita.png', NULL, 'https://www.youtube.com/@ruaitv/live', '{"pagi": {"active": false, "days": null, "time": null, "label": "PAGI"}, "siang": {"active": false, "days": null, "time": null, "label": "SIANG"}, "malam": {"active": true, "days": "Senin", "time": "20.05 – 21.05 WIB", "label": "MALAM"}}'::jsonb, false),
('forum-ruai', 'Forum Ruai', 'forum-ruai', 'berita', 'Program Berita', 'aktif', 'Talkshow', '60 Menit', 'Forum Ruai Adalah ruang diskusi kritis yang sehat untuk memaparkan suatu masalah yang sedang terjadi maupun yang mungkin akan terjadi, membedah dari berbagai sudut pandang intelektualitas dengan kritis dan professional dan selalu memberi rekomendasi diakhir acara.', 'assets/images/programs/Forum-Ruai.png', NULL, 'https://www.youtube.com/@ruaitv/live', '{"pagi": {"active": false, "days": null, "time": null, "label": "PAGI"}, "siang": {"active": false, "days": null, "time": null, "label": "SIANG"}, "malam": {"active": true, "days": "Kamis", "time": "20.05 – 21.05 WIB", "label": "MALAM"}}'::jsonb, false),
('special-dialog', 'Special Dialog', 'special-dialog', 'berita', 'Program Berita', 'aktif', 'Talkshow', '60 Menit', 'Program dialog mendalam yang membahas isu-isu strategis politik, ekonomi, sosial, dan budaya bersama narasumber terpilih dari kalangan pejabat, pakar, dan tokoh masyarakat Kalimantan Barat.', 'assets/images/programs/Spesial-Dialog.png', NULL, 'https://www.youtube.com/@ruaitv/live', '{"pagi": {"active": true, "days": null, "time": "Tentatif / Kondisioanl", "label": "PAGI"}, "siang": {"active": false, "days": null, "time": null, "label": "SIANG"}, "malam": {"active": false, "days": null, "time": null, "label": "MALAM"}}'::jsonb, false),
('kilas-ruai', 'Kilas Ruai', 'kilas-ruai', 'berita', 'Program Berita', 'arsip', 'Breaking News', '—', 'Kilas ruai adalah ruang aktual penyajian berita dari berbagai jenis peristiwa yang terjadi disetiap redaksi mendapat informasi yang langsung direspon dengan cepat, cekat dan profesional tanpa mengurangi nilai kebenaran peristiwa. Selalu mengacu kepada 5W+1H', 'assets/images/programs/Kilas-Ruai.png', NULL, 'https://www.youtube.com/@ruaitv/live', '{"pagi": {"active": true, "days": "Senin - Sabtu", "time": "10.00 WIB", "label": "PAGI"}, "siang": {"active": true, "days": "Senin - Sabtu", "time": "15.00 WIB", "label": "SORE"}, "malam": {"active": true, "days": "Senin - Sabtu", "time": "17.00 WIB", "label": "SORE"}}'::jsonb, false),
('gong-ruai', 'Gong Ruai (On Target)', 'gong-ruai', 'berita', 'Program Berita', 'arsip', 'News Feature', '30 Menit', 'Acara Gong Ruai adalah ruai dokumenter reporting indept terhadap suatu kasus atau masalah yang sedang menjadi perhatian publik atau masyarakat tertentu seperti isu pengukuhan dan atau pengakuan akan hak masyarakat adat. Laporannya lebih dalam, tajam, kritis dan solutif. Menyajikan data primer, data sekunder dan sudut pandang dari sejumlah pakar dan pihak-pihak yang terlibat dalam topik dokumenter.', NULL, NULL, NULL, '{"pagi": {"active": false, "days": null, "time": null, "label": "PAGI"}, "siang": {"active": false, "days": null, "time": null, "label": "SIANG"}, "malam": {"active": false, "days": null, "time": null, "label": "MALAM"}}'::jsonb, false),
('warta-ruai-3-bahasa', 'Warta Ruai 3 Bahasa', 'warta-ruai-3-bahasa', 'berita', 'Program Berita', 'arsip', 'Program Berita / Talkshow', '—', 'Program berita unggulan Ruai TV yang disajikan dalam lima bahasa daerah Kalimantan Barat, menjangkau berbagai komunitas etnis di seluruh pelosok Kalbar.', NULL, NULL, NULL, '{"pagi": {"active": false, "days": null, "time": null, "label": "PAGI"}, "siang": {"active": false, "days": null, "time": null, "label": "SIANG"}, "malam": {"active": false, "days": null, "time": null, "label": "MALAM"}}'::jsonb, false),
('warta-credit-union', 'Warta Credit Union', 'warta-credit-union', 'berita', 'Program Berita', 'arsip', '—', '—', 'Jendela berita ekonomi kerakyatan berbasis koperasi simpan pinjam (Credit Union) di Kalimantan Barat, salah satu gerakan CU terbesar di Indonesia.', NULL, NULL, NULL, '{"pagi": {"active": false, "days": null, "time": null, "label": "PAGI"}, "siang": {"active": false, "days": null, "time": null, "label": "SIANG"}, "malam": {"active": false, "days": null, "time": null, "label": "MALAM"}}'::jsonb, false),
('slada-video-klip', 'Slada Video Klip', 'slada-video-klip', 'non-news', 'Non-News', 'aktif', 'Hiburan', '—', 'Program hiburan yang menayangkan video klip musik pilihan, menemani pemirsa Ruai TV dengan sajian musik terbaik dari berbagai genre.', 'assets/images/programs/Slada.png', NULL, 'https://www.youtube.com/@ruaitv/live', '{"pagi": {"active": false, "days": null, "time": null, "label": "PAGI"}, "siang": {"active": false, "days": null, "time": null, "label": "SIANG"}, "malam": {"active": false, "days": null, "time": null, "label": "MALAM"}}'::jsonb, false),
('galeri-khatulistiwa', 'Galeri Khatulistiwa', 'galeri-khatulistiwa', 'non-news', 'Non-News', 'arsip', 'Dokumenter', '—', 'Tayangan dokumenter yang menampilkan keindahan alam dan budaya Kalimantan Barat serta Nusantara dalam format visual yang memukau.', 'assets/images/programs/Borneo-Rawa-Island.png', NULL, 'https://www.youtube.com/', '{"pagi": {"active": false, "days": null, "time": null, "label": "PAGI"}, "siang": {"active": false, "days": null, "time": null, "label": "SIANG"}, "malam": {"active": false, "days": null, "time": null, "label": "MALAM"}}'::jsonb, false),
('slada-reguler', 'Slada Reguler', 'slada-reguler', 'non-news', 'Non-News', 'arsip', 'Hiburan', '—', 'Senandung Lagu Daerah (SLADA) reguler — program yang melestarikan dan memopulerkan lagu-lagu daerah Kalimantan Barat dalam format tayangan yang modern.', NULL, NULL, 'https://www.youtube.com/', '{"pagi": {"active": false, "days": null, "time": null, "label": "PAGI"}, "siang": {"active": false, "days": null, "time": null, "label": "SIANG"}, "malam": {"active": false, "days": null, "time": null, "label": "MALAM"}}'::jsonb, false),
('slada-week-end', 'Slada Week End', 'slada-week-end', 'non-news', 'Non-News', 'arsip', 'Hiburan', '—', 'Edisi akhir pekan dari program Senandung Lagu Daerah (SLADA) yang hadir dengan nuansa lebih santai dan pilihan lagu yang lebih beragam untuk menemani waktu weekend keluarga.', NULL, NULL, 'https://www.youtube.com/', '{"pagi": {"active": false, "days": null, "time": null, "label": "PAGI"}, "siang": {"active": false, "days": null, "time": null, "label": "SIANG"}, "malam": {"active": false, "days": null, "time": null, "label": "MALAM"}}'::jsonb, false),
('kapuas-karaoke', 'Kapuas (Karaoke Sampai Puas)', 'kapuas-karaoke', 'non-news', 'Non-News', 'arsip', 'Hiburan', '—', 'Program interaktif karaoke yang mengundang pemirsa untuk ikut bernyanyi bersama dan menikmati lagu-lagu favorit dalam format hiburan yang menyenangkan.', NULL, NULL, 'https://www.youtube.com/', '{"pagi": {"active": false, "days": null, "time": null, "label": "PAGI"}, "siang": {"active": false, "days": null, "time": null, "label": "SIANG"}, "malam": {"active": false, "days": null, "time": null, "label": "MALAM"}}'::jsonb, false),
('penyejuk-iman', 'Penyejuk Iman', 'penyejuk-iman', 'non-news', 'Non-News', 'arsip', 'Religi', '—', 'Program rohani yang menghadirkan ceramah, renungan, dan tayangan inspiratif untuk memperkuat keimanan dan spiritualitas pemirsa Ruai TV.', NULL, NULL, 'https://www.youtube.com/', '{"pagi": {"active": false, "days": null, "time": null, "label": "PAGI"}, "siang": {"active": false, "days": null, "time": null, "label": "SIANG"}, "malam": {"active": false, "days": null, "time": null, "label": "MALAM"}}'::jsonb, false),
('masakan-istimewa', 'Masakan Istimewa (Maskis)', 'masakan-istimewa', 'non-news', 'Non-News', 'arsip', 'Kuliner', '—', 'Program kuliner yang mengeksplorasi kekayaan cita rasa masakan khas dan istimewa Kalimantan Barat, menghadirkan resep, teknik memasak, dan cerita di balik hidangan tradisional maupun modern.', NULL, NULL, NULL, '{"pagi": {"active": false, "days": null, "time": null, "label": "PAGI"}, "siang": {"active": false, "days": null, "time": null, "label": "SIANG"}, "malam": {"active": false, "days": null, "time": null, "label": "MALAM"}}'::jsonb, false),
('pantun-rias', 'Pantun Rias', 'pantun-rias', 'non-news', 'Non-News', 'arsip', 'Seni Budaya', '—', 'Ruang pelestarian seni pantun dan sastra lisan Melayu Kalimantan Barat yang menampilkan pertunjukan pantun, syair, dan gurindam dari seniman lokal terpilih.', NULL, NULL, NULL, '{"pagi": {"active": false, "days": null, "time": null, "label": "PAGI"}, "siang": {"active": false, "days": null, "time": null, "label": "SIANG"}, "malam": {"active": false, "days": null, "time": null, "label": "MALAM"}}'::jsonb, false),
('voa-jalan-jalan', 'VOA — Jalan-Jalan Amerika', 'voa-jalan-jalan', 'kerja-sama', 'Kerja Sama', 'aktif', 'Dokumenter', '30 Menit', 'Program hasil kerja sama Ruai TV dengan Voice of America (VOA) yang menghadirkan tayangan dokumenter perjalanan dan budaya Amerika untuk pemirsa Kalimantan Barat.', 'assets/images/programs/VOA-Jalan-Jalan-Amerika.png', NULL, 'https://www.youtube.com/@ruaitv/live', '{"pagi": {"active": false, "days": null, "time": null, "label": "PAGI"}, "siang": {"active": true, "days": "Cek jadwal", "time": "Menyesuaikan", "label": "SIANG"}, "malam": {"active": false, "days": null, "time": null, "label": "MALAM"}}'::jsonb, false),
('ruai-lens', 'Ruai Lens', 'ruai-lens', 'kerja-sama', 'Kerja Sama', 'aktif', 'Liputan Khusus', '—', 'Program liputan khusus yang mengangkat program dan inisiatif mitra strategis Ruai TV — instansi pemerintah, organisasi non-pemerintah, lembaga donor, dan sektor swasta — dalam membangun masyarakat Kalimantan Barat.', 'assets/images/programs/Ruai-Lens.png', NULL, 'https://www.youtube.com/@ruaitv/live', '{"pagi": {"active": false, "days": null, "time": null, "label": "PAGI"}, "siang": {"active": true, "days": "Tentatif", "time": "Kondisional", "label": "SIANG"}, "malam": {"active": false, "days": null, "time": null, "label": "MALAM"}}'::jsonb, false)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  slug = EXCLUDED.slug,
  category = EXCLUDED.category,
  category_label = EXCLUDED.category_label,
  status = EXCLUDED.status,
  format = EXCLUDED.format,
  duration = EXCLUDED.duration,
  description = EXCLUDED.description,
  thumbnail_url = EXCLUDED.thumbnail_url,
  promo_video_url = EXCLUDED.promo_video_url,
  youtube_live_url = EXCLUDED.youtube_live_url,
  schedule_json = EXCLUDED.schedule_json,
  featured = EXCLUDED.featured;
