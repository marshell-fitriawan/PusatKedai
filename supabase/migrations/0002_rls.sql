-- =====================================================================
-- Row Level Security (M0-10)
--
-- MODEL AKSES SISTEM INI
--
-- Ada dua jenis pemakai, dan hanya SATU yang lewat Supabase Auth:
--
--   1. Admin pusat / owner -- user Supabase Auth (email+password).
--      Aksesnya diatur policy di file ini.
--
--   2. Kasir / karyawan -- BUKAN user Supabase Auth. Mereka login lewat
--      QR token (docs/Tech.md), jadi tidak punya auth.uid() dan tidak akan
--      pernah cocok dengan policy mana pun di sini.
--
-- Konsekuensinya disengaja: seluruh akses POS berjalan lewat server
-- (server action / route handler) memakai service role, yang memang
-- melewati RLS. Pembatasan per kedai untuk karyawan ditegakkan di lapisan
-- itu -- lihat aturan wajib di lib/supabase/admin.ts.
--
-- Jadi RLS di sini bukan penegak utama untuk POS, melainkan lapisan
-- pertahanan kedua: kalau anon key bocor (dan pasti bocor, karena dikirim
-- ke browser), tidak ada satu baris pun yang bisa dibaca atau ditulis.
--
-- Baseline: tanpa policy = ditolak. Yang tidak disebut di bawah, dilarang.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper: apakah pemanggil adalah admin aktif?
--
-- SECURITY DEFINER penting di sini. Tanpa itu, policy pada admin_users
-- akan memanggil query ke admin_users lagi -- rekursi tak berujung.
-- Fungsi ini berjalan sebagai pemiliknya sehingga query internalnya tidak
-- ikut kena RLS.
--
-- search_path dikunci supaya fungsi SECURITY DEFINER tidak bisa dibajak
-- lewat objek bernama sama di schema lain.
-- ---------------------------------------------------------------------
create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.admin_users
    -- auth.uid() dibungkus subquery supaya dievaluasi sekali per query,
    -- bukan sekali per baris.
    where id = (select auth.uid())
      and is_active
  );
$$;

revoke all on function public.is_active_admin() from public;
grant execute on function public.is_active_admin() to authenticated;

-- ---------------------------------------------------------------------
-- Aktifkan RLS di seluruh tabel.
--
-- Ditulis eksplisit meskipun sudah aktif di database dev: instance klien
-- baru harus mendapat hasil yang sama hanya dengan menjalankan migration,
-- tanpa ada langkah manual di dashboard yang bisa terlupa.
-- ---------------------------------------------------------------------
alter table kedai             enable row level security;
alter table admin_users       enable row level security;
alter table employees         enable row level security;
alter table products          enable row level security;
alter table shifts            enable row level security;
alter table attendance        enable row level security;
alter table kedai_stock       enable row level security;
alter table stock_movements   enable row level security;
alter table stock_mutations   enable row level security;
alter table transactions      enable row level security;
alter table transaction_items enable row level security;
alter table expenses          enable row level security;

-- ---------------------------------------------------------------------
-- Policy admin.
--
-- Ditulis satu per satu, bukan lewat loop, supaya siapa pun yang mengaudit
-- keamanan bisa membaca persis apa yang diizinkan tanpa menjalankan apa pun.
--
-- Semua memakai FOR ALL: admin pusat memang berwenang penuh atas seluruh
-- kedai dalam satu instance. Pembatasan per kedai adalah urusan karyawan,
-- dan karyawan tidak lewat jalur ini.
-- ---------------------------------------------------------------------
create policy admin_all on kedai
  for all to authenticated
  using (public.is_active_admin()) with check (public.is_active_admin());

create policy admin_all on admin_users
  for all to authenticated
  using (public.is_active_admin()) with check (public.is_active_admin());

create policy admin_all on employees
  for all to authenticated
  using (public.is_active_admin()) with check (public.is_active_admin());

create policy admin_all on products
  for all to authenticated
  using (public.is_active_admin()) with check (public.is_active_admin());

create policy admin_all on shifts
  for all to authenticated
  using (public.is_active_admin()) with check (public.is_active_admin());

create policy admin_all on attendance
  for all to authenticated
  using (public.is_active_admin()) with check (public.is_active_admin());

create policy admin_all on kedai_stock
  for all to authenticated
  using (public.is_active_admin()) with check (public.is_active_admin());

create policy admin_all on stock_movements
  for all to authenticated
  using (public.is_active_admin()) with check (public.is_active_admin());

create policy admin_all on stock_mutations
  for all to authenticated
  using (public.is_active_admin()) with check (public.is_active_admin());

create policy admin_all on transactions
  for all to authenticated
  using (public.is_active_admin()) with check (public.is_active_admin());

create policy admin_all on transaction_items
  for all to authenticated
  using (public.is_active_admin()) with check (public.is_active_admin());

create policy admin_all on expenses
  for all to authenticated
  using (public.is_active_admin()) with check (public.is_active_admin());
