-- =====================================================================
-- Storage untuk gambar produk (M1-4)
--
-- Bucket dibuat lewat migration, bukan diklik di dashboard, supaya instance
-- klien baru mendapat hasil yang sama hanya dengan menjalankan migration.
--
-- KENAPA UNGGAH LANGSUNG DARI BROWSER, BUKAN LEWAT SERVER ACTION
-- Server action Next dibatasi 1MB per request secara bawaan. Foto produk
-- dari kamera HP gampang menembusnya. Menaikkan batas itu berarti seluruh
-- byte gambar melewati server Next lebih dulu -- lambat dan mahal, padahal
-- tujuannya cuma menaruh file di Storage.
--
-- Jadi: browser mengunggah langsung ke Storage (dibatasi policy di bawah),
-- lalu hanya URL hasilnya yang dikirim ke server action.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'produk',
  'produk',
  true,                                    -- gambar produk memang untuk dilihat publik
  2097152,                                 -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Batas ukuran dan tipe file di atas ditegakkan Storage, bukan hanya oleh
-- form di browser. Form bisa dilewati; bucket tidak.

-- ---------------------------------------------------------------------
-- Policy: siapa boleh apa terhadap file di bucket ini
-- ---------------------------------------------------------------------

-- Baca: siapa saja. Gambar produk tampil di halaman kasir, dan kasir tidak
-- punya sesi Supabase Auth.
drop policy if exists produk_read_public on storage.objects;
create policy produk_read_public on storage.objects
  for select to public
  using (bucket_id = 'produk');

-- Tulis/ubah/hapus: hanya admin aktif. Memakai fungsi yang sama dengan RLS
-- tabel (lihat 0002_rls.sql), jadi menonaktifkan admin langsung mencabut
-- hak unggahnya juga.
drop policy if exists produk_insert_admin on storage.objects;
create policy produk_insert_admin on storage.objects
  for insert to authenticated
  with check (bucket_id = 'produk' and public.is_active_admin());

drop policy if exists produk_update_admin on storage.objects;
create policy produk_update_admin on storage.objects
  for update to authenticated
  using (bucket_id = 'produk' and public.is_active_admin())
  with check (bucket_id = 'produk' and public.is_active_admin());

drop policy if exists produk_delete_admin on storage.objects;
create policy produk_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'produk' and public.is_active_admin());
