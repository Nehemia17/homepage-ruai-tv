-- ============================================================
-- RUAI TV — Supabase Security (RLS + Storage) — idempotent
-- Jalankan di Supabase SQL Editor. Aman dijalankan berulang kali dan
-- TIDAK menyentuh data di tabel programs.
--
-- Model akses:
--   * Publik (anon)  : hanya boleh MEMBACA tabel programs.
--   * Admin          : boleh tulis programs & upload/hapus banner.
--                      Admin = user Supabase Auth dengan
--                      app_metadata.role = 'admin' (lihat LANGKAH 2).
--     app_metadata hanya bisa diubah lewat service role / SQL, tidak
--     bisa diubah oleh user sendiri, jadi aman walau sign-up terbuka.
-- ============================================================

-- ------------------------------------------------------------
-- LANGKAH 1 — Bersihkan policy lama yang terbuka untuk publik
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Allow All Actions on Programs"      ON public.programs;
DROP POLICY IF EXISTS "Public Read Access on Programs"     ON public.programs;

DROP POLICY IF EXISTS "Public Access Banners Bucket"       ON storage.objects;
DROP POLICY IF EXISTS "Allow Upload to Banners Bucket"     ON storage.objects;
DROP POLICY IF EXISTS "Allow Update in Banners Bucket"     ON storage.objects;
DROP POLICY IF EXISTS "Allow Delete in Banners Bucket"     ON storage.objects;

-- Tabel users hanya dipakai login palsu lama (hash bcrypt "password" terbaca publik).
-- Login sekarang memakai Supabase Auth, jadi tabel ini dibuang.
DROP TABLE IF EXISTS public.users;

-- ------------------------------------------------------------
-- LANGKAH 2 — Helper: apakah pemanggil adalah admin?
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- ------------------------------------------------------------
-- LANGKAH 3 — Policy tabel programs
-- ------------------------------------------------------------
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS programs_public_read   ON public.programs;
DROP POLICY IF EXISTS programs_admin_insert  ON public.programs;
DROP POLICY IF EXISTS programs_admin_update  ON public.programs;
DROP POLICY IF EXISTS programs_admin_delete  ON public.programs;

CREATE POLICY programs_public_read  ON public.programs FOR SELECT
  USING (true);
CREATE POLICY programs_admin_insert ON public.programs FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY programs_admin_update ON public.programs FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY programs_admin_delete ON public.programs FOR DELETE
  TO authenticated USING (public.is_admin());

-- Auto-update kolom updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_programs_updated_at ON public.programs;
CREATE TRIGGER trg_programs_updated_at
  BEFORE UPDATE ON public.programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------
-- LANGKAH 4 — Storage bucket banners
--   Bucket publik: file bisa dilihat lewat URL langsung tanpa policy SELECT
--   (sengaja tidak dibuat agar isi bucket tidak bisa di-list publik).
--   Hanya admin yang boleh upload/ubah/hapus. Dibatasi gambar & maks 1 MB.
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('banners', 'banners', true, 1048576, ARRAY['image/webp', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 1048576,
  allowed_mime_types = ARRAY['image/webp', 'image/jpeg', 'image/png'];

DROP POLICY IF EXISTS banners_admin_insert ON storage.objects;
DROP POLICY IF EXISTS banners_admin_update ON storage.objects;
DROP POLICY IF EXISTS banners_admin_delete ON storage.objects;

CREATE POLICY banners_admin_insert ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'banners' AND public.is_admin());
CREATE POLICY banners_admin_update ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'banners' AND public.is_admin())
  WITH CHECK (bucket_id = 'banners' AND public.is_admin());
CREATE POLICY banners_admin_delete ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'banners' AND public.is_admin());

-- ------------------------------------------------------------
-- LANGKAH 5 — Jadikan akun Anda admin
--   Buat dulu user di Dashboard: Authentication → Users → Add user
--   (centang "Auto Confirm User"), lalu ganti email di bawah dan jalankan.
--   Setelah itu login ulang agar token memuat role terbaru.
-- ------------------------------------------------------------
-- UPDATE auth.users
-- SET raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
-- WHERE email = 'GANTI-DENGAN-EMAIL-ADMIN@contoh.com';
