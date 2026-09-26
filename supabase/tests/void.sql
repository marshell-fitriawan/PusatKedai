-- =====================================================================
-- Uji fungsi void_transaction (M1-14)
--
-- Transaksional + ROLLBACK, aman dijalankan kapan saja.
-- Pakai: npm run db -- supabase/tests/void.sql
-- Kolom "lulus" harus true semua.
-- =====================================================================

begin;

-- @include _fixtures.sql

create temp table hasil (
  no int, uji text, harapan text, hasil text, lulus boolean
) on commit drop;

do $$
declare
  v_kedai   uuid := '11111111-1111-4111-8111-000000000001';  -- Melati
  v_kedai2  uuid := '11111111-1111-4111-8111-000000000002';  -- Kenanga
  v_emp     uuid := '22222222-2222-4222-8222-000000000001';
  v_prod    uuid := '33333333-3333-4333-8333-000000000001';
  v_shift   uuid;
  v_shift_c uuid;
  v_tx      uuid := gen_random_uuid();
  v_tx_c    uuid := gen_random_uuid();
  v_items   jsonb;
  v_stok0   integer;
  v_stok1   integer;
  v_stok2   integer;
  v_n       integer;
  v_status  text;
begin
  select id into v_shift from shifts
   where kedai_id = v_kedai and status = 'open' limit 1;
  if v_shift is null then
    insert into shifts (kedai_id, business_date, opened_by, opening_cash)
    values (v_kedai, current_date, v_emp, 0) returning id into v_shift;
  end if;

  v_items := jsonb_build_array(
    jsonb_build_object('product_id', v_prod, 'name', 'Kopi Susu Gula Aren', 'price', 22000, 'qty', 3)
  );

  select quantity into v_stok0
    from kedai_stock where kedai_id = v_kedai and product_id = v_prod;

  perform create_transaction(v_tx, v_kedai, v_shift, v_emp, 'OFF-VOID-1',
                             'dev', 'tunai', now(), v_items);

  select quantity into v_stok1
    from kedai_stock where kedai_id = v_kedai and product_id = v_prod;

  insert into hasil values (1, 'Stok berkurang setelah jual 3',
    (v_stok0 - 3)::text, v_stok1::text, v_stok1 = v_stok0 - 3);

  -- === 2. Void mengembalikan stok ================================
  perform void_transaction(v_tx, v_kedai, v_emp);

  select quantity into v_stok2
    from kedai_stock where kedai_id = v_kedai and product_id = v_prod;

  insert into hasil values (2, 'Stok kembali setelah void',
    v_stok0::text, v_stok2::text, v_stok2 = v_stok0);

  -- === 3. Status jadi void, jejak tercatat =======================
  select status into v_status from transactions where id = v_tx;
  insert into hasil values (3, 'Status transaksi', 'void', v_status, v_status = 'void');

  select count(*) into v_n from transactions
   where id = v_tx and voided_at is not null and voided_by = v_emp;
  insert into hasil values (4, 'Jejak pembatal tercatat', '1', v_n::text, v_n = 1);

  -- === 5. Ledger pembalik ========================================
  select count(*) into v_n from stock_movements
   where ref_transaction_id = v_tx and reason = 'void' and delta = 3;
  insert into hasil values (5, 'Movement void (+3)', '1', v_n::text, v_n = 1);

  -- Baris sale yang lama TIDAK dihapus -- riwayatnya harus tetap utuh.
  select count(*) into v_n from stock_movements
   where ref_transaction_id = v_tx and reason = 'sale';
  insert into hasil values (6, 'Movement sale tetap ada', '1', v_n::text, v_n = 1);

  -- === 7. Void ulang: idempoten ==================================
  perform void_transaction(v_tx, v_kedai, v_emp);

  select quantity into v_n
    from kedai_stock where kedai_id = v_kedai and product_id = v_prod;
  insert into hasil values (7, 'Void ulang: stok TIDAK naik lagi',
    v_stok0::text, v_n::text, v_n = v_stok0);

  select count(*) into v_n from stock_movements
   where ref_transaction_id = v_tx and reason = 'void';
  insert into hasil values (8, 'Void ulang: movement tidak dobel', '1', v_n::text, v_n = 1);

  -- === 9. Kedai lain tidak boleh membatalkan =====================
  begin
    perform void_transaction(v_tx, v_kedai2, v_emp);
    insert into hasil values (9, 'Void oleh kedai lain', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (9, 'Void oleh kedai lain', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 10. Shift yang sudah ditutup tidak boleh dibatalkan =======
  -- Membatalkan transaksi dari shift tertutup mengubah expected_cash secara
  -- surut; selisih kas yang sudah ditandatangani jadi tidak cocok lagi.
  insert into shifts (kedai_id, business_date, opened_by, opening_cash)
  values (v_kedai2, current_date, '22222222-2222-4222-8222-000000000003', 0)
  returning id into v_shift_c;

  perform create_transaction(v_tx_c, v_kedai2, v_shift_c,
                             '22222222-2222-4222-8222-000000000003',
                             'OFF-VOID-2', 'dev', 'tunai', now(), v_items);

  update shifts set status = 'closed', closed_at = now(),
                    closed_by = '22222222-2222-4222-8222-000000000003'
   where id = v_shift_c;

  begin
    perform void_transaction(v_tx_c, v_kedai2, '22222222-2222-4222-8222-000000000003');
    insert into hasil values (10, 'Void dari shift tertutup', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (10, 'Void dari shift tertutup', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;
end $$;

select no, uji, harapan, hasil, lulus from hasil order by no;

select
  count(*) filter (where lulus)     as lulus,
  count(*) filter (where not lulus) as gagal,
  count(*)                          as total
from hasil;

rollback;
