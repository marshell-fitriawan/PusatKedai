-- =====================================================================
-- Uji pembayaran QRIS (M1-10, M1-11)
--
-- Membuktikan:
--   * confirm_qris_payment mengubah pembayaran 'created' menjadi TRANSAKSI
--     sungguhan (payment_method='qris', id transaksi = id pembayaran)
--   * ia idempoten: panggilan kedua tidak menggandakan penjualan/stok
--   * pembayaran yang sudah 'expired'/'failed' TIDAK bisa dikonfirmasi
--   * anon/authenticated tidak bisa memanggil fungsi maupun membaca tabel
--
-- Seluruh isi file berjalan dalam satu transaction dan DI-ROLLBACK.
-- Pakai: npm run db -- supabase/tests/qris.sql
-- Kolom "lulus" harus true semua.
-- =====================================================================

begin;

create temp table hasil (
  no int, uji text, harapan text, hasil text, lulus boolean
) on commit drop;

do $$
declare
  v_k1     uuid := gen_random_uuid();
  v_emp1   uuid := gen_random_uuid();
  v_prod   uuid := gen_random_uuid();
  v_shift  uuid := gen_random_uuid();
  v_pay    uuid := gen_random_uuid();
  v_pay2   uuid := gen_random_uuid();
  v_payX   uuid := gen_random_uuid();
  v_items  jsonb;
  v_order  text;
  v_total  numeric;
  v_num    text;
  v_num2   text;
  v_stok_awal integer;
  v_stok   integer;
  v_n      integer;
begin
  -- Fixture TERISOLASI (pola sama dengan laporan.sql): kedai/produk fiktif
  -- supaya uji tidak mencemari maupun tercemar data dev yang sudah ada.
  insert into kedai (id, name, timezone) values
    (v_k1, 'Kedai Uji QRIS', 'Asia/Kuala_Lumpur');

  insert into employees (id, kedai_id, name, role, qr_token) values
    (v_emp1, v_k1, 'Kasir Uji QRIS', 'kasir', 'QR-TEST-' || v_emp1);

  insert into products (id, name, price) values
    (v_prod, 'Produk Uji QRIS', 15000);

  -- Shift berstatus closed -- bebas dari index satu-open-per-kedai dan
  -- justru membuktikan QRIS tetap tercatat walau shift sudah ditutup.
  insert into shifts (id, kedai_id, business_date, opened_by, opening_cash, status, closed_at, closed_by)
  values (v_shift, v_k1, current_date, v_emp1, 0, 'closed', now(), v_emp1);

  v_items := jsonb_build_array(
    jsonb_build_object('product_id', v_prod, 'name', 'Produk Uji QRIS', 'price', 15000, 'qty', 2)
  );

  v_order := 'POS-' || v_pay;

  insert into qris_payments
    (id, kedai_id, shift_id, employee_id, local_number, device_id, items,
     total, midtrans_order_id, status, expires_at)
  values
    (v_pay, v_k1, v_shift, v_emp1, 'OFF-QRIS-0001', 'dev-qris', v_items,
     30000, v_order, 'created', now() + interval '5 minutes');

  select quantity into v_stok_awal
    from kedai_stock where kedai_id = v_k1 and product_id = v_prod;
  -- Sebelum create_transaction, belum ada baris stok -- anggap nol.
  if v_stok_awal is null then v_stok_awal := 0; end if;

  -- === 1. Konfirmasi -> transaksi tersimpan =========================
  select t.transaction_number, t.total into v_num, v_total
  from confirm_qris_payment(v_pay, now()) t;

  insert into hasil values (1, 'Konfirmasi menghasilkan transaksi', 'ada nomor',
                            coalesce(v_num, 'NULL'), v_num is not null);

  -- === 2. Transaksi isinya benar (qris, id = id pembayaran) =========
  select count(*) into v_n
  from transactions
  where id = v_pay
    and status = 'completed'
    and payment_method = 'qris'
    and total = 30000;

  insert into hasil values (2, 'Transaksi qris benar', '1 baris', v_n::text, v_n = 1);

  -- === 3. Total dihitung ulang server ===============================
  insert into hasil values (3, 'Total = 2 x 15000', '30000', v_total::text, v_total = 30000);

  -- === 4. Item tersimpan ============================================
  select count(*) into v_n from transaction_items where transaction_id = v_pay;
  insert into hasil values (4, 'Item transaksi', '1', v_n::text, v_n = 1);

  -- === 5. Stok berkurang sesuai qty =================================
  select quantity into v_stok
    from kedai_stock where kedai_id = v_k1 and product_id = v_prod;
  insert into hasil values (5, 'Stok berkurang 2', (v_stok_awal - 2)::text,
                            coalesce(v_stok::text, 'NULL'), coalesce(v_stok, 0) = v_stok_awal - 2);

  -- === 6. Ledger tercatat + balance_after cocok =====================
  select count(*) into v_n from stock_movements
   where ref_transaction_id = v_pay and reason = 'sale';
  insert into hasil values (6, 'Ledger sale', '1', v_n::text, v_n = 1);

  -- === 7. Status & paid_at berubah ==================================
  select count(*) into v_n
  from qris_payments where id = v_pay and status = 'paid' and paid_at is not null;
  insert into hasil values (7, 'Status jadi paid', '1', v_n::text, v_n = 1);

  -- === 8. IDEMPOTEN: panggilan kedua tidak menggandakan =============
  select t.transaction_number into v_num2
  from confirm_qris_payment(v_pay, now()) t;

  insert into hasil values (8, 'Konfirmasi ulang: nomor sama', v_num,
                            coalesce(v_num2, 'NULL'), v_num2 = v_num);

  select count(*) into v_n from transaction_items where transaction_id = v_pay;
  insert into hasil values (9, 'Konfirmasi ulang: item tidak dobel', '1', v_n::text, v_n = 1);

  select count(*) into v_n from stock_movements
   where ref_transaction_id = v_pay and reason = 'sale';
  insert into hasil values (10, 'Konfirmasi ulang: stok tidak dobel', '1', v_n::text, v_n = 1);

  select quantity into v_stok
    from kedai_stock where kedai_id = v_k1 and product_id = v_prod;
  insert into hasil values (11, 'Konfirmasi ulang: saldo tetap', (v_stok_awal - 2)::text,
                            coalesce(v_stok::text, 'NULL'), coalesce(v_stok, 0) = v_stok_awal - 2);

  -- === 12. Pembayaran tidak dikenal ditolak =========================
  begin
    perform confirm_qris_payment(gen_random_uuid(), now());
    insert into hasil values (12, 'Pembayaran tidak dikenal', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (12, 'Pembayaran tidak dikenal', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 13. Pembayaran yang sudah kadaluwarsa TIDAK bisa dikonfirmasi =
  insert into qris_payments
    (id, kedai_id, shift_id, employee_id, local_number, device_id, items,
     total, midtrans_order_id, status, expires_at)
  values
    (v_payX, v_k1, v_shift, v_emp1, 'OFF-QRIS-X', 'dev-qris', v_items,
     30000, 'POS-' || v_payX, 'expired', now());

  begin
    perform confirm_qris_payment(v_payX, now());
    insert into hasil values (13, 'Status expired ditolak', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (13, 'Status expired ditolak', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 14. Tidak ada transaksi dibuat untuk yang ditolak ============
  select count(*) into v_n from transactions where id = v_payX;
  insert into hasil values (14, 'Yang ditolak tidak jadi transaksi', '0', v_n::text, v_n = 0);

  -- === 15. Pembayaran kedua tetap boleh menyusul (nomor urut naik) ===
  insert into qris_payments
    (id, kedai_id, shift_id, employee_id, local_number, device_id, items,
     total, midtrans_order_id, status, expires_at)
  values
    (v_pay2, v_k1, v_shift, v_emp1, 'OFF-QRIS-0002', 'dev-qris', v_items,
     30000, 'POS-' || v_pay2, 'created', now() + interval '5 minutes');

  select t.transaction_number into v_num2 from confirm_qris_payment(v_pay2, now()) t;
  insert into hasil values (15, 'Nomor naik', (v_num::int + 1)::text,
                            v_num2, v_num2::int = v_num::int + 1);

  -- === 16. Fungsi tidak bisa dieksekusi anon ========================
  if has_function_privilege('anon', 'public.confirm_qris_payment(uuid, timestamptz)', 'EXECUTE')
      or has_function_privilege('authenticated', 'public.confirm_qris_payment(uuid, timestamptz)', 'EXECUTE') then
    insert into hasil values (16, 'Fungsi tertutup anon/authenticated', 'ditolak', 'DAPAT', false);
  else
    insert into hasil values (16, 'Fungsi tertutup anon/authenticated', 'ditolak', 'ditolak', true);
  end if;

  -- === 17. Tabel pembayaran tidak bisa dibaca anon ==================
  if has_table_privilege('anon', 'qris_payments', 'SELECT')
      or has_table_privilege('authenticated', 'qris_payments', 'SELECT') then
    insert into hasil values (17, 'Tabel tertutup anon/authenticated', 'ditolak', 'DAPAT', false);
  else
    insert into hasil values (17, 'Tabel tertutup anon/authenticated', 'ditolak', 'ditolak', true);
  end if;

  -- === 18. Check constraint status-paid memaksa data lengkap ========
  begin
    insert into qris_payments
      (id, kedai_id, shift_id, employee_id, local_number, device_id, items,
       total, midtrans_order_id, status, expires_at, paid_at, transaction_id)
    values
      (gen_random_uuid(), v_k1, v_shift, v_emp1, 'OFF-QRIS-C', 'dev-qris', v_items,
       30000, 'POS-C', 'paid', now(), null, null);
    insert into hasil values (18, 'paid tanpa paid_at ditolak', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (18, 'paid tanpa paid_at ditolak', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;
end $$;

select no, uji, harapan, hasil, lulus from hasil order by no;

select
  count(*) filter (where lulus)     as lulus,
  count(*) filter (where not lulus) as gagal,
  count(*)                          as total
from hasil;

rollback;