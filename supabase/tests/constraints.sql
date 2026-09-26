-- =====================================================================
-- Uji constraint level database (M0-6b)
--
-- Membuktikan bahwa keputusan skema di docs/Database.md benar-benar
-- ditegakkan database, bukan sekadar niat di dokumen. Kalau salah satu uji
-- di bawah gagal, ada lubang yang cepat atau lambat menghasilkan data rusak
-- -- dan di sistem kasir itu berarti selisih uang.
--
-- Seluruh isi file berjalan di dalam satu transaction dan DI-ROLLBACK, jadi
-- aman dijalankan kapan saja terhadap database ber-seed. Tidak ada data yang
-- berubah.
--
-- Pakai: npm run db -- supabase/tests/constraints.sql
-- Kolom "lulus" harus true semua.
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
  v_kedai1 uuid := '11111111-1111-4111-8111-000000000001';
  v_kedai2 uuid := '11111111-1111-4111-8111-000000000002';
  v_emp1   uuid := '22222222-2222-4222-8222-000000000001';
  v_emp3   uuid := '22222222-2222-4222-8222-000000000003';
  v_prod    uuid := '33333333-3333-4333-8333-000000000001';
  v_admin   uuid;
  v_shift   uuid := gen_random_uuid();
  v_tx      uuid := gen_random_uuid();
  v_mut     uuid := gen_random_uuid();
  v_wh      uuid := gen_random_uuid();
  v_bahan1  uuid := gen_random_uuid();
  v_bahan2  uuid := gen_random_uuid();
  v_bahan3  uuid := gen_random_uuid();
  v_bahan4  uuid := gen_random_uuid();
  v_masuk   uuid := gen_random_uuid();
  v_produksi uuid := gen_random_uuid();
  v_produksi_tx uuid := gen_random_uuid();
  r         record;
  rp        record;
  v_q1      integer;
  v_q2      integer;
  v_q3      integer;
  v_wq      integer;
  v_wh_aktif uuid;
begin
  select id into v_admin from admin_users limit 1;

  -- ---------------------------------------------------------- fixture
  -- Kedai/karyawan/produk fixture milik uji (id tetap) supaya file ini tidak
  -- bergantung pada seed dev mana pun -- `npm run seed` dan `seed:minggu`
  -- memakai UUID yang berbeda. `on conflict do nothing` membuatnya aman
  -- dijalankan di database yang sudah berisi seed lama.
  insert into kedai (id, name, timezone) values
    (v_kedai1, 'Kedai Uji Constraint 1', 'Asia/Kuala_Lumpur'),
    (v_kedai2, 'Kedai Uji Constraint 2', 'Asia/Kuala_Lumpur')
  on conflict (id) do nothing;

  insert into employees (id, kedai_id, name, role, qr_token) values
    (v_emp1, v_kedai1, 'Kasir Uji Constraint 1', 'kasir', 'TEST-QR-CONSTRAINT-0001'),
    (v_emp3, v_kedai2, 'Kasir Uji Constraint 3', 'kasir', 'TEST-QR-CONSTRAINT-0003')
  on conflict (id) do nothing;

  insert into products (id, name, price) values
    (v_prod, 'Produk Uji Constraint', 10)
  on conflict (id) do nothing;

  -- Sel stok awal untuk (v_kedai1, v_prod): test 17 menguji bahwa duplikat
  -- sel ditolak, jadi sel pertama harus sudah ada.
  insert into kedai_stock (kedai_id, product_id, quantity)
  values (v_kedai1, v_prod, 40)
  on conflict (kedai_id, product_id) do nothing;


  -- Tutup shift terbuka dari pengujian/dev (di-rollback bersama transaction
  -- ini) supaya insert shift fixture di bawah tidak melanggar
  -- shifts_one_open_per_kedai.
  update shifts
  set status            = 'closed',
      closed_at         = now(),
      closed_by         = v_emp1,
      closing_cash      = opening_cash,
      expected_cash     = opening_cash,
      cash_difference   = 0
  where kedai_id in (v_kedai1, v_kedai2) and status = 'open';

  insert into shifts (id, kedai_id, business_date, opened_by, opening_cash)
  values (v_shift, v_kedai1, current_date, v_emp1, 500000);

  insert into transactions
    (id, kedai_id, shift_id, employee_id, business_date, local_number,
     subtotal, total, payment_method, device_id, created_at)
  values
    (v_tx, v_kedai1, v_shift, v_emp1, current_date, 'OFF-TEST-0001',
     22000, 22000, 'tunai', 'dev-device', now());

  insert into stock_mutations
    (id, from_kedai_id, to_kedai_id, product_id, quantity, status,
     requested_by_employee_id, approved_by, approved_at)
  values
    (v_mut, v_kedai1, v_kedai2, v_prod, 5, 'approved', v_emp1, v_admin, now());

  -- Fixture M6 (stok dua lapis): gudang pusat + 2 bahan berisi 10 masing-masing
  insert into kedai (id, name, address, is_warehouse)
  values (v_wh, 'Gudang Pusat', 'Pusat', true);

  insert into bahan_mentah (id, name, satuan)
  values (v_bahan1, 'Gula Pasir', 'kg'), (v_bahan2, 'Biji Kopi', 'gram'),
         (v_bahan3, 'Coklat Bubuk', 'gram'), (v_bahan4, 'Susu', 'liter');

  insert into bahan_stock (bahan_id, quantity)
  values (v_bahan1, 10), (v_bahan2, 10), (v_bahan3, 10), (v_bahan4, 10);

  -- === 1. Dua shift terbuka di kedai yang sama ===================
  begin
    insert into shifts (kedai_id, business_date, opened_by, opening_cash)
    values (v_kedai1, current_date, v_emp1, 100000);
    insert into hasil values (1, 'Dua shift open di kedai sama', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (1, 'Dua shift open di kedai sama', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 2. Shift terbuka di kedai berbeda (HARUS boleh) ===========
  begin
    insert into shifts (kedai_id, business_date, opened_by, opening_cash)
    values (v_kedai2, current_date, v_emp3, 100000);
    insert into hasil values (2, 'Shift open di kedai berbeda', 'diterima', 'diterima', true);
  exception when others then
    insert into hasil values (2, 'Shift open di kedai berbeda', 'diterima', 'DITOLAK (' || sqlstate || ')', false);
  end;

  -- === 3. Shift closed tanpa closed_at/closed_by =================
  begin
    update shifts set status = 'closed' where id = v_shift;
    insert into hasil values (3, 'Shift closed tanpa jejak penutup', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (3, 'Shift closed tanpa jejak penutup', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 4. Mutasi tanpa pengaju ===================================
  begin
    insert into stock_mutations (from_kedai_id, to_kedai_id, product_id, quantity)
    values (v_kedai1, v_kedai2, v_prod, 3);
    insert into hasil values (4, 'Mutasi tanpa pengaju', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (4, 'Mutasi tanpa pengaju', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 5. Mutasi dengan dua pengaju sekaligus ====================
  begin
    insert into stock_mutations
      (from_kedai_id, to_kedai_id, product_id, quantity,
       requested_by_employee_id, requested_by_admin_id)
    values (v_kedai1, v_kedai2, v_prod, 3, v_emp1, v_admin);
    insert into hasil values (5, 'Mutasi dengan dua pengaju', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (5, 'Mutasi dengan dua pengaju', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 6. Mutasi dari dan ke kedai yang sama =====================
  begin
    insert into stock_mutations
      (from_kedai_id, to_kedai_id, product_id, quantity, requested_by_employee_id)
    values (v_kedai1, v_kedai1, v_prod, 3, v_emp1);
    insert into hasil values (6, 'Mutasi ke kedai sendiri', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (6, 'Mutasi ke kedai sendiri', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 7. Mutasi ditolak tanpa alasan ============================
  begin
    insert into stock_mutations
      (from_kedai_id, to_kedai_id, product_id, quantity, requested_by_employee_id, status)
    values (v_kedai1, v_kedai2, v_prod, 3, v_emp1, 'rejected');
    insert into hasil values (7, 'Mutasi rejected tanpa catatan', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (7, 'Mutasi rejected tanpa catatan', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 8. Movement sale dobel untuk transaksi yang sama ==========
  -- Ini penjaga idempotensi sync. Kalau lolos, retry pengiriman antrian
  -- offline akan mengurangi stok dua kali.
  begin
    insert into stock_movements (kedai_id, product_id, delta, balance_after, reason, ref_transaction_id)
    values (v_kedai1, v_prod, -1, 39, 'sale', v_tx);
    insert into stock_movements (kedai_id, product_id, delta, balance_after, reason, ref_transaction_id)
    values (v_kedai1, v_prod, -1, 38, 'sale', v_tx);
    insert into hasil values (8, 'Movement sale dobel (idempotensi sync)', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (8, 'Movement sale dobel (idempotensi sync)', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 9. Movement mutation dobel ================================
  -- Penjaga idempotensi approval: approve dua kali tidak boleh memindahkan
  -- stok dua kali.
  begin
    insert into stock_movements (kedai_id, product_id, delta, balance_after, reason, ref_mutation_id)
    values (v_kedai1, v_prod, -5, 35, 'mutation_out', v_mut);
    insert into stock_movements (kedai_id, product_id, delta, balance_after, reason, ref_mutation_id)
    values (v_kedai1, v_prod, -5, 30, 'mutation_out', v_mut);
    insert into hasil values (9, 'Movement mutation dobel (approve ganda)', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (9, 'Movement mutation dobel (approve ganda)', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 10. Movement sale tanpa referensi transaksi ===============
  begin
    insert into stock_movements (kedai_id, product_id, delta, balance_after, reason)
    values (v_kedai1, v_prod, -1, 39, 'sale');
    insert into hasil values (10, 'Movement sale tanpa ref transaksi', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (10, 'Movement sale tanpa ref transaksi', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 11. Movement adjustment tanpa alasan ======================
  begin
    insert into stock_movements (kedai_id, product_id, delta, balance_after, reason)
    values (v_kedai1, v_prod, -2, 38, 'adjustment');
    insert into hasil values (11, 'Adjustment tanpa alasan', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (11, 'Adjustment tanpa alasan', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 12. Movement dengan delta nol =============================
  begin
    insert into stock_movements (kedai_id, product_id, delta, balance_after, reason, note)
    values (v_kedai1, v_prod, 0, 40, 'adjustment', 'tidak mengubah apa pun');
    insert into hasil values (12, 'Movement delta nol', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (12, 'Movement delta nol', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 13. Pengeluaran tanpa pencatat ============================
  begin
    insert into expenses (kedai_id, category, description, amount, expense_date)
    values (v_kedai1, 'listrik', 'tanpa pencatat', 50000, current_date);
    insert into hasil values (13, 'Pengeluaran tanpa pencatat', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (13, 'Pengeluaran tanpa pencatat', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 14. Nomor transaksi dobel per kedai per hari ==============
  begin
    update transactions set transaction_number = '1' where id = v_tx;
    insert into transactions
      (id, kedai_id, shift_id, employee_id, business_date, local_number,
       transaction_number, subtotal, total, payment_method, device_id, created_at)
    values
      (gen_random_uuid(), v_kedai1, v_shift, v_emp1, current_date, 'OFF-TEST-0002',
       '1', 18000, 18000, 'tunai', 'dev-device-2', now());
    insert into hasil values (14, 'Nomor transaksi dobel per kedai/hari', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (14, 'Nomor transaksi dobel per kedai/hari', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 15. Item transaksi dengan qty nol =========================
  begin
    insert into transaction_items
      (id, transaction_id, product_id, product_name_snapshot, price_snapshot, qty, subtotal)
    values (gen_random_uuid(), v_tx, v_prod, 'Kopi Susu Gula Aren', 22000, 0, 0);
    insert into hasil values (15, 'Item transaksi qty nol', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (15, 'Item transaksi qty nol', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 17. Stok duplikat untuk kedai+produk sama =================
  begin
    insert into kedai_stock (kedai_id, product_id, quantity)
    values (v_kedai1, v_prod, 99);
    insert into hasil values (17, 'Stok duplikat kedai+produk', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (17, 'Stok duplikat kedai+produk', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 18. Stok negatif (HARUS boleh -- keputusan MVP) ===========
  -- Kasir bisa offline dengan cache stok basi. Memblokir penjualan lebih
  -- merugikan daripada stok tercatat minus.
  begin
    update kedai_stock set quantity = -5
    where kedai_id = v_kedai1 and product_id = v_prod;
    insert into hasil values (18, 'Stok negatif diizinkan', 'diterima', 'diterima', true);
  exception when others then
    insert into hasil values (18, 'Stok negatif diizinkan', 'diterima', 'DITOLAK (' || sqlstate || ')', false);
  end;

  -- === 19. Movement produksi tanpa ref produksi ==================
  begin
    insert into stock_movements (kedai_id, product_id, delta, balance_after, reason)
    values (v_wh, v_prod, 1, 41, 'produksi');
    insert into hasil values (19, 'Movement produksi tanpa ref produksi', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (19, 'Movement produksi tanpa ref produksi', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 20. Movement produksi dobel untuk produksi sama ===========
  -- Penjaga idempotensi record_produksi: tidak boleh menambah stok dua kali.
  begin
    insert into produksi (id, product_id, qty_hasil, produced_by_admin_id)
    values (v_produksi_tx, v_prod, 5, v_admin);
    insert into stock_movements (kedai_id, product_id, delta, balance_after, reason, ref_produksi_id, created_by_admin_id)
    values (v_wh, v_prod, 5, 46, 'produksi', v_produksi_tx, v_admin);
    insert into stock_movements (kedai_id, product_id, delta, balance_after, reason, ref_produksi_id, created_by_admin_id)
    values (v_wh, v_prod, 5, 51, 'produksi', v_produksi_tx, v_admin);
    insert into hasil values (20, 'Movement produksi dobel (idempotensi produksi)', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (20, 'Movement produksi dobel (idempotensi produksi)', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 21. Movement bahan produksi tanpa ref produksi ============
  begin
    insert into bahan_movement (bahan_id, delta, balance_after, reason, created_by_admin_id)
    values (v_bahan1, -2, 8, 'produksi', v_admin);
    insert into hasil values (21, 'Movement bahan produksi tanpa ref', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (21, 'Movement bahan produksi tanpa ref', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 22. Koreksi stok bahan tanpa alasan =======================
  begin
    insert into bahan_movement (bahan_id, delta, balance_after, reason, created_by_admin_id)
    values (v_bahan1, -2, 8, 'koreksi', v_admin);
    insert into hasil values (22, 'Koreksi bahan tanpa alasan', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (22, 'Koreksi bahan tanpa alasan', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 23. record_bahan_movement idempoten (retry tidak ganda) ===
  select * into r from public.record_bahan_movement(
    v_masuk, v_bahan1, 5, 'masuk', 'Stok awal bungkusan baru', v_admin);
  select * into r from public.record_bahan_movement(
    v_masuk, v_bahan1, 5, 'masuk', 'Stok awal bungkusan baru', v_admin);
  select count(*) into v_wq from bahan_movement where id = v_masuk;
  begin
    if v_wq = 1 then
      insert into hasil values (23, 'record_bahan_movement retry idempoten', 'diterima', 'diterima', true);
    else
      insert into hasil values (23, 'record_bahan_movement retry idempoten', 'diterima', 'duplikat ' || v_wq || 'x', false);
    end if;
  exception when others then
    insert into hasil values (23, 'record_bahan_movement retry idempoten', 'diterima', 'ERROR ' || sqlstate, false);
  end;

  -- === 24. record_produksi: bahan -qty, hasil masuk gudang =======
  -- Idempotensi: panggil dua kali, hasil sama, bahan tidak digigit dua kali.
  -- Bahan khusus (v_bahan3/4) supaya bersih dari test 23 yang menambah bahan1.
  begin
    -- Baseline stok gudang SEBELUM produksi; hasil harus naik tepat +5.
    -- record_produksi memakai gudang PERTAMA yang diaktifkan (created_at asc);
    -- di DB ber-seed itu Gudang Pusat, bukan v_wh.
    select k.id into v_wh_aktif
    from kedai k
    where k.is_warehouse
    order by k.created_at
    limit 1;

    -- select into DO berbaris-satu meletakkan NULL saat nol baris, makanya
    -- baseline diambil lewat subquery ber-coalesce (sel gudang mungkin belum ada).
    select coalesce((
      select quantity
      from kedai_stock
      where kedai_id = v_wh_aktif and product_id = v_prod
    ), 0) into v_wq;

    select * into rp from public.record_produksi(
      v_produksi, v_prod, 5,
      array[v_bahan3, v_bahan4], array[3, 2],
      v_admin, 'Produksi racikan reguler');
    select * into rp from public.record_produksi(
      v_produksi, v_prod, 5,
      array[v_bahan3, v_bahan4], array[3, 2],
      v_admin, 'Produksi racikan reguler');
    select quantity into v_q1 from bahan_stock where bahan_id = v_bahan3;
    select quantity into v_q2 from bahan_stock where bahan_id = v_bahan4;
    select quantity into v_q3 from kedai_stock
    where kedai_id = v_wh_aktif and product_id = v_prod;
    if rp.qty_hasil = 5 and v_q1 = 7 and v_q2 = 8 and v_q3 = v_wq + 5 then
      insert into hasil values (24, 'record_produksi saldo & idempotensi', 'diterima', 'diterima', true);
    else
      insert into hasil values (24, 'record_produksi saldo & idempotensi', 'diterima',
        'q=' || coalesce(rp.qty_hasil::text, 'NULL') ||
        ' b3=' || coalesce(v_q1::text, 'NULL') ||
        ' b4=' || coalesce(v_q2::text, 'NULL') ||
        ' gudang=' || coalesce(v_q3::text, 'NULL') ||
        ' (baseline=' || coalesce(v_wq::text, 'NULL') || ')', false);
    end if;
  exception when others then
    insert into hasil values (24, 'record_produksi saldo & idempotensi', 'diterima', 'ERROR ' || sqlstate, false);
  end;

  -- === 25. record_produksi stok bahan tidak cukup ================
  begin
    select * into rp from public.record_produksi(
      gen_random_uuid(), v_prod, 5,
      array[v_bahan1, v_bahan2], array[3, 99],
      v_admin, 'harus ditolak');
    insert into hasil values (25, 'Produksi bahan tidak cukup', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (25, 'Produksi bahan tidak cukup', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

-- === 26. record_produksi tanpa gudang pusat ====================
  begin
    -- Matikan SEMUA gudang (seed Gudang Pusat + v_wh) -- kalau masih ada satu
    -- yang aktif, produksi tetap berjalan dan panggilan ini salah diterima.
    update kedai set is_warehouse = false where is_warehouse;
    select * into rp from public.record_produksi(
      gen_random_uuid(), v_prod, 5,
      array[v_bahan1], array[1],
      v_admin, 'harus ditolak');
    insert into hasil values (26, 'Produksi tanpa gudang pusat', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (26, 'Produksi tanpa gudang pusat', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 27. record_waste idempoten + saldo turun sekali ============
  -- Stok dibuat sendiri (5) karena test 24 menulis ke gudang seed, bukan
  -- v_wh. Waste 2 -> sisa 3, panggil ulang id sama tidak memotong lagi.
  update kedai set is_warehouse = true where id = v_wh;
  insert into kedai_stock (kedai_id, product_id, quantity)
  values (v_wh, v_prod, 5);
  begin
    declare
      v_waste uuid := gen_random_uuid();
      v_tercatat integer;
      v_mov integer;
      v_saldo integer;
    begin
      select * into r from public.record_waste(
        v_waste, v_wh, null, v_prod, 2, 'Gelas pecah saat penyajian', v_emp1);
      select * into r from public.record_waste(
        v_waste, v_wh, null, v_prod, 2, 'Gelas pecah saat penyajian', v_emp1);
      select count(*) into v_tercatat from waste where id = v_waste;
      select count(*) into v_mov from stock_movements where ref_waste_id = v_waste;
      select quantity into v_saldo from kedai_stock where kedai_id = v_wh and product_id = v_prod;
      if v_tercatat = 1 and v_mov = 1 and v_saldo = 3 then
        insert into hasil values (27, 'record_waste retry idempoten & saldo', 'diterima', 'diterima', true);
      else
        insert into hasil values (27, 'record_waste retry idempoten & saldo', 'diterima',
          'waste=' || v_tercatat || ' mov=' || v_mov || ' saldo=' || v_saldo, false);
      end if;
    exception when others then
      insert into hasil values (27, 'record_waste retry idempoten & saldo', 'diterima', 'ERROR ' || sqlstate, false);
    end;
  end;

  -- === 28. Waste tanpa alasan ====================================
  begin
    perform public.record_waste(
      gen_random_uuid(), v_wh, null, v_prod, 1, '  ', v_emp1);
    insert into hasil values (28, 'Waste alasan kosong', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (28, 'Waste alasan kosong', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 29. Waste melebihi stok ==================================
  begin
    perform public.record_waste(
      gen_random_uuid(), v_wh, null, v_prod, 999, 'Rusak semua', v_emp1);
    insert into hasil values (29, 'Waste melebihi stok', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (29, 'Waste melebihi stok', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 30. Movement waste tanpa ref waste ========================
  begin
    insert into stock_movements (kedai_id, product_id, delta, balance_after, reason, created_by_employee_id)
    values (v_wh, v_prod, -1, 2, 'waste', v_emp1);
    insert into hasil values (30, 'Movement waste tanpa ref waste', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (30, 'Movement waste tanpa ref waste', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

  -- === 31. Sisa fisik dobel (shift, produk) ======================
  begin
    insert into sisa_fisik (shift_id, product_id, quantity)
    values (v_shift, v_prod, 9);
    insert into sisa_fisik (shift_id, product_id, quantity)
    values (v_shift, v_prod, 8);
    insert into hasil values (31, 'Sisa fisik dobel per shift-produk', 'ditolak', 'DITERIMA', false);
  exception when others then
    insert into hasil values (31, 'Sisa fisik dobel per shift-produk', 'ditolak', 'ditolak (' || sqlstate || ')', true);
  end;

end $$;

select no, uji, harapan, hasil, lulus from hasil order by no;

select
  count(*) filter (where lulus)       as lulus,
  count(*) filter (where not lulus)   as gagal,
  count(*)                            as total
from hasil;

rollback;
