-- =====================================================================
-- Uji fungsi laporan agregasi (M5-2)
--
-- Membuktikan angka omzet & laba-rugi benar, termasuk keputusan penting:
--   * transaksi void dikecualikan dari omzet
--   * granularitas mengelompokkan tanggal dengan benar
--   * kedai tanpa transaksi tetap muncul di laba-rugi (omzet 0, bukan hilang)
--   * gudang pusat tidak dihitung sebagai gerai (migration 0020)
--   * fungsi laporan TIDAK bisa dieksekusi anon (authenticated justru diberi)
--
-- Seluruh isi file berjalan dalam satu transaction dan DI-ROLLBACK.
-- Fixture dibuat sendiri dengan id tetap, jadi file ini tidak bergantung pada
-- seed dev mana pun (`npm run seed` dan `seed:minggu` punya UUID berbeda).
-- Pakai: npm run db -- supabase/tests/laporan.sql
-- Fungsi di-revoke dari anon tapi di-grant ke authenticated (migration 0011).
-- =====================================================================

begin;

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
  v_k3     uuid := gen_random_uuid();
  v_wh     uuid := gen_random_uuid();
  v_emp1   uuid := '22222222-2222-4222-8222-000000000001';
  v_shift  uuid := gen_random_uuid();
  v_hari   date := current_date;
  v_lalu   date := current_date - 1;
  v_omzet  numeric;
  v_jml    integer;
  v_selisih numeric;
begin
  -- Tiga kedai fiktif khusus uji -- TERISOLASI dari data dev yang sudah ada.
  -- Memakai seed kedai akan mencemari agregasi dengan transaksi nyata yang
  -- tersisa di database development.
  insert into kedai (id, name, timezone) values
    (v_k1, 'Kedai Uji Satu', 'Asia/Kuala_Lumpur'),
    (v_k2, 'Kedai Uji Dua', 'Asia/Kuala_Lumpur'),
    (v_k3, 'Kedai Uji Kosong', 'Asia/Kuala_Lumpur');

  -- Gudang pusat uji: bukan gerai penjualan, harus absen dari laporan omzet.
  insert into kedai (id, name, timezone, is_warehouse)
  values (v_wh, 'Gudang Uji Laporan', 'Asia/Kuala_Lumpur', true);

  -- Karyawan fixture (pemilik transaksi/shift di bawah).
  insert into employees (id, kedai_id, name, role, qr_token)
  values (v_emp1, v_k1, 'Kasir Uji Laporan', 'kasir', 'TEST-QR-LAPORAN-0001')
  on conflict (id) do nothing;

  -- Shift fixture berstatus closed -- bebas dari index satu-open-per-kedai.
  insert into shifts (id, kedai_id, business_date, opened_by, opening_cash, status, closed_at, closed_by)
  values (v_shift, v_k1, v_hari, v_emp1, 500000, 'closed', now(), v_emp1);

  -- Fixture transaksi:
  --   K1 : v_hari 2x completed (20.000 + 30.000), 1x void 99.999, v_lalu 1x completed 15.000
  --   K2 : v_hari 1x completed 12.000
  insert into transactions
    (id, kedai_id, shift_id, employee_id, business_date, local_number,
     subtotal, total, payment_method, status, device_id, created_at,
     transaction_number, voided_at, voided_by)
  values
    (gen_random_uuid(), v_k1, v_shift, v_emp1, v_hari, 'OFF-LAP-0001', 20000, 20000, 'tunai', 'completed', 'dev', now(), 'L1', null, null),
    (gen_random_uuid(), v_k1, v_shift, v_emp1, v_hari, 'OFF-LAP-0002', 30000, 30000, 'tunai', 'completed', 'dev', now(), 'L2', null, null),
    (gen_random_uuid(), v_k1, v_shift, v_emp1, v_hari, 'OFF-LAP-0003', 99999, 99999, 'qris', 'void', 'dev', now(), 'L3', now(), v_emp1),
    (gen_random_uuid(), v_k1, v_shift, v_emp1, v_lalu, 'OFF-LAP-0004', 15000, 15000, 'tunai', 'completed', 'dev', now(), 'L4', null, null),
    (gen_random_uuid(), v_k2, v_shift, v_emp1, v_hari, 'OFF-LAP-0005', 12000, 12000, 'tunai', 'completed', 'dev', now(), 'L5', null, null);

  -- Fixture pengeluaran: K1 v_hari 50.000, K2 v_lalu 8.000.
  insert into expenses (kedai_id, category, description, amount, expense_date, recorded_by_employee_id)
  values
    (v_k1, 'bahan_baku', 'Beli gula & susu', 50000, v_hari, v_emp1),
    (v_k2, 'listrik',     'Token listrik',    8000,  v_lalu, v_emp1);

  -- === 1. Omzet harian K1 (void dikecualikan) ======================
  select sum(omzet) into v_omzet
  from public.report_omzet(v_hari, v_hari, 'harian')
  where kedai_id = v_k1;

  if v_omzet = 50000 then
    insert into hasil values (1, 'Omzet harian (void dikecualikan)', '50000', v_omzet::text, true);
  else
    insert into hasil values (1, 'Omzet harian (void dikecualikan)', '50000', v_omzet::text, false);
  end if;

  -- === 2. Hitung transaksi per hari ================================
  select sum(jumlah_transaksi) into v_jml
  from public.report_omzet(v_hari, v_hari, 'harian')
  where kedai_id = v_k1;

  if v_jml = 2 then
    insert into hasil values (2, 'Jumlah transaksi per hari', '2', v_jml::text, true);
  else
    insert into hasil values (2, 'Jumlah transaksi per hari', '2', v_jml::text, false);
  end if;

  -- === 3. Omzet total rentang (2 hari, 1 kedai) ====================
  select sum(omzet) into v_omzet
  from public.report_omzet(v_lalu, v_hari, 'harian')
  where kedai_id = v_k1;

  if v_omzet = 65000 then
    insert into hasil values (3, 'Omzet total rentang', '65000', v_omzet::text, true);
  else
    insert into hasil values (3, 'Omzet total rentang', '65000', v_omzet::text, false);
  end if;

  -- === 4. Granularitas bulanan menggabung jadi satu bucket =========
  select count(*) into v_jml
  from public.report_omzet(v_lalu, v_hari, 'bulanan')
  where kedai_id = v_k1;

  if v_jml = 1 then
    insert into hasil values (4, 'Bulanan: satu bucket', '1', v_jml::text, true);
  else
    insert into hasil values (4, 'Bulanan: satu bucket', '1', v_jml::text, false);
  end if;

  -- === 5. Omzet bulanan tetap benar ================================
  select omzet into v_omzet
  from public.report_omzet(v_lalu, v_hari, 'bulanan')
  where kedai_id = v_k1;

  if v_omzet = 65000 then
    insert into hasil values (5, 'Omzet bulanan tetap benar', '65000', v_omzet::text, true);
  else
    insert into hasil values (5, 'Omzet bulanan tetap benar', '65000', v_omzet::text, false);
  end if;

  -- === 6. Laba-rugi: omzet - pengeluaran K1 ========================
  select selisih into v_selisih
  from public.report_laba_rugi(v_lalu, v_hari)
  where kedai_id = v_k1;

  if v_selisih = 15000 then
    insert into hasil values (6, 'Laba-rugi K1 (65000-50000)', '15000', v_selisih::text, true);
  else
    insert into hasil values (6, 'Laba-rugi K1 (65000-50000)', '15000', v_selisih::text, false);
  end if;

  -- === 7. Laba-rugi K2: 12000 omzet - 8000 belanja =================
  select selisih into v_selisih
  from public.report_laba_rugi(v_lalu, v_hari)
  where kedai_id = v_k2;

  if v_selisih = 4000 then
    insert into hasil values (7, 'Laba-rugi K2 (12000-8000)', '4000', v_selisih::text, true);
  else
    insert into hasil values (7, 'Laba-rugi K2 (12000-8000)', '4000', v_selisih::text, false);
  end if;

  -- === 8. Kedai tanpa data tetap muncul ============================
  select count(*) into v_jml
  from public.report_laba_rugi(v_lalu, v_hari)
  where kedai_id = v_k3;

  if v_jml = 1 then
    insert into hasil values (8, 'Kedai kosong tetap tampil', '1 baris', '1 baris', true);
  else
    insert into hasil values (8, 'Kedai kosong tetap tampil', '1 baris', coalesce(v_jml::text, '0'), false);
  end if;

  -- === 9. Void tidak mengurangi omzet (K2 tanpa void) ==============
  -- Omzet harian K2 = 12.000; salah bila ikut terpengaruh void K1.
  select omzet into v_omzet
  from public.report_omzet(v_hari, v_hari, 'harian')
  where kedai_id = v_k2;

  if v_omzet = 12000 then
    insert into hasil values (9, 'K2 omzet tidak terganggu', '12000', v_omzet::text, true);
  else
    insert into hasil values (9, 'K2 omzet tidak terganggu', '12000', v_omzet::text, false);
  end if;

  -- === 10. Fungsi tidak bisa dieksekusi anon ======================
  if has_function_privilege('anon', 'public.report_omzet(date, date, text)', 'EXECUTE')
      or has_function_privilege('anon', 'public.report_laba_rugi(date, date)', 'EXECUTE') then
    insert into hasil values (10, 'Tidak bisa dieksekusi anon', 'ditolak', 'DAPAT', false);
  else
    insert into hasil values (10, 'Tidak bisa dieksekusi anon', 'ditolak', 'ditolak', true);
  end if;

  -- === 11. Bisa dieksekusi admin (role authenticated) ==============
  -- Server app memakai anon key + JWT sesi admin -> role authenticated.
  if has_function_privilege('authenticated', 'public.report_omzet(date, date, text)', 'EXECUTE')
      and has_function_privilege('authenticated', 'public.report_laba_rugi(date, date)', 'EXECUTE') then
    insert into hasil values (11, 'Bisa dieksekusi admin', 'diberi', 'diberi', true);
  else
    insert into hasil values (11, 'Bisa dieksekusi admin', 'diberi', 'DITOLAK', false);
  end if;

  -- === 12. Gudang pusat absen dari ringkasan harian ===============
  select count(*) into v_jml
  from public.report_harian(v_hari, v_hari)
  where kedai_id = v_wh;

  if v_jml = 0 then
    insert into hasil values (12, 'Gudang absen dari report_harian', '0 baris', '0 baris', true);
  else
    insert into hasil values (12, 'Gudang absen dari report_harian', '0 baris', v_jml || ' baris', false);
  end if;

  -- === 13. Gudang tanpa pengeluaran absen dari laba-rugi ==========
  select count(*) into v_jml
  from public.report_laba_rugi(v_lalu, v_hari)
  where kedai_id = v_wh;

  if v_jml = 0 then
    insert into hasil values (13, 'Gudang tanpa biaya absen dari laba-rugi', '0 baris', '0 baris', true);
  else
    insert into hasil values (13, 'Gudang tanpa biaya absen dari laba-rugi', '0 baris', v_jml || ' baris', false);
  end if;

  -- === 14. Gudang berbiaya tetap tampil agar biaya tidak hilang ====
  insert into expenses (kedai_id, category, description, amount, expense_date, recorded_by_employee_id)
  values (v_wh, 'sewa', 'Sewa gudang', 7000, v_hari, v_emp1);

  select pengeluaran into v_selisih
  from public.report_laba_rugi(v_lalu, v_hari)
  where kedai_id = v_wh;

  if v_selisih = 7000 then
    insert into hasil values (14, 'Gudang berbiaya tetap tampil di laba-rugi', '7000', v_selisih::text, true);
  else
    insert into hasil values (14, 'Gudang berbiaya tetap tampil di laba-rugi', '7000',
      coalesce(v_selisih::text, 'tidak ada baris'), false);
  end if;
end $$;

select no, uji, harapan, hasil, lulus from hasil order by no;

select
  count(*) filter (where lulus)     as lulus,
  count(*) filter (where not lulus) as gagal,
  count(*)                          as total
from hasil;

rollback;