-- =====================================================================
-- Uji fungsi create_transaction (M1-8, M1-9)
--
-- Seluruh file berjalan dalam satu transaction dan DI-ROLLBACK, jadi aman
-- dijalankan kapan saja terhadap database ber-seed.
--
-- Pakai: npm run db -- supabase/tests/transaction.sql
-- Kolom "lulus" harus true semua.
-- =====================================================================

begin;

-- @include _fixtures.sql

create temp table hasil (
  no int, uji text, harapan text, hasil text, lulus boolean
) on commit drop;

do $$
declare
  v_kedai   uuid := '11111111-1111-4111-8111-000000000001';  -- Kedai Melati
  v_emp     uuid := '22222222-2222-4222-8222-000000000001';  -- Rina
  v_prod    uuid := '33333333-3333-4333-8333-000000000001';  -- Kopi Susu 22000
  v_prod2   uuid := '33333333-3333-4333-8333-000000000002';  -- Americano 18000
  v_shift   uuid;
  v_tx1     uuid := gen_random_uuid();
  v_tx2     uuid := gen_random_uuid();
  v_items   jsonb;
  v_stok_awal integer;
  v_stok      integer;
  v_num1    text;
  v_num1b   text;
  v_num2    text;
  v_total   numeric;
  v_n       integer;
begin
  -- Fixture: pastikan ada shift terbuka.
  select id into v_shift from shifts
   where kedai_id = v_kedai and status = 'open' limit 1;

  if v_shift is null then
    insert into shifts (kedai_id, business_date, opened_by, opening_cash)
    values (v_kedai, current_date, v_emp, 0)
    returning id into v_shift;
  end if;

  select quantity into v_stok_awal
    from kedai_stock where kedai_id = v_kedai and product_id = v_prod;

  v_items := jsonb_build_array(
    jsonb_build_object('product_id', v_prod,  'name', 'Kopi Susu Gula Aren', 'price', 22000, 'qty', 2),
    jsonb_build_object('product_id', v_prod2, 'name', 'Americano',           'price', 18000, 'qty', 1)
  );

  -- === 1. Transaksi pertama tersimpan ============================
  select t.transaction_number, t.total into v_num1, v_total
  from create_transaction(v_tx1, v_kedai, v_shift, v_emp, 'OFF-TEST-0001',
                          'dev-device', 'tunai', now(), v_items) t;

  insert into hasil values (1, 'Transaksi tersimpan', 'ada nomor', coalesce(v_num1, 'NULL'), v_num1 is not null);

  -- === 2. Total dihitung server: 22000*2 + 18000 = 62000 =========
  insert into hasil values (2, 'Total dihitung server', '62000', v_total::text, v_total = 62000);

  -- === 3. Item tersimpan lengkap =================================
  select count(*) into v_n from transaction_items where transaction_id = v_tx1;
  insert into hasil values (3, 'Jumlah item', '2', v_n::text, v_n = 2);

  -- === 4. Stok berkurang sesuai qty ==============================
  select quantity into v_stok
    from kedai_stock where kedai_id = v_kedai and product_id = v_prod;
  insert into hasil values (4, 'Stok berkurang 2', (v_stok_awal - 2)::text, v_stok::text,
                            v_stok = v_stok_awal - 2);

  -- === 5. Ledger tercatat ========================================
  select count(*) into v_n from stock_movements
   where ref_transaction_id = v_tx1 and reason = 'sale';
  insert into hasil values (5, 'Baris ledger sale', '2', v_n::text, v_n = 2);

  -- === 6. balance_after cocok dengan saldo =======================
  select balance_after into v_n from stock_movements
   where ref_transaction_id = v_tx1 and product_id = v_prod;
  insert into hasil values (6, 'balance_after cocok', v_stok::text, v_n::text, v_n = v_stok);

  -- === 7. IDEMPOTEN: kirim ulang id yang sama ====================
  -- Ini yang menjaga antrian offline di M2. Kalau gagal, retry sync akan
  -- menggandakan penjualan dan mengurangi stok dua kali.
  select t.transaction_number into v_num1b
  from create_transaction(v_tx1, v_kedai, v_shift, v_emp, 'OFF-TEST-0001',
                          'dev-device', 'tunai', now(), v_items) t;

  insert into hasil values (7, 'Kirim ulang: nomor sama', v_num1, coalesce(v_num1b, 'NULL'), v_num1b = v_num1);

  select quantity into v_n
    from kedai_stock where kedai_id = v_kedai and product_id = v_prod;
  insert into hasil values (8, 'Kirim ulang: stok TIDAK berkurang lagi', v_stok::text, v_n::text, v_n = v_stok);

  select count(*) into v_n from transaction_items where transaction_id = v_tx1;
  insert into hasil values (9, 'Kirim ulang: item tidak dobel', '2', v_n::text, v_n = 2);

  -- === 10. Transaksi kedua dapat nomor berikutnya ================
  select t.transaction_number into v_num2
  from create_transaction(v_tx2, v_kedai, v_shift, v_emp, 'OFF-TEST-0002',
                          'dev-device', 'tunai', now(), v_items) t;

  insert into hasil values (10, 'Nomor urut naik', (v_num1::int + 1)::text, v_num2,
                            v_num2::int = v_num1::int + 1);

  -- === 11. Transaksi tanpa item ditolak ==========================
  begin
    perform create_transaction(gen_random_uuid(), v_kedai, v_shift, v_emp, 'OFF-X',
                               'dev-device', 'tunai', now(), '[]'::jsonb);
    insert into hasil values (11, 'Transaksi tanpa item', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (11, 'Transaksi tanpa item', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 12. Kedai tidak dikenal ditolak ===========================
  begin
    perform create_transaction(gen_random_uuid(),
                               '00000000-0000-4000-8000-000000000000', v_shift, v_emp,
                               'OFF-Y', 'dev-device', 'tunai', now(), v_items);
    insert into hasil values (12, 'Kedai tidak dikenal', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (12, 'Kedai tidak dikenal', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;
end $$;

select no, uji, harapan, hasil, lulus from hasil order by no;

select
  count(*) filter (where lulus)     as lulus,
  count(*) filter (where not lulus) as gagal,
  count(*)                          as total
from hasil;

rollback;
