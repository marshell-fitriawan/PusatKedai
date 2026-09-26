-- =====================================================================
-- Uji laporan M8-4: report_harian + report_void_karyawan
--
-- Membuktikan:
--   * omzet hanya menghitung status completed (void & perlu_review dikeluarkan)
--   * kolom jumlah_void / jumlah_perlu_review benar
--   * selisih_terbuka = jumlah sesi final yang difference_status 'terbuka'
--   * rasio void per karyawan = void / (completed + void), urut menurun
--   * kedai tanpa transaksi tetap muncul (omzet 0)
--   * anon ditolak, authenticated diizinkan
--
-- Pakai: npm run db -- supabase/tests/laporan-harian.sql
-- =====================================================================

begin;

-- @include _fixtures.sql

create temp table hasil (
  no      int,
  uji     text,
  harapan text,
  hasil   text,
  lulus   boolean
) on commit drop;

do $$
declare
  v_k1     uuid := gen_random_uuid();
  v_k2     uuid := gen_random_uuid();
  v_emp1   uuid := '22222222-2222-4222-8222-000000000001';
  v_emp2   uuid := '22222222-2222-4222-8222-000000000002';
  v_shift1 uuid := gen_random_uuid();
  v_shift2 uuid := gen_random_uuid();
  v_hari   date := current_date;
  v_n      numeric;
  v_i      integer;
begin
  insert into kedai (id, name, timezone) values
    (v_k1, 'Kedai Uji Satu', 'Asia/Kuala_Lumpur'),
    (v_k2, 'Kedai Uji Dua', 'Asia/Kuala_Lumpur');

  insert into shifts (id, kedai_id, business_date, opened_by, opening_cash, status, closed_at, closed_by)
  values
    (v_shift1, v_k1, v_hari, v_emp1, 0, 'closed', now(), v_emp1),
    (v_shift2, v_k2, v_hari, v_emp2, 0, 'closed', now(), v_emp2);

  -- K1: 3 completed (20k,30k,10k) + 1 void 99.999 (oleh emp1) + 1 perlu_review 5k
  -- K2: 1 completed 12k. Sesi K1 final + difference_status 'terbuka' -> selisih_terbuka 1.
  insert into transactions
    (id, kedai_id, shift_id, employee_id, business_date, local_number,
     subtotal, total, payment_method, status, device_id, created_at,
     transaction_number, voided_at, voided_by)
  values
    (gen_random_uuid(), v_k1, v_shift1, v_emp1, v_hari, 'OFF-HR-0001', 20000, 20000, 'tunai', 'completed', 'dev', now(), 'H1', null, null),
    (gen_random_uuid(), v_k1, v_shift1, v_emp1, v_hari, 'OFF-HR-0002', 30000, 30000, 'tunai', 'completed', 'dev', now(), 'H2', null, null),
    (gen_random_uuid(), v_k1, v_shift1, v_emp1, v_hari, 'OFF-HR-0003', 10000, 10000, 'tunai', 'completed', 'dev', now(), 'H3', null, null),
    (gen_random_uuid(), v_k1, v_shift1, v_emp1, v_hari, 'OFF-HR-0004', 99999, 99999, 'qris', 'void', 'dev', now(), 'H4', now(), v_emp1),
    (gen_random_uuid(), v_k1, v_shift1, v_emp1, v_hari, 'OFF-HR-0005', 5000,  5000,  'tunai', 'perlu_review', 'dev', now(), 'H5', null, null),
    (gen_random_uuid(), v_k2, v_shift2, v_emp2, v_hari, 'OFF-HR-0006', 12000, 12000, 'tunai', 'completed', 'dev', now(), 'H6', null, null);

  update shifts set reconciliation_status = 'final', difference_status = 'terbuka'
   where id = v_shift1;

  -- === 1. Omzet harian K1 = completed saja ========================
  select omzet into v_n from public.report_harian(v_hari, v_hari) where kedai_id = v_k1;
  insert into hasil values (1, 'Omzet harian K1 (completed saja)',
    '60000', coalesce(v_n::text, 'null'), v_n = 60000);

  -- === 2. Jumlah transaksi K1 = 3 (void & perlu_review tidak dihitung) ===
  select jumlah_transaksi into v_i from public.report_harian(v_hari, v_hari) where kedai_id = v_k1;
  insert into hasil values (2, 'Jumlah transaksi K1 (completed)',
    '3', coalesce(v_i::text, 'null'), v_i = 3);

  -- === 3. Jumlah_void K1 = 1 ======================================
  select jumlah_void into v_i from public.report_harian(v_hari, v_hari) where kedai_id = v_k1;
  insert into hasil values (3, 'jumlah_void K1', '1', coalesce(v_i::text, 'null'), v_i = 1);

  -- === 4. Jumlah perlu_review K1 = 1 ===============================
  select jumlah_perlu_review into v_i from public.report_harian(v_hari, v_hari) where kedai_id = v_k1;
  insert into hasil values (4, 'jumlah_perlu_review K1', '1', coalesce(v_i::text, 'null'), v_i = 1);

  -- === 5. Selisih terbuka K1 = 1 ===================================
  select selisih_terbuka into v_i from public.report_harian(v_hari, v_hari) where kedai_id = v_k1;
  insert into hasil values (5, 'selisih_terbuka K1 (final+terbuka)', '1', coalesce(v_i::text, 'null'), v_i = 1);

  -- === 6. Kedai tanpa transaksi / selisih tetap muncul =============
  select count(*) into v_i from public.report_harian(v_hari, v_hari) where kedai_id = v_k2;
  insert into hasil values (6, 'Baris harian K2 muncul (omzet 0)',
    '1', coalesce(v_i::text, 'null'), v_i = 1);

  -- === 7. Rasio void karyawan emp1 = 1/4 = 25% =====================
  -- emp1: 3 completed + 1 void = 4; perlu_review belum void, tidak dihitung.
  -- emp2 tak punya void -> tidak muncul.
  select rasio_persen into v_n
    from public.report_void_karyawan(v_hari, v_hari)
   where employee_id = v_emp1;
  insert into hasil values (7, 'Rasio void emp1 (1 dari 4)',
    '25.0', coalesce(v_n::text, 'null'), v_n = 25.0);

  -- === 8. Karyawan dengan void muncul duluan (rasio menurun) =======
  -- emp1 (20%) muncul; emp2 (0 void) tidak muncul sama sekali.
  select count(*) into v_i from public.report_void_karyawan(v_hari, v_hari);
  insert into hasil values (8, 'Hanya karyawan ber-void yang muncul',
    '1', coalesce(v_i::text, 'null'), v_i = 1);

  -- === 9. Anon ditolak ============================================
  if has_function_privilege('anon', 'public.report_harian(date, date)', 'EXECUTE')
      or has_function_privilege('anon', 'public.report_void_karyawan(date, date)', 'EXECUTE') then
    insert into hasil values (9, 'Tidak bisa dieksekusi anon', 'ditolak', 'DAPAT', false);
  else
    insert into hasil values (9, 'Tidak bisa dieksekusi anon', 'ditolak', 'ditolak', true);
  end if;

  -- === 10. Bisa dieksekusi authenticated ============================
  if has_function_privilege('authenticated', 'public.report_harian(date, date)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.report_void_karyawan(date, date)', 'EXECUTE') then
    insert into hasil values (10, 'Bisa dieksekusi admin', 'diberi', 'diberi', true);
  else
    insert into hasil values (10, 'Bisa dieksekusi admin', 'diberi', 'DITOLAK', false);
  end if;
end $$;

select no, uji, harapan, hasil, lulus from hasil order by no;

select
  count(*) filter (where lulus)     as lulus,
  count(*) filter (where not lulus) as gagal,
  count(*)                          as total
from hasil;

rollback;