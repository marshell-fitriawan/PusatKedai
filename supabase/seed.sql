-- =====================================================================
-- Seed data pengembangan = data siap demo
--
-- !! MENGHAPUS SELURUH DATA OPERASIONAL !!
-- Hanya untuk database development. Jangan pernah dijalankan di instance
-- klien. Script pemanggilnya (scripts/seed.mjs) menolak jalan kalau
-- tabel transactions sudah berisi data, kecuali dipaksa dengan --force.
--
-- Baris admin_users mengambil id dari auth.users berdasarkan email, jadi
-- user Supabase Auth harus dibuat lebih dulu (dilakukan scripts/seed.mjs).
--
-- Kenapa seed ini banyak sekali isinya
-- ---------------------------------
-- Seed ini bukan cuma data master. Isinya disusun mengikuti alur demo di
-- docs/demo-klien.md, supaya setiap bagian demo punya isi tanpa perlu
-- menyiapkan apa pun di depan klien:
--
--   Bagian 3 (Dashboard, perbandingan)  -> 14 hari transaksi + setoran
--   Bagian 4 (Perlu Perhatian)          -> selisih kas yang belum
--                                          dibereskan, perangkat yang
--                                          belum sinkron, pengajuan
--                                          pembatalan & mutasi menunggu
--   Bagian 5 (Data master)              -> katalog, bahan, produksi
--   Bagian 7 (Stok menipis)             -> Pisang Goreng sengaja 3
--   Bagian 9 (Tutup toko)               -> riwayat hitung fisik
--   Bagian 10 (Pindah stok)             -> riwayat mutasi + 1 antrean
--   Bagian 11 (Laporan, laba-rugi)      -> pengeluaran sepanjang 14 hari
--
-- Yang SENGAJA tidak ada:
--
--   * Shift terbuka di Kedai Melati hari ini. Demo memintakan kasir
--     membuka toko sendiri (Bagian 6), dan database hanya mengizinkan satu
--     shift terbuka per kedai. Kalau di-seed, tombol "Buka Toko" akan
--     ditolak dan demo berhenti di tengah jalan.
--   * Transaksi QRIS. Klien pertama belum butuh pembayaran nontunai, jadi
--     tidak ada satu pun baris QRIS di sini. Laporan dan riwayat POS hanya
--     boleh berisi pembayaran tunai.
--
-- Semua pergerakan stok, produksi, waste, dan mutasi lewat fungsi resmi
-- (create_transaction, close_shift, reconcile_shift, record_produksi,
-- record_bahan_movement, record_waste, adjust_stock, approve_mutation,
-- request_void, decide_void). Kalau seed mengarang saldo sendiri, ledger
-- dan saldo jadi tidak bisa dipercaya persis di baris pertama.
--
-- Angka historis TIDAK memakai random(). Demo diulang di depan beberapa
-- klien, dan setiap seed ulang harus menghasilkan angka yang sama supaya
-- contoh dan tangkapan layar tidak jadi bohong.
--
-- Pakai: npm run seed
-- =====================================================================

truncate
  expenses,
  qris_payments,
  void_request,
  transaction_items,
  transactions,
  stock_movements,
  stock_mutations,
  kedai_stock,
  produksi_bahan,
  produksi,
  bahan_movement,
  bahan_stock,
  bahan_mentah,
  waste,
  sisa_fisik,
  notifikasi,
  shifts,
  employees,
  products,
  admin_users,
  kedai
restart identity cascade;

-- --------------------------------------------------------------- kedai
insert into kedai (id, name, address, phone, timezone, low_stock_threshold) values
  ('11111111-1111-4111-8111-000000000001', 'Kedai Melati',  'Jl. Melati No. 12, Bandung',  '022-1110001', 'Asia/Kuala_Lumpur', 10),
  ('11111111-1111-4111-8111-000000000002', 'Kedai Kenanga', 'Jl. Kenanga No. 5, Bandung', '022-1110002', 'Asia/Kuala_Lumpur', 5),
  ('00000000-0000-4000-8000-000000000001', 'Gudang Pusat',  'Gudang pusat (tidak menjual)', NULL,          'Asia/Kuala_Lumpur', 5);

-- Gudang pusat: tempat stok jadi berkumpul dari produksi dan sumber assign.
update kedai set is_warehouse = true where id = '00000000-0000-4000-8000-000000000001';

-- ---------------------------------------------------------- admin_users
-- id harus sama dengan user di Supabase Auth. Dua akun -- satu per role --
-- supaya login /admin bisa diuji di kedua hak akses.
insert into admin_users (id, name, email, role)
select u.id, 'Owner Dev', u.email, 'owner'
from auth.users u
where u.email = 'owner@kedaidev.test';

insert into admin_users (id, name, email, role)
select u.id, 'Admin Pusat Dev', u.email, 'admin_pusat'
from auth.users u
where u.email = 'admin@kedaidev.test';

-- ----------------------------------------------------------- employees
-- qr_token dev sengaja dibuat terbaca supaya gampang diuji manual.
-- Di produksi token digenerate kriptografis (task M3-1).
insert into employees (id, kedai_id, name, role, qr_token) values
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000001', 'Rina Kasir',   'kasir',       'DEV-QR-RINA-0001'),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000001', 'Budi Kepala',  'admin_kedai', 'DEV-QR-BUDI-0002'),
  ('22222222-2222-4222-8222-000000000003', '11111111-1111-4111-8111-000000000002', 'Sari Kasir',   'kasir',       'DEV-QR-SARI-0003');

-- ------------------------------------------------------------ products
-- Katalog dipakai bersama seluruh kedai; hanya stoknya yang per kedai.
insert into products (id, name, price, category) values
  ('33333333-3333-4333-8333-000000000001', 'Kopi Susu Gula Aren', 22000, 'kopi'),
  ('33333333-3333-4333-8333-000000000002', 'Americano',           18000, 'kopi'),
  ('33333333-3333-4333-8333-000000000003', 'Cappuccino',          25000, 'kopi'),
  ('33333333-3333-4333-8333-000000000004', 'Latte',               25000, 'kopi'),
  ('33333333-3333-4333-8333-000000000005', 'Matcha Latte',        27000, 'non-kopi'),
  ('33333333-3333-4333-8333-000000000006', 'Cokelat Panas',       23000, 'non-kopi'),
  ('33333333-3333-4333-8333-000000000007', 'Teh Lemon',           15000, 'non-kopi'),
  ('33333333-3333-4333-8333-000000000008', 'Roti Bakar Cokelat',  18000, 'makanan'),
  ('33333333-3333-4333-8333-000000000009', 'Pisang Goreng',       16000, 'makanan'),
  ('33333333-3333-4333-8333-000000000010', 'Kentang Goreng',      20000, 'makanan');

-- ---------------------------------------------------- stok awal + ledger
-- Stok awal WAJIB lewat stock_movements, bukan UPDATE langsung ke
-- kedai_stock. Kalau seed saja sudah melanggar aturan itu, ledger-nya
-- bolong sejak baris pertama dan audit trail kehilangan titik awal.
with target as (
  select
    k.id as kedai_id,
    p.id as product_id,
    -- Kedai Melati stoknya lebih banyak; satu produk sengaja dibuat tipis
    -- supaya indikator "stok menipis" bisa langsung diuji di UI.
    --
    -- Pisang Goreng TIDAK ikut dijual di riwayat 14 hari (lihat katalog di
    -- blok operasional). Jadi angkanya tetap 3 sampai kasir benar-benar
    -- menjualnya saat demo, dan indikator "menipis" selalu ada untuk
    -- ditunjukkan.
    case
      when p.name = 'Pisang Goreng' then 3
      when k.name = 'Kedai Melati'  then 40
      else 30
    end as qty
  -- Gudang pusat tidak menerima stok awal silang-kedai; stoknya diisi oleh
  -- produksi di bawah.
  from kedai k
  cross join products p
  where k.is_warehouse = false
),
inserted as (
  insert into kedai_stock (kedai_id, product_id, quantity)
  select kedai_id, product_id, qty from target
  returning kedai_id, product_id, quantity
)
insert into stock_movements (kedai_id, product_id, delta, balance_after, reason, note)
select kedai_id, product_id, quantity, quantity, 'initial', 'Stok awal seed dev'
from inserted;

-- ------------------------------------------------------- bahan mentah
-- Saldo bahan dan ledger-nya ditulis bersama lewat record_bahan_movement,
-- jadi tidak ada jalur "ubah angka tanpa jejak" di seed.
insert into bahan_mentah (id, name, satuan, harga_beli) values
  ('44444444-4444-4444-8444-000000000001', 'Gula Pasir',   'kg',    18000),
  ('44444444-4444-4444-8444-000000000002', 'Biji Kopi',    'gram',  120000),
  ('44444444-4444-4444-8444-000000000003', 'Bubuk Coklat', 'gram',   90000),
  ('44444444-4444-4444-8444-000000000004', 'Susu UHT',     'liter',  19000),
  ('44444444-4444-4444-8444-000000000005', 'Bubuk Matcha', 'gram',  350000);

select record_bahan_movement(
  '55555555-5555-5555-8555-000000000001', '44444444-4444-4444-8444-000000000001',
   25, 'masuk', 'Stok awal bahan: gula 25 kg',
   (select id from admin_users where email = 'owner@kedaidev.test')
);

select record_bahan_movement(
  '55555555-5555-5555-8555-000000000002', '44444444-4444-4444-8444-000000000002',
   5000, 'masuk', 'Stok awal bahan: biji kopi 5 kg',
   (select id from admin_users where email = 'owner@kedaidev.test')
);

select record_bahan_movement(
  '55555555-5555-5555-8555-000000000003', '44444444-4444-4444-8444-000000000003',
   3000, 'masuk', 'Stok awal bahan: bubuk coklat 3 kg',
   (select id from admin_users where email = 'owner@kedaidev.test')
);

select record_bahan_movement(
  '55555555-5555-5555-8555-000000000004', '44444444-4444-4444-8444-000000000004',
   40, 'masuk', 'Stok awal bahan: susu UHT 40 liter',
   (select id from admin_users where email = 'owner@kedaidev.test')
);

select record_bahan_movement(
  '55555555-5555-5555-8555-000000000005', '44444444-4444-4444-8444-000000000005',
   2000, 'masuk', 'Stok awal bahan: bubuk matcha 2 kg',
   (select id from admin_users where email = 'owner@kedaidev.test')
);

-- =====================================================================
-- PRODUKSI DAPUR PUSAT
-- Tiga batch. Semua masuk ke Gudang Pusat. Distribution ke gerai dilakukan
-- lewat mutasi stok di bawah, bukan langsung. Itu pemisahan yang ingin
-- ditunjukkan ke klien: dapur menambah, gudang menyimpan, gerai menarik
-- dengan pengajuan.
-- =====================================================================

-- 60 cup Kopi Susu Gula Aren.
select record_produksi(
  '66666666-6666-6666-8666-000000000001',
  '33333333-3333-4333-8333-000000000001',
  60,
  array['44444444-4444-4444-8444-000000000001'::uuid,
        '44444444-4444-4444-8444-000000000002'::uuid],
  array[4, 3],
  (select id from admin_users where email = 'owner@kedaidev.test'),
  'Batch racikan reguler'
);

-- 30 cup Matcha Latte.
select record_produksi(
  '66666666-6666-6666-8666-000000000002',
  '33333333-3333-4333-8333-000000000005',
  30,
  array['44444444-4444-4444-8444-000000000005'::uuid,
        '44444444-4444-4444-8444-000000000004'::uuid],
  array[300, 2],
  (select id from admin_users where email = 'owner@kedaidev.test'),
  'Batch matcha dicampur pagi'
);

-- 25 cup Cokelat Panas.
select record_produksi(
  '66666666-6666-6666-8666-000000000003',
  '33333333-3333-4333-8333-000000000006',
  25,
  array['44444444-4444-4444-8444-000000000003'::uuid,
        '44444444-4444-4444-8444-000000000004'::uuid],
  array[400, 2],
  (select id from admin_users where email = 'owner@kedaidev.test'),
  'Batch cokelat untuk depot'
);

-- =====================================================================
-- MUTASI STOK
-- Tiga sudah disetujui (stok benar-benar pindah), satu masih di antrean
-- supaya halaman /admin/mutasi langsung punya yang bisa disetujui saat demo
-- (Bagian 10 juga memintakan promoter membuat pengajuan baru di HP).
-- =====================================================================

insert into stock_mutations
  (id, from_kedai_id, to_kedai_id, product_id, quantity, requested_by_admin_id, note)
values
  ('77777777-7777-7777-8777-000000000001', '00000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-000000000001', '33333333-3333-4333-8333-000000000001', 15, (select id from admin_users where email = 'owner@kedaidev.test'), 'Kiriman kopi susu dari dapur'),
  ('77777777-7777-7777-8777-000000000002', '00000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-000000000002', '33333333-3333-4333-8333-000000000001', 15, (select id from admin_users where email = 'owner@kedaidev.test'), 'Kiriman kopi susu untuk Kenanga'),
  ('77777777-7777-7777-8777-000000000003', '00000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-000000000002', '33333333-3333-4333-8333-000000000006', 10, (select id from admin_users where email = 'owner@kedaidev.test'), 'Kiriman cokelat panas untuk Kenanga');

select approve_mutation('77777777-7777-7777-8777-000000000001', (select id from admin_users where email = 'owner@kedaidev.test'));
select approve_mutation('77777777-7777-7777-8777-000000000002', (select id from admin_users where email = 'owner@kedaidev.test'));
select approve_mutation('77777777-7777-7777-8777-000000000003', (select id from admin_users where email = 'owner@kedaidev.test'));

-- Riwayat transfer antar gerai: Melati surplus teh ke Kenanga.
insert into stock_mutations
  (id, from_kedai_id, to_kedai_id, product_id, quantity, requested_by_employee_id, note)
values
  ('77777777-7777-7777-8777-000000000004', '11111111-1111-4111-8111-000000000001', '11111111-1111-4111-8111-000000000002', '33333333-3333-4333-8333-000000000007', 6, '22222222-2222-4222-8222-000000000001', 'Teh lemon menipis di Kenanga, pinjem dari Melati');

select approve_mutation('77777777-7777-7777-8777-000000000004', (select id from admin_users where email = 'owner@kedaidev.test'));

-- Pengajuan yang MENUNGGU. Sengaja dari Melati ke Kenanga supaya resemble
-- dengan yang akan dibuat promoter di HP pada Bagian 10.
insert into stock_mutations
  (id, from_kedai_id, to_kedai_id, product_id, quantity, requested_by_employee_id, note)
values
  ('77777777-7777-7777-8777-000000000005', '11111111-1111-4111-8111-000000000001', '11111111-1111-4111-8111-000000000002', '33333333-3333-4333-8333-000000000005', 3, '22222222-2222-4222-8222-000000000001', 'Matcha habis di Kenanga, minta 3 cup');

-- =====================================================================
-- 14 HARI OPERASIONAL
--
-- Satu shift per kedai per hari. Tiga belas hari lampau ditutup
-- (ada setoran + hitung fisik), hari ini:
--   * Kedai Melati  -> TIDAK ada shift. Kasir akan membukanya saat demo.
--   * Kedai Kenanga -> masih buka, jadi pemilik melihat satu toko yang
--                      sedang jalan, dan ada pengajuan pembatalan yang
--                      sah untuk diputuskan (shift harus masih terbuka).
--
-- Tiga kondisi yang sengaja dibiarkan bermasalah supaya halaman
-- "Perlu Perhatian" punya isi:
--   * Kemarin, Kedai Melati: selisih kas 15.000, belum dibereskan.
--   * 4 hari lalu, Kedai Melati: 3 antrian belum terkirim (perangkat mati).
--   * Hari ini, Kedai Kenanga: 1 pengajuan pembatalan menunggu.
--
-- Sisa penutupannya BALIK. Kalau semua tutupannya sama sempurna, halaman
-- "Perlu Perhatian" jadi tidak bisa didemokan.
-- =====================================================================
do $$
declare
  v_melati  constant uuid := '11111111-1111-4111-8111-000000000001';
  v_kenanga constant uuid := '11111111-1111-4111-8111-000000000002';
  v_rina    constant uuid := '22222222-2222-4222-8222-000000000001';
  v_budi    constant uuid := '22222222-2222-4222-8222-000000000002';
  v_sari    constant uuid := '22222222-2222-4222-8222-000000000003';
  v_pisang  constant uuid := '33333333-3333-4333-8333-000000000009';
  v_roti    constant uuid := '33333333-3333-4333-8333-000000000008';

  -- Sembilan produk yang boleh muncul di riwayat penjualan. Pisang Goreng
  -- sengaja TIDAK ada di sini supaya stoknya tetap tipis dan bisa
  -- ditunjukkan sebagai bahan demo "stok menipis".
  v_katalog constant uuid[] := array[
    '33333333-3333-4333-8333-000000000001'::uuid,  -- Kopi Susu Gula Aren
    '33333333-3333-4333-8333-000000000002'::uuid,  -- Americano
    '33333333-3333-4333-8333-000000000003'::uuid,  -- Cappuccino
    '33333333-3333-4333-8333-000000000004'::uuid,  -- Latte
    '33333333-3333-4333-8333-000000000005'::uuid,  -- Matcha Latte
    '33333333-3333-4333-8333-000000000006'::uuid,  -- Cokelat Panas
    '33333333-3333-4333-8333-000000000007'::uuid,  -- Teh Lemon
    '33333333-3333-4333-8333-000000000008'::uuid,  -- Roti Bakar Cokelat
    '33333333-3333-4333-8333-000000000010'::uuid   -- Kentang Goreng
  ];

  v_today   date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_offset  int;
  v_date    date;
  v_hari_ini boolean;
  v_kedai   uuid;
  v_nama    text;
  v_emp     uuid;
  v_dev     text;
  v_kas_awal numeric(12, 2);
  v_open    timestamptz;
  v_close   timestamptz;
  v_shift   uuid;
  v_trx     int;
  v_item    int;
  v_qty     int;
  v_base    int;
  v_items   jsonb;
  v_at      timestamptz;
  v_local   text;
  v_exp     numeric(12, 2);
  v_diff    numeric(12, 2);
  v_pending int;
  i         int;
begin
  for v_offset in reverse 13 .. 0 loop
    v_date     := v_today - v_offset;
    v_hari_ini := (v_offset = 0);

    for v_kedai, v_nama in
      select * from (values
        (v_melati::uuid,  'Kedai Melati'::text),
        (v_kenanga::uuid, 'Kedai Kenanga'::text)
      ) as t(kedai_id, nama)
    loop
      -- Hari ini Melati sengaja dilewati: demo memintakan kasir membuka
      -- toko sendiri, dan hanya boleh ada satu shift terbuka per kedai.
      if v_hari_ini and v_kedai = v_melati then
        continue;
      end if;

      -- Setiap lima hari giliran Budi yang buka shift di Melati supaya laporan
      -- "void per karyawan" punya lebih dari satu nama.
      if v_kedai = v_melati then
        v_emp      := case when (v_offset % 5) = 0 then v_budi else v_rina end;
        v_dev      := 'POS-MELATI-01';
        v_kas_awal := 500000;
      else
        v_emp      := v_sari;
        v_dev      := 'POS-KENANGA-01';
        v_kas_awal := 300000;
      end if;

      v_open  := (v_date::text || ' 09:00')::timestamp at time zone 'Asia/Kuala_Lumpur';
      v_close := (v_date::text || ' 20:30')::timestamp at time zone 'Asia/Kuala_Lumpur';

      insert into shifts (kedai_id, business_date, opened_by, opening_cash, opened_at, status)
      values (v_kedai, v_date, v_emp, v_kas_awal, v_open, 'open')
      returning id into v_shift;

      -- ------------------------------------------------- penjualan hari itu
      -- 4 sampai 6 transaksi per hari, semua TUNAI. Angkanya diturunkan
      -- dari (hari, nomor transaksi) supaya dua kali seed menghasilkan
      -- angka yang sama.
      v_trx := 4 + ((v_offset + (case when v_kedai = v_kenanga then 1 else 0 end)) % 3);

      for i in 1 .. v_trx loop
        v_at := v_open + (i * interval '75 minutes');

        -- Hari ini jangan pernah membuat transaksi di masa depan.
        if v_hari_ini and v_at > now() - interval '15 minutes' then
          v_at := now() - interval '15 minutes' - (i * interval '4 minutes');
        end if;

        v_item := 1 + ((v_offset + i) % 2);
        v_qty  := 1 + ((v_offset + i * 2) % 2);
        v_base := (v_offset * 3 + i * 2 + (case when v_kedai = v_kenanga then 1 else 0 end)) % 9;

        v_items := '[]'::jsonb;
        for j in 0 .. v_item - 1 loop
          v_items := v_items || jsonb_build_array(jsonb_build_object(
            'product_id', v_katalog[1 + ((v_base + j) % 9)],
            'name',       p.name,
            'price',      p.price,
            'qty',        v_qty
          ))
          from products p
          where p.id = v_katalog[1 + ((v_base + j) % 9)];
        end loop;

        v_local := 'DEMO-' || to_char(v_date, 'MMDD') || '-'
                   || (case when v_kedai = v_kenanga then 'K' else 'M' end)
                   || lpad(i::text, 2, '0');

        perform create_transaction(
          gen_random_uuid(), v_kedai, v_shift, v_emp,
          v_local, v_dev, 'tunai', v_at, v_items
        );
      end loop;

      -- ------------------------------------------------------------ waste
      -- Tiga hari sekali ada barang tidak layak jual. Dicatat lewat
      -- record_waste supaya saldo DAN ledger-nya ikut benar.
      if (v_offset % 4) = 1 then
        perform record_waste(
          gen_random_uuid(), v_kedai, v_shift, v_roti,
          1 + (v_offset % 2),
          case when v_offset % 8 = 1
               then 'Roti terbakar di oven'
               else 'Tumpah saat disajikan ke pelanggan'
          end,
          v_emp
        );
      end if;

      -- ---------------------------------------------------- tutup toko
      if v_hari_ini then
        -- Sesi hari ini dibiarkan terbuka. Sifatnya reconcile belum
        -- dijalankan, jadi expected_cash masih kosong; begitu kasir
        -- menutup toko, angkanya dihitung dari transaksi yang ada.
        continue;
      end if;

      -- Hitung fisik saat tutup = saldo saat itu. Dua sesi dibuat
      -- dikurangi sedikit supaya halaman Setoran punya selisih untuk dicek.
      insert into sisa_fisik (shift_id, product_id, quantity)
      select v_shift, ks.product_id, ks.quantity
      from kedai_stock ks
      where ks.kedai_id = v_kedai;

      if v_offset = 1 and v_kedai = v_melati then
        update sisa_fisik set quantity = greatest(quantity - 2, 0)
        where shift_id = v_shift and product_id = v_pisang;
      end if;
      if v_offset = 3 and v_kedai = v_kenanga then
        update sisa_fisik set quantity = greatest(quantity - 1, 0)
        where shift_id = v_shift and product_id = v_roti;
      end if;

      -- Setoran. Angkanya harus benar dulu, baru selisihnya ditambahkan,
      -- supaya "yang seharusnya ada" tidak ikut salah.
      select expected_cash into v_exp from reconcile_shift(v_shift, 0);

      v_diff    := 0;
      v_pending := 0;

      -- Kemarin Melati: masih ada selisih yang belum dibereskan.
      if v_offset = 1 and v_kedai = v_melati then
        v_diff := -15000;
      end if;

      -- 3 hari lalu Kenanga: ada selisih, tapi SUDAH dijelaskan pemilik.
      -- Kas positif (uang lebih banyak) dan statusnya 'dijelaskan', jadi
      -- tidak muncul lagi di "Perlu Perhatian".
      if v_offset = 3 and v_kedai = v_kenanga then
        v_diff := 8000;
      end if;

      -- 4 hari lalu Melati: perangkatnya mati, 3 transaksi belum masuk.
      if v_offset = 4 and v_kedai = v_melati then
        v_pending := 3;
      end if;

      perform close_shift(v_shift, v_kedai, v_emp, v_exp + v_diff, v_pending);

      -- close_shift dan reconcile_shift memakai now(). Historinya
      -- dicatat ulang ke tanggal bukanya supaya "ditutup 20:30" bukan
      -- "ditutup sekarang".
      update shifts
         set opened_at    = v_open,
             closed_at    = v_close,
             reconciled_at = v_close + interval '3 minutes'
       where id = v_shift;

      -- Selisih yang sudah dijelaskan pemilik TIDAK muncul lagi di
      -- "Perlu Perhatian" (halaman itu cuma menampilkan yang terbuka),
      -- jadi dua kasus ini kelihatan berbeda.
      update shifts
         set difference_status = case
                                   when v_diff = 0 then 'dijelaskan'
                                   when v_offset = 3 and v_kedai = v_kenanga then 'dijelaskan'
                                   else 'terbuka'
                                 end,
             difference_note   = case
                                   when v_offset = 1 and v_kedai = v_melati
                                     then 'Selisih 15.000, kasir bilang ada yang salah hitung'
                                   when v_offset = 3 and v_kedai = v_kenanga
                                     then 'Sudah dicek, ternyata kurang bayar satu gelas'
                                   else 'Setoran sesuai'
                                 end
       where id = v_shift;

      insert into notifikasi
        (kedai_id, shift_id, type, title, message, is_read, created_at)
      values
        (v_kedai, v_shift, 'shift_selesai', 'Toko ditutup',
         v_nama || ' tutup tanggal ' || v_date || '. Setoran siap dicek.',
         v_offset > 2, v_close);

      if v_diff <> 0 and v_offset = 1 and v_kedai = v_melati then
        insert into notifikasi
          (kedai_id, shift_id, type, title, message, is_read, created_at)
        values
          (v_kedai, v_shift, 'selisih', 'Ada selisih kas',
           v_nama || ' tanggal ' || v_date || ' punya selisih 15.000 yang belum dibereskan.',
           false, v_close + interval '5 minutes');
      end if;

      if v_pending > 0 then
        insert into notifikasi
          (kedai_id, shift_id, type, title, message, is_read, created_at)
        values
          (v_kedai, v_shift, 'device_stale', 'Antrian belum terkirim',
           'Perangkat POS Melati belum mengirim 3 transaksi sejak ' || v_date || '.',
           false, v_close + interval '30 minutes');
      end if;
    end loop;
  end loop;
end $$;

-- =====================================================================
-- PEMBATALAN TRANSAKSI
-- Tiga kasus, karena tiga statusnya tampil berbeda di UI:
--   1. Menunggu keputusan pemilik (hari ini, Kenanga masih buka).
--   2. Disetujui, stok sudah balik.
--   3. Ditolak, transaksi tetap tercatat.
-- =====================================================================
do $$
declare
  v_kenanga constant uuid := '11111111-1111-4111-8111-000000000002';
  v_melati  constant uuid := '11111111-1111-4111-8111-000000000001';
  v_sari    constant uuid := '22222222-2222-4222-8222-000000000003';
  v_rina    constant uuid := '22222222-2222-4222-8222-000000000001';
  v_shift   uuid;
  v_tx      uuid;
begin
  -- 1) Menunggu. Sesi Kenanga hari ini masih open, jadi pengajuan ini
  --    sah dan bisa diputuskan pemilik saat demo.
  select id into v_shift
  from shifts where kedai_id = v_kenanga and status = 'open';

  select t.id into v_tx
  from transactions t
  where t.shift_id = v_shift and t.status = 'completed'
  order by t.created_at
  limit 1;

  if v_tx is not null then
    perform request_void(
      v_tx, v_kenanga, v_sari, 'Pelanggan salah pesan, minta tukar menu lain'
    );

    insert into notifikasi (kedai_id, shift_id, type, title, message, is_read, created_at)
    values
      (v_kenanga, v_shift, 'void_review', 'Pembatalan menunggu',
       'Kasir Kenanga mengajukan pembatalan 1 transaksi. Perlu keputusan pemilik.',
       false, now());
  end if;

  -- 2) Disetujui, 2 hari lalu. Stok balik ke gudang gerai.
  select t.id into v_tx
  from transactions t
  join shifts s on s.id = t.shift_id
  where s.kedai_id = v_melati
    and s.status = 'closed'
    and t.status = 'completed'
    and s.business_date = (now() at time zone 'Asia/Kuala_Lumpur')::date - 2
  order by t.created_at
  limit 1;

  if v_tx is not null then
    insert into void_request
      (id, transaction_id, kedai_id, requested_by_employee_id, alasan, created_at)
    values
      ('88888888-8888-8888-8888-000000000001', v_tx, v_melati, v_rina,
       'Pelanggan berubah pikiran sebelum drink dibuat',
       now() - interval '2 days');

    update transactions set status = 'perlu_review' where id = v_tx;

    perform decide_void(
      '88888888-8888-8888-8888-000000000001', true,
      (select id from admin_users where email = 'owner@kedaidev.test'),
      'Disetujui, bahan dikembalikan ke rak'
    );
  end if;

  -- 3) Ditolak, 5 hari lalu. Transaksi tetap dihitung ke omzet.
  select t.id into v_tx
  from transactions t
  join shifts s on s.id = t.shift_id
  where s.kedai_id = v_kenanga
    and s.status = 'closed'
    and t.status = 'completed'
    and s.business_date = (now() at time zone 'Asia/Kuala_Lumpur')::date - 5
  order by t.created_at desc
  limit 1;

  if v_tx is not null then
    insert into void_request
      (id, transaction_id, kedai_id, requested_by_employee_id, alasan, created_at)
    values
      ('88888888-8888-8888-8888-000000000002', v_tx, v_kenanga, v_sari,
       'Ragu salah catat, minta dibatalkan',
       now() - interval '5 days');

    update transactions set status = 'perlu_review' where id = v_tx;

    perform decide_void(
      '88888888-8888-8888-8888-000000000002', false,
      (select id from admin_users where email = 'owner@kedaidev.test'),
      'Barang sudah diminum, transaksi tetap dicatat'
    );
  end if;
end $$;

-- =====================================================================
-- PENGELUARAN
-- Dua jenis, sesuai aturan main:
--   * from_cash = true  -> uang diambil dari laci kasir, jadi setoran
--     seharusnya berkurang. Harus dikaitkan ke shift.
--   * from_cash = false -> dibayar dari luar laci (rekening/vendor),
--     tidak menyentuh angka setoran.
-- =====================================================================

-- Kas keluar dari laci, dikaitkan ke sesi yang sedang berjalan.
insert into expenses
  (kedai_id, category, description, amount, expense_date, shift_id,
   from_cash, recorded_by_employee_id)
select s.kedai_id, 'bahan_baku', 'Beli es batu & cup', 75000,
       s.business_date, s.id, true, s.opened_by
from shifts s
where s.status = 'open';

insert into expenses
  (kedai_id, category, description, amount, expense_date, shift_id,
   from_cash, recorded_by_employee_id)
select s.kedai_id, 'lainnya', 'Bensin untuk belanja pasar', 40000,
       s.business_date, s.id, true, s.opened_by
from shifts s
where s.status = 'closed'
  and s.business_date = (now() at time zone 'Asia/Kuala_Lumpur')::date - 3;

-- Pengeluaran umum sepanjang 14 hari supaya laporan laba-rugi punya isi
-- berapa pun rentang tanggal yang dipilih.
insert into expenses
  (kedai_id, category, description, amount, expense_date, from_cash, recorded_by_admin_id)
select e.kedai_id, e.category, e.description, e.amount,
       (now() at time zone 'Asia/Kuala_Lumpur')::date - e.hari_lalu,
       false,
       (select id from admin_users where email = 'owner@kedaidev.test')
from (values
  ('11111111-1111-4111-8111-000000000001'::uuid, 'sewa'::text,      'Sewa kios bulan ini'::text,        2500000, 6),
  ('11111111-1111-4111-8111-000000000001'::uuid, 'listrik'::text,   'Listrik dan air'::text,            420000, 5),
  ('11111111-1111-4111-8111-000000000001'::uuid, 'gaji'::text,      'Gaji kasir'::text,                2400000, 4),
  ('11111111-1111-4111-8111-000000000002'::uuid, 'bahan_baku'::text, 'Belanja bahan baku'::text,        1850000, 4),
  ('11111111-1111-4111-8111-000000000002'::uuid, 'listrik'::text,   'Listrik dan air'::text,            390000, 3),
  ('11111111-1111-4111-8111-000000000002'::uuid, 'gaji'::text,      'Gaji kasir'::text,                2400000, 2),
  ('11111111-1111-4111-8111-000000000001'::uuid, 'bahan_baku'::text, 'Biji kopi 2 kg'::text,            600000, 1),
  ('11111111-1111-4111-8111-000000000001'::uuid, 'lainnya'::text,   'Servis mesin espresso'::text,      150000, 1)
) as e(kedai_id, category, description, amount, hari_lalu);

-- =====================================================================
-- NOTIFIKASI LAIN
-- Enam jenis supaya lonceng di sidebar langsung berwarna, dan tiap baris
-- punya alasan yang jelas (bukan data karangan).
-- =====================================================================
insert into notifikasi (kedai_id, type, title, message, is_read, created_at) values
  (null, 'produksi', 'Produksi selesai',
   'Tiga batch dari dapur pusat sudah masuk Gudang Pusat: kopi susu, matcha, cokelat panas.',
   true, now() - interval '6 days'),
  ('11111111-1111-4111-8111-000000000001', 'assign', 'Stok dikirim',
   'Kopi susu 15 cup dikirim dari Gudang Pusat ke Kedai Melati.',
   true, now() - interval '6 days'),
  ('11111111-1111-4111-8111-000000000002', 'assign', 'Stok dikirim',
   'Cokelat panas 10 cup dikirim dari Gudang Pusat ke Kedai Kenanga.',
   true, now() - interval '4 days'),
  (null, 'void_review', 'Pembatalan diproses',
   'Satu pembatalan disetujui dan satu ditolak. Riwayat tetap ada, tidak dihapus.',
   true, now() - interval '2 days'),
  ('11111111-1111-4111-8111-000000000002', 'stock_low', 'Stok menipis',
   'Kentang Goreng di Kedai Kenanga tinggal sedikit. Sisanya sudah dipesan dari Melati.',
   false, now() - interval '3 hours');

-- =====================================================================
-- PENYESUAIAN STOK AKHIR
-- Satu produk di Kenanga dijatuhkan supaya badge "Menipis" muncul di
-- halaman Stok tanpa harus menunggu penjualan nyata. Dijalankan lewat
-- adjust_stock, bukan UPDATE, jadi alasannya ikut tersimpan di ledger.
-- =====================================================================
select adjust_stock(
  '11111111-1111-4111-8111-000000000002',
  '33333333-3333-4333-8333-000000000010',
  4,
  'Stok opname: kentang goreng tinggal 4',
  (select id from admin_users where email = 'owner@kedaidev.test')
);
