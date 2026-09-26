-- =====================================================================
-- Uji tutup toko & rekonsiliasi kas (M3-8, M3-9)
--
-- Transaksional + ROLLBACK. Pakai: npm run db -- supabase/tests/shift.sql
-- Kolom "lulus" harus true semua.
-- =====================================================================

begin;

-- @include _fixtures.sql

create temp table hasil (
  no int, uji text, harapan text, hasil text, lulus boolean
) on commit drop;

do $$
declare
  v_kedai  uuid := '11111111-1111-4111-8111-000000000002';  -- Kenanga (bebas)
  v_kedai1 uuid := '11111111-1111-4111-8111-000000000001';
  v_emp    uuid := '22222222-2222-4222-8222-000000000003';  -- Sari
  v_prod   uuid := '33333333-3333-4333-8333-000000000001';
  v_shift  uuid;
  v_items  jsonb;
  r        record;
begin
  -- Tutup dulu shift lain di kedai ini supaya fixture bersih.
  update shifts set status = 'closed', closed_at = now(), closed_by = opened_by
   where kedai_id = v_kedai and status = 'open';

  insert into shifts (kedai_id, business_date, opened_by, opening_cash)
  values (v_kedai, current_date, v_emp, 100000)
  returning id into v_shift;

  v_items := jsonb_build_array(
    jsonb_build_object('product_id', v_prod, 'name', 'Kopi', 'price', 22000, 'qty', 2)
  );

  -- Dua penjualan tunai: 44.000 + 44.000 = 88.000
  perform create_transaction(gen_random_uuid(), v_kedai, v_shift, v_emp,
                             'OFF-S-1', 'dev', 'tunai', now(), v_items);
  perform create_transaction(gen_random_uuid(), v_kedai, v_shift, v_emp,
                             'OFF-S-2', 'dev', 'tunai', now(), v_items);

  -- === 1. Tutup tanpa antrian tertunda -> langsung final ==========
  -- Kas fisik dihitung pas: 100.000 + 88.000 = 188.000
  select * into r from close_shift(v_shift, v_kedai, v_emp, 188000, 0);

  insert into hasil values (1, 'expected_cash', '188000', r.expected_cash::text,
                            r.expected_cash = 188000);
  insert into hasil values (2, 'Selisih nol saat kas pas', '0', r.cash_difference::text,
                            r.cash_difference = 0);
  insert into hasil values (3, 'Status langsung final', 'final', r.reconciliation_status,
                            r.reconciliation_status = 'final');

  -- === 4. Tutup ulang: idempoten ==================================
  select * into r from close_shift(v_shift, v_kedai, v_emp, 999999, 5);
  insert into hasil values (4, 'Tutup ulang tidak menimpa kas', '188000',
                            r.expected_cash::text, r.expected_cash = 188000);

  -- === 5. Kedai lain tidak boleh menutup ==========================
  begin
    perform close_shift(v_shift, v_kedai1, v_emp, 0, 0);
    insert into hasil values (5, 'Tutup oleh kedai lain', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (5, 'Tutup oleh kedai lain', 'ditolak',
                              'ditolak (' || sqlstate || ')', true);
  end;

  -- === 6. Tutup DENGAN antrian tertunda -> pending_sync ===========
  update shifts set status = 'closed', closed_at = now(), closed_by = opened_by
   where kedai_id = v_kedai and status = 'open';

  insert into shifts (kedai_id, business_date, opened_by, opening_cash)
  values (v_kedai, current_date, v_emp, 50000)
  returning id into v_shift;

  perform create_transaction(gen_random_uuid(), v_kedai, v_shift, v_emp,
                             'OFF-S-3', 'dev', 'tunai', now(), v_items);

  -- Kasir melaporkan 2 transaksi masih di antrian HP.
  select * into r from close_shift(v_shift, v_kedai, v_emp, 150000, 2);

  insert into hasil values (6, 'Status pending_sync', 'pending_sync',
                            r.reconciliation_status, r.reconciliation_status = 'pending_sync');
  insert into hasil values (7, 'Penghitung tertunda', '2',
                            r.pending_sync_count::text, r.pending_sync_count = 2);
  -- Kas sementara: 50.000 + 44.000 = 94.000, fisik 150.000 -> selisih +56.000
  -- Selisih ini BELUM sah; dua transaksi yang tertahan itu nilainya 88.000.
  insert into hasil values (8, 'Selisih sementara (belum sah)', '56000',
                            r.cash_difference::text, r.cash_difference = 56000);

  -- === 9. Antrian menyusul, satu per satu ========================
  perform create_transaction(gen_random_uuid(), v_kedai, v_shift, v_emp,
                             'OFF-S-4', 'dev', 'tunai', now(), v_items);
  select * into r from reconcile_shift(v_shift, 1);

  insert into hasil values (9, 'Setelah 1 masuk: masih pending', 'pending_sync',
                            r.reconciliation_status, r.reconciliation_status = 'pending_sync');
  insert into hasil values (10, 'Sisa tertunda', '1',
                            r.pending_sync_count::text, r.pending_sync_count = 1);

  perform create_transaction(gen_random_uuid(), v_kedai, v_shift, v_emp,
                             'OFF-S-5', 'dev', 'tunai', now(), v_items);
  select * into r from reconcile_shift(v_shift, 1);

  insert into hasil values (11, 'Setelah semua masuk: final', 'final',
                            r.reconciliation_status, r.reconciliation_status = 'final');
  -- 50.000 + (44.000 x 3) = 182.000; fisik 150.000 -> selisih -32.000
  insert into hasil values (12, 'Selisih final terkoreksi', '-32000',
                            r.cash_difference::text, r.cash_difference = -32000);

  -- === 13. Transaksi void tidak dihitung di kas ==================
  update shifts set status = 'open', closed_at = null, closed_by = null
   where id = v_shift;
  declare v_tx uuid := gen_random_uuid();
  begin
    perform create_transaction(v_tx, v_kedai, v_shift, v_emp,
                               'OFF-S-6', 'dev', 'tunai', now(), v_items);
    perform void_transaction(v_tx, v_kedai, v_emp);
    select * into r from reconcile_shift(v_shift, 0);
    insert into hasil values (13, 'Transaksi void tidak menambah kas', '182000',
                              r.expected_cash::text, r.expected_cash = 182000);
  end;
end $$;

select no, uji, harapan, hasil, lulus from hasil order by no;

select
  count(*) filter (where lulus)     as lulus,
  count(*) filter (where not lulus) as gagal,
  count(*)                          as total
from hasil;

rollback;
