-- =====================================================================
-- Uji Row Level Security (M0-10)
--
-- Menirukan persis cara PostgREST menjalankan query: menyetel
-- request.jwt.claims lalu berganti ke role anon/authenticated. auth.uid()
-- membaca dari setting itu, jadi policy diuji lewat jalur yang sama dengan
-- request sungguhan -- bukan disimulasikan.
--
-- Seluruh file berjalan dalam satu transaction dan DI-ROLLBACK.
--
-- Pakai: npm run db -- supabase/tests/rls.sql
-- Kolom "lulus" harus true semua.
-- =====================================================================

begin;

-- === 1. anon (belum login) =====================================
-- Anon key dikirim ke browser dan pasti bocor. Tanpa policy untuk anon,
-- tidak boleh ada satu baris pun yang terbaca.
select set_config('request.jwt.claims', null, true);
set local role anon;
select 'anon' as sebagai, 0 as harusnya, count(*)::int as terbaca, count(*) = 0 as lulus from kedai;
reset role;

-- === 2. login TAPI bukan admin =================================
-- Uji paling penting di file ini. Kalau policy hanya memeriksa "sudah
-- login", siapa pun yang berhasil mendaftar akan punya akses penuh ke
-- seluruh data bisnis klien.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000000"}', true);
set local role authenticated;
select 'login bukan admin' as sebagai, 0 as harusnya, count(*)::int as terbaca, count(*) = 0 as lulus from kedai;
reset role;

-- === 3. admin aktif ============================================
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select id from admin_users where is_active limit 1))::text,
  true
);
set local role authenticated;
-- Harus terbaca SEMUA baris kedai: admin aktif punya akses penuh. Jumlahnya
-- dihitung dari data nyata agar file ini tidak bergantung pada seed (jumlah
-- kedai beda antara `npm run seed` dan `seed:minggu`).
select 'admin aktif' as sebagai,
       (select count(*) from kedai)::int as harusnya,
       count(*)::int as terbaca,
       count(*) = (select count(*) from kedai) as lulus
from kedai;
reset role;

-- === 4. admin dinonaktifkan ====================================
-- Menonaktifkan admin harus langsung memutus aksesnya, tanpa perlu
-- mencabut sesi atau menunggu token kedaluwarsa.
update admin_users set is_active = false;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', (select id from admin_users limit 1))::text,
  true
);
set local role authenticated;
select 'admin nonaktif' as sebagai, 0 as harusnya, count(*)::int as terbaca, count(*) = 0 as lulus from kedai;
reset role;

rollback;
