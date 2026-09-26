-- =====================================================================
-- Seed "sistem sudah berjalan seminggu" — kedai makanan nusantara
--
-- !! MENGHAPUS SELURUH DATA OPERASIONAL !!
-- Hanya untuk database development. Script pemanggilnya (scripts/seed.mjs)
-- menolak berjalan kalau tabel transactions sudah berisi data, kecuali
-- dipaksa dengan --force.
--
-- Cerita yang dibangun:
--   * Dua gerai "makanan nusantara" + satu gudang pusat (dapur produksi).
--   * SATU kedai = SATU karyawan (kasir). Tidak ada kepala kedai --
--     pemilik (owner) yang memutuskan dari jauh lewat /admin.
--   * Tujuh hari operasional: hari ke-7 lampau sampai HARI INI.
--     Enam hari sudah ditutup (ada setoran & hitung fisik), hari ini
--     masih buka supaya POS langsung punya sesi aktif saat demo.
--   * Menu lengkap khas nusantara (nasi, mie, ayam, sate, soto, rendang,
--     gado-gado, cemilan, minuman).
--   * Dapur pusat menambah bahan mentah, produksi batch, lalu
--     mendistribusikan produk jadi ke gerai lewat mutasi stok.
--
-- Semua pergerakan stok & produk lewat fungsi resmi (create_transaction,
-- record_produksi, record_waste, adjust_stock, approve_mutation) supaya
-- ledger dan saldo konsisten sejak baris pertama.
--
-- Pakai: npm run seed:minggu   (tambahkan -- --force kalau sudah pernah)
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
insert into kedai (id, name, address, phone, timezone, low_stock_threshold, is_warehouse) values
  ('a1000000-0000-4000-8000-000000000001', 'Kedai Nusantara Harmoni',
   'Jalan Tengku Ampuan Zabedah, Shah Alam, Selangor', '+60 3-5510 2201',
   'Asia/Kuala_Lumpur', 10, false),
  ('a1000000-0000-4000-8000-000000000002', 'Kedai Nusantara Sentosa',
   'Jalan Meru, Klang, Selangor', '+60 3-3341 8802',
   'Asia/Kuala_Lumpur', 10, false),
  ('a1000000-0000-4000-8000-000000000009', 'Gudang Dapur Pusat',
   'Kawasan Perindustrian Bukit Raja, Klang, Selangor', null,
   'Asia/Kuala_Lumpur', 5, true);

-- ---------------------------------------------------------- admin_users
-- Pemilik & admin pusat -- dua-duanya login lewat /admin.
insert into admin_users (id, name, email, role)
select u.id, 'Puan Salmah', u.email, 'owner'
from auth.users u
where u.email = 'owner@kedaidev.test';

insert into admin_users (id, name, email, role)
select u.id, 'Rizal Operasi', u.email, 'admin_pusat'
from auth.users u
where u.email = 'admin@kedaidev.test';

-- ----------------------------------------------------------- employees
-- SATU karyawan per kedai (keputusan desain: satu kedai satu karyawan),
-- jadi semua berperan 'kasir' -- tidak ada kepala kedai.
insert into employees (id, kedai_id, name, role, qr_token) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'Aminah', 'kasir', 'DEV-QR-AMINAH-0001'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000002',
   'Rosli',  'kasir', 'DEV-QR-ROSLI-0002');

-- ------------------------------------------------------------ products
-- Menu utama kedai makanan nusantara. Harga ringgit, sengaja bulat.
insert into products (id, name, price, category) values
  ('a3000000-0000-4000-8000-000000000001', 'Nasi Goreng Kampung',  9, 'makanan'),
  ('a3000000-0000-4000-8000-000000000002', 'Nasi Uduk Ayam',      10, 'makanan'),
  ('a3000000-0000-4000-8000-000000000003', 'Mie Goreng Jawa',      9, 'makanan'),
  ('a3000000-0000-4000-8000-000000000004', 'Mie Ayam Bakso',      10, 'makanan'),
  ('a3000000-0000-4000-8000-000000000005', 'Ayam Geprek',         11, 'makanan'),
  ('a3000000-0000-4000-8000-000000000006', 'Ayam Penyet Sambal',  12, 'makanan'),
  ('a3000000-0000-4000-8000-000000000007', 'Sate Ayam',           13, 'makanan'),
  ('a3000000-0000-4000-8000-000000000008', 'Soto Ayam Lamongan',  10, 'makanan'),
  ('a3000000-0000-4000-8000-000000000009', 'Rendang Daging',      14, 'makanan'),
  ('a3000000-0000-4000-8000-000000000010', 'Gado-Gado',            9, 'makanan'),
  ('a3000000-0000-4000-8000-000000000011', 'Nasi Rames',          11, 'makanan'),
  ('a3000000-0000-4000-8000-000000000012', 'Nasi Kuning',         10, 'makanan'),
  ('a3000000-0000-4000-8000-000000000013', 'Bakso Sapi',          10, 'makanan'),
  ('a3000000-0000-4000-8000-000000000014', 'Tempe Mendoan',        5, 'cemilan'),
  ('a3000000-0000-4000-8000-000000000015', 'Tahu Goreng',          5, 'cemilan'),
  ('a3000000-0000-4000-8000-000000000016', 'Pisang Goreng',        4, 'cemilan'),
  ('a3000000-0000-4000-8000-000000000017', 'Kerupuk',              2, 'cemilan'),
  ('a3000000-0000-4000-8000-000000000018', 'Kacang Goreng',        4, 'cemilan'),
  ('a3000000-0000-4000-8000-000000000019', 'Es Teh Manis',         3, 'minuman'),
  ('a3000000-0000-4000-8000-000000000020', 'Es Jeruk',             4, 'minuman'),
  ('a3000000-0000-4000-8000-000000000021', 'Teh Panas',            3, 'minuman'),
  ('a3000000-0000-4000-8000-000000000022', 'Kopi Tubruk',          4, 'minuman'),
  ('a3000000-0000-4000-8000-000000000023', 'Es Cendol',            5, 'minuman'),
  ('a3000000-0000-4000-8000-000000000024', 'Air Mineral',          2, 'minuman');

-- ------------------------------------------------------- bahan mentah
insert into bahan_mentah (id, name, satuan, harga_beli) values
  ('a4000000-0000-4000-8000-000000000001', 'Beras',              'kg',      4),
  ('a4000000-0000-4000-8000-000000000002', 'Ayam',               'kg',     12),
  ('a4000000-0000-4000-8000-000000000003', 'Telur',              'biji',    1),
  ('a4000000-0000-4000-8000-000000000004', 'Minyak Goreng',      'liter',   6),
  ('a4000000-0000-4000-8000-000000000005', 'Bawang Merah',       'kg',      8),
  ('a4000000-0000-4000-8000-000000000006', 'Bawang Putih',       'kg',      9),
  ('a4000000-0000-4000-8000-000000000007', 'Cabai Merah',        'kg',     10),
  ('a4000000-0000-4000-8000-000000000008', 'Kecap Manis',        'botol',   5),
  ('a4000000-0000-4000-8000-000000000009', 'Mie Kering',         'bungkus', 2),
  ('a4000000-0000-4000-8000-000000000010', 'Tepung Terigu',      'kg',      3),
  ('a4000000-0000-4000-8000-000000000011', 'Gula Pasir',         'kg',      3),
  ('a4000000-0000-4000-8000-000000000012', 'Kelapa',             'kg',      5),
  ('a4000000-0000-4000-8000-000000000013', 'Tempe',              'papan',   2),
  ('a4000000-0000-4000-8000-000000000014', 'Tahu',               'papan',   2),
  ('a4000000-0000-4000-8000-000000000015', 'Teh Serbuk',         'bungkus', 6),
  ('a4000000-0000-4000-8000-000000000016', 'Kopi Bubuk',         'kg',     30),
  ('a4000000-0000-4000-8000-000000000017', 'Susu Kental Manis',  'kaleng',  4),
  ('a4000000-0000-4000-8000-000000000018', 'Daun Bawang',        'ikat',    1),
  ('a4000000-0000-4000-8000-000000000019', 'Daging Sapi',        'kg',     30),
  ('a4000000-0000-4000-8000-000000000020', 'Kerupuk Mentah',     'kg',      6);

do $$
declare
  v_owner uuid;
  r       record;
begin
  select id into v_owner from admin_users where email = 'owner@kedaidev.test';

  -- Stok awal bahan di gudang pusat (saldo + ledger sekaligus).
  for r in
    select * from (values
      ('a5000000-0000-4000-8000-000000000001'::uuid, 'a4000000-0000-4000-8000-000000000001'::uuid, 60),
      ('a5000000-0000-4000-8000-000000000002'::uuid, 'a4000000-0000-4000-8000-000000000002'::uuid, 40),
      ('a5000000-0000-4000-8000-000000000003'::uuid, 'a4000000-0000-4000-8000-000000000003'::uuid, 80),
      ('a5000000-0000-4000-8000-000000000004'::uuid, 'a4000000-0000-4000-8000-000000000004'::uuid, 30),
      ('a5000000-0000-4000-8000-000000000005'::uuid, 'a4000000-0000-4000-8000-000000000005'::uuid, 25),
      ('a5000000-0000-4000-8000-000000000006'::uuid, 'a4000000-0000-4000-8000-000000000006'::uuid, 20),
      ('a5000000-0000-4000-8000-000000000007'::uuid, 'a4000000-0000-4000-8000-000000000007'::uuid, 15),
      ('a5000000-0000-4000-8000-000000000008'::uuid, 'a4000000-0000-4000-8000-000000000008'::uuid, 20),
      ('a5000000-0000-4000-8000-000000000009'::uuid, 'a4000000-0000-4000-8000-000000000009'::uuid, 60),
      ('a5000000-0000-4000-8000-000000000010'::uuid, 'a4000000-0000-4000-8000-000000000010'::uuid, 25),
      ('a5000000-0000-4000-8000-000000000011'::uuid, 'a4000000-0000-4000-8000-000000000011'::uuid, 20),
      ('a5000000-0000-4000-8000-000000000012'::uuid, 'a4000000-0000-4000-8000-000000000012'::uuid, 15),
      ('a5000000-0000-4000-8000-000000000013'::uuid, 'a4000000-0000-4000-8000-000000000013'::uuid, 40),
      ('a5000000-0000-4000-8000-000000000014'::uuid, 'a4000000-0000-4000-8000-000000000014'::uuid, 20),
      ('a5000000-0000-4000-8000-000000000015'::uuid, 'a4000000-0000-4000-8000-000000000015'::uuid, 20),
      ('a5000000-0000-4000-8000-000000000016'::uuid, 'a4000000-0000-4000-8000-000000000016'::uuid, 10),
      ('a5000000-0000-4000-8000-000000000017'::uuid, 'a4000000-0000-4000-8000-000000000017'::uuid, 30),
      ('a5000000-0000-4000-8000-000000000018'::uuid, 'a4000000-0000-4000-8000-000000000018'::uuid, 20),
      ('a5000000-0000-4000-8000-000000000019'::uuid, 'a4000000-0000-4000-8000-000000000019'::uuid, 25),
      ('a5000000-0000-4000-8000-000000000020'::uuid, 'a4000000-0000-4000-8000-000000000020'::uuid, 50)
    ) as t(move_id, bahan_id, qty)
  loop
    perform record_bahan_movement(
      r.move_id, r.bahan_id, r.qty, 'masuk', 'Stok awal seeder minggu', v_owner
    );
  end loop;
end $$;

-- ------------------------------------------------ stok awal tiap gerai
-- Saldo awal semua menu di kedua gerai. Lewat adjust_stock supaya ledger
-- (reason 'initial') dan saldo selalu ditulis bersama.
do $$
declare
  v_owner uuid;
  k       record;
  p       record;
begin
  select id into v_owner from admin_users where email = 'owner@kedaidev.test';

  for k in select id from kedai where is_warehouse = false loop
    for p in select id from products loop
      perform adjust_stock(k.id, p.id, 120, 'Stok awal seeder minggu', v_owner);
    end loop;
  end loop;
end $$;

-- ------------------------------------------------ produksi dapur pusat
-- Batch masakan jadi yang dikerjakan di gudang, memakai fungsi resmi
-- record_produksi (kurangi bahan + tambah stok gudang dalam satu transaksi).
select record_produksi(
  'a6000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000009', 120,
  array['a4000000-0000-4000-8000-000000000019'::uuid,
        'a4000000-0000-4000-8000-000000000007'::uuid,
        'a4000000-0000-4000-8000-000000000005'::uuid,
        'a4000000-0000-4000-8000-000000000006'::uuid],
  array[12, 4, 3, 2],
  (select id from admin_users where email = 'owner@kedaidev.test'),
  'Batch rendang pagi');

select record_produksi(
  'a6000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000008', 150,
  array['a4000000-0000-4000-8000-000000000002'::uuid,
        'a4000000-0000-4000-8000-000000000005'::uuid,
        'a4000000-0000-4000-8000-000000000006'::uuid,
        'a4000000-0000-4000-8000-000000000018'::uuid],
  array[8, 3, 2, 5],
  (select id from admin_users where email = 'owner@kedaidev.test'),
  'Kuah soto semalam');

select record_produksi(
  'a6000000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000002', 180,
  array['a4000000-0000-4000-8000-000000000001'::uuid,
        'a4000000-0000-4000-8000-000000000002'::uuid,
        'a4000000-0000-4000-8000-000000000012'::uuid],
  array[18, 10, 6],
  (select id from admin_users where email = 'owner@kedaidev.test'),
  'Nasi uduk bungkus');

select record_produksi(
  'a6000000-0000-4000-8000-000000000004', 'a3000000-0000-4000-8000-000000000014', 200,
  array['a4000000-0000-4000-8000-000000000013'::uuid,
        'a4000000-0000-4000-8000-000000000010'::uuid,
        'a4000000-0000-4000-8000-000000000004'::uuid],
  array[20, 8, 6],
  (select id from admin_users where email = 'owner@kedaidev.test'),
  'Tempe mendoan goreng');

select record_produksi(
  'a6000000-0000-4000-8000-000000000005', 'a3000000-0000-4000-8000-000000000017', 300,
  array['a4000000-0000-4000-8000-000000000020'::uuid,
        'a4000000-0000-4000-8000-000000000004'::uuid],
  array[30, 5],
  (select id from admin_users where email = 'owner@kedaidev.test'),
  'Kerupuk digoreng');

select record_produksi(
  'a6000000-0000-4000-8000-000000000006', 'a3000000-0000-4000-8000-000000000001', 160,
  array['a4000000-0000-4000-8000-000000000001'::uuid,
        'a4000000-0000-4000-8000-000000000003'::uuid,
        'a4000000-0000-4000-8000-000000000008'::uuid,
        'a4000000-0000-4000-8000-000000000005'::uuid],
  array[16, 30, 3, 2],
  (select id from admin_users where email = 'owner@kedaidev.test'),
  'Bumbu nasi goreng');

select record_produksi(
  'a6000000-0000-4000-8000-000000000007', 'a3000000-0000-4000-8000-000000000003', 140,
  array['a4000000-0000-4000-8000-000000000009'::uuid,
        'a4000000-0000-4000-8000-000000000003'::uuid,
        'a4000000-0000-4000-8000-000000000008'::uuid],
  array[28, 20, 2],
  (select id from admin_users where email = 'owner@kedaidev.test'),
  'Mie goreng bumbu jawa');

-- --------------------------------------------------- mutasi ke gerai
-- Tiga kiriman disetujui (stok pindah sekarang), satu masih menunggu
-- keputusan pemilik supaya halaman Mutasi punya antrean.
insert into stock_mutations
  (id, from_kedai_id, to_kedai_id, product_id, quantity, requested_by_admin_id, note)
values
  ('a7000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000009', 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000001', 60, (select id from admin_users where email = 'owner@kedaidev.test'), 'Kiriman nasi goreng ke Harmoni'),
  ('a7000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000009', 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000008', 60, (select id from admin_users where email = 'owner@kedaidev.test'), 'Soto untuk Harmoni'),
  ('a7000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000009', 'a1000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000003', 60, (select id from admin_users where email = 'owner@kedaidev.test'), 'Mie goreng untuk Sentosa'),
  ('a7000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000009', 'a1000000-0000-4000-8000-000000000001', 'a3000000-0000-4000-8000-000000000014', 80, (select id from admin_users where email = 'owner@kedaidev.test'), 'Tempe mendoan ke Harmoni');

insert into stock_mutations
  (id, from_kedai_id, to_kedai_id, product_id, quantity, requested_by_admin_id, note)
values
  ('a7000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000009', 'a1000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000009', 40, (select id from admin_users where email = 'owner@kedaidev.test'), 'Sentosa minta tambahan rendang');

select approve_mutation('a7000000-0000-4000-8000-000000000001', (select id from admin_users where email = 'owner@kedaidev.test'));
select approve_mutation('a7000000-0000-4000-8000-000000000002', (select id from admin_users where email = 'owner@kedaidev.test'));
select approve_mutation('a7000000-0000-4000-8000-000000000003', (select id from admin_users where email = 'owner@kedaidev.test'));
select approve_mutation('a7000000-0000-4000-8000-000000000005', (select id from admin_users where email = 'owner@kedaidev.test'));

-- =====================================================================
-- SEMINGGU OPERASIONAL
-- Enam hari lampau ditutup (ada hitung fisik + setoran), hari ini masih
-- buka supaya kasir/pemilik langsung punya sesi berjalan.
-- =====================================================================
do $$
declare
  v_harmoni uuid := 'a1000000-0000-4000-8000-000000000001';
  v_sentosa uuid := 'a1000000-0000-4000-8000-000000000002';
  v_geprek  uuid := 'a3000000-0000-4000-8000-000000000005';
  v_esteh   uuid := 'a3000000-0000-4000-8000-000000000019';

  v_today date := (now() at time zone 'Asia/Kuala_Lumpur')::date;
  v_offset int;
  v_date   date;
  v_es_hari_ini boolean;

  k        record;
  v_emp    uuid;
  v_dev    text;
  v_open   timestamptz;
  v_close  timestamptz;
  v_at     timestamptz;
  v_shift  uuid;
  v_count  int;
  i        int;
  v_n      int;
  v_items  jsonb;
  v_total  numeric(12, 2);
  v_pay    text;
  v_local  text;
  v_pid    uuid;
  v_exp    numeric(12, 2);
  v_diff   numeric(12, 2);
begin
  for v_offset in reverse 6 .. 0 loop
    v_date := v_today - v_offset;
    v_es_hari_ini := (v_offset = 0);

    for k in
      select id, name from kedai where is_warehouse = false order by name
    loop
      select e.id into v_emp from employees e where e.kedai_id = k.id limit 1;
      v_dev := case when k.id = v_harmoni then 'TAB-HRM-01' else 'TAB-STS-01' end;

      v_open  := (v_date::text || ' 09:00')::timestamp at time zone 'Asia/Kuala_Lumpur';
      v_close := (v_date::text || ' 21:00')::timestamp at time zone 'Asia/Kuala_Lumpur';

      if v_es_hari_ini then
        insert into shifts (kedai_id, business_date, opened_by, opening_cash, opened_at, status)
        values (k.id, v_date, v_emp, 200, v_open, 'open')
        returning id into v_shift;
      else
        insert into shifts
          (kedai_id, business_date, opened_by, closed_by, opening_cash,
           opened_at, closed_at, status)
        values (k.id, v_date, v_emp, v_emp, 200, v_open, v_close, 'closed')
        returning id into v_shift;
      end if;

      -- ------------------------------------------------- penjualan hari itu
      v_count := 16 + floor(random() * 10)::int;

      for i in 1 .. v_count loop
        v_at := v_open + (random() * interval '11 hours');
        if v_es_hari_ini then
          if v_at > now() then
            v_at := now() - (random() * interval '25 minutes');
          end if;
          if v_at < v_open then
            v_at := v_open;
          end if;
        end if;

        v_n := 1 + floor(random() * 3)::int;
        select jsonb_agg(jsonb_build_object(
                 'product_id', p.id,
                 'name',       p.name,
                 'price',      p.price,
                 'qty',        1 + floor(random() * 2)::int))
          into v_items
        from (
          select id, name, price
          from products
          order by random()
          limit v_n
        ) p;

        select coalesce(sum((e->>'price')::numeric * (e->>'qty')::int), 0)
          into v_total
        from jsonb_array_elements(v_items) e;

        v_pay := case when random() < 0.7 then 'tunai' else 'qris' end;
        v_local := 'SEED-' || to_char(v_date, 'MMDD') || '-' || to_char(i, 'FM000');

        if v_pay = 'tunai' then
          perform create_transaction(
            gen_random_uuid(), k.id, v_shift, v_emp,
            v_local, v_dev, 'tunai', v_at, v_items
          );
        else
          v_pid := gen_random_uuid();
          insert into qris_payments
            (id, kedai_id, shift_id, employee_id, local_number, device_id,
             items, total, midtrans_order_id, status, expires_at, created_at)
          values
            (v_pid, k.id, v_shift, v_emp, v_local, v_dev,
             v_items, v_total, 'POS-' || v_pid, 'created',
             v_at + interval '15 minutes', v_at);
          perform confirm_qris_payment(v_pid, v_at);
        end if;
      end loop;

      if not v_es_hari_ini then
        -- Hitung fisik saat tutup = saldo saat itu. Satu-dua produk sengaja
        -- dibuat kurang sedikit supaya Collect punya selisih untuk dicek.
        insert into sisa_fisik (shift_id, product_id, quantity)
        select v_shift, ks.product_id, ks.quantity
        from kedai_stock ks
        where ks.kedai_id = k.id;

        if v_offset = 3 and k.id = v_harmoni then
          update sisa_fisik set quantity = greatest(quantity - 3, 0)
          where shift_id = v_shift and product_id = v_geprek;
        end if;
        if v_offset = 5 and k.id = v_sentosa then
          update sisa_fisik set quantity = greatest(quantity - 4, 0)
          where shift_id = v_shift and product_id = v_esteh;
        end if;

        -- Setoran: hitung dulu angka seharusnya, baru beri selisih pada
        -- dua sesi supaya halaman Setoran & "Kas belum dibereskan" terisi.
        select expected_cash into v_exp from reconcile_shift(v_shift, 0);

        v_diff := 0;
        if v_offset = 3 and k.id = v_harmoni then
          v_diff := -12;
        end if;
        if v_offset = 5 and k.id = v_sentosa then
          v_diff := 8;
        end if;

        update shifts set closing_cash = v_exp + v_diff where id = v_shift;
        perform reconcile_shift(v_shift, 0);

        update shifts
           set difference_status = case when v_diff <> 0 then 'terbuka' else 'dijelaskan' end,
               difference_note   = case
                                     when v_diff <> 0 then 'Perlu dicek pemilik'
                                     else 'Sudah dicek, selisih nol'
                                   end
         where id = v_shift;

        insert into notifikasi
          (kedai_id, shift_id, type, title, message, is_read, created_at)
        values
          (k.id, v_shift, 'shift_selesai', 'Toko ditutup',
           k.name || ' tutup tanggal ' || v_date || '. Setoran siap dicek.',
           v_offset > 2, v_close);

        if v_diff <> 0 then
          insert into notifikasi
            (kedai_id, shift_id, type, title, message, is_read, created_at)
          values
            (k.id, v_shift, 'selisih', 'Ada selisih kas',
             k.name || ' tanggal ' || v_date || ' punya selisih kas yang belum dibereskan.',
             false, v_close + interval '5 minutes');
        end if;
      end if;
    end loop;
  end loop;
end $$;

-- =====================================================================
-- PEMBATALAN (VOID) & KAS DI LACI — semuanya di hari terakhir
-- =====================================================================
do $$
declare
  v_owner   uuid;
  v_emp_h   uuid := 'a2000000-0000-4000-8000-000000000001';
  v_emp_s   uuid := 'a2000000-0000-4000-8000-000000000002';
  v_harmoni uuid := 'a1000000-0000-4000-8000-000000000001';
  v_sentosa uuid := 'a1000000-0000-4000-8000-000000000002';
  v_shift_h uuid;
  v_shift_s uuid;
  v_tx      uuid;
begin
  select id into v_owner from admin_users where email = 'owner@kedaidev.test';
  select id into v_shift_h from shifts where kedai_id = v_harmoni and status = 'open';
  select id into v_shift_s from shifts where kedai_id = v_sentosa and status = 'open';

  -- 1) Pengajuan yang MENUNGGU keputusan pemilik (kasir hari ini).
  select t.id into v_tx
  from transactions t
  where t.shift_id = v_shift_h and t.status = 'completed'
  order by t.created_at
  limit 1;

  if v_tx is not null then
    perform request_void(
      v_tx, v_harmoni, v_emp_h, 'Pelanggan salah pesan, minta tukar menu lain'
    );
    insert into notifikasi (kedai_id, shift_id, type, title, message, is_read, created_at)
    values (v_harmoni, v_shift_h, 'void_review', 'Pengajuan pembatalan',
            'Kasir Harmoni mengajukan pembatalan 1 transaksi. Menunggu keputusan.',
            false, now());
  end if;

  -- 2) Sudah DISETUJUI pemilik (stok dikembalikan) — untuk rasio void.
  select t.id into v_tx
  from transactions t
  join shifts s on s.id = t.shift_id
  where s.kedai_id = v_sentosa and s.status = 'closed' and t.status = 'completed'
  order by t.created_at
  limit 1;

  if v_tx is not null then
    insert into void_request
      (id, transaction_id, kedai_id, requested_by_employee_id, alasan, created_at)
    values
      ('a8000000-0000-4000-8000-000000000001', v_tx, v_sentosa, v_emp_s,
       'Pelanggan membatalkan pesanan sebelum disajikan', now() - interval '3 days');
    update transactions set status = 'perlu_review' where id = v_tx;
    perform decide_void(
      'a8000000-0000-4000-8000-000000000001', true, v_owner,
      'Disetujui, porsi dikembalikan ke dapur'
    );
  end if;

  -- 3) Sudah DITOLAK pemilik (transaksi tetap dicatat).
  select t.id into v_tx
  from transactions t
  join shifts s on s.id = t.shift_id
  where s.kedai_id = v_harmoni and s.status = 'closed' and t.status = 'completed'
  order by t.created_at
  limit 1;

  if v_tx is not null then
    insert into void_request
      (id, transaction_id, kedai_id, requested_by_employee_id, alasan, created_at)
    values
      ('a8000000-0000-4000-8000-000000000002', v_tx, v_harmoni, v_emp_h,
       'Ragu salah catat, minta dibatalkan', now() - interval '1 day');
    update transactions set status = 'perlu_review' where id = v_tx;
    perform decide_void(
      'a8000000-0000-4000-8000-000000000002', false, v_owner,
      'Transaksi sesuai catatan, tidak dibatalkan'
    );
  end if;

  -- 4) Stok rusak/buang hari ini (alasan wajib).
  perform record_waste(
    'a9000000-0000-4000-8000-000000000001', v_harmoni, v_shift_h,
    'a3000000-0000-4000-8000-000000000005', 2,
    'Tumpah saat disajikan ke pelanggan', v_emp_h
  );
  perform record_waste(
    'a9000000-0000-4000-8000-000000000002', v_sentosa, v_shift_s,
    'a3000000-0000-4000-8000-000000000019', 3,
    'Es cair, tidak layak dijual', v_emp_s
  );

  -- 5) Kas keluar yang diambil dari laci hari ini (mengurangi setoran).
  insert into expenses
    (kedai_id, category, description, amount, expense_date, shift_id,
     from_cash, recorded_by_employee_id)
  values
    (v_harmoni, 'bahan_baku', 'Beli es batu & minuman', 40,
     (now() at time zone 'Asia/Kuala_Lumpur')::date, v_shift_h, true, v_emp_h),
    (v_sentosa, 'lainnya', 'Bensin untuk belanja pasar', 25,
     (now() at time zone 'Asia/Kuala_Lumpur')::date, v_shift_s, true, v_emp_s);
end $$;

-- ------------------------------------------------------ pengeluaran umum
insert into expenses
  (kedai_id, category, description, amount, expense_date, from_cash, recorded_by_admin_id)
select k.id, e.category, e.description, e.amount,
       (now() at time zone 'Asia/Kuala_Lumpur')::date - e.hari_lalu,
       false,
       (select id from admin_users where email = 'owner@kedaidev.test')
from (values
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'sewa',     'Sewa gerai bulanan',   1200, 6),
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'listrik',  'Tagihan air & elektrik', 90, 4),
  ('a1000000-0000-4000-8000-000000000002'::uuid, 'lainnya',  'Gas memasak',            60, 3),
  ('a1000000-0000-4000-8000-000000000002'::uuid, 'bahan_baku', 'Belanja pasar mingguan', 250, 2),
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'gaji',     'Gaji karyawan mingguan', 800, 1)
) as e(kedai_id, category, description, amount, hari_lalu)
join kedai k on k.id = e.kedai_id;

-- ---------------------------------------------------------- notifikasi
insert into notifikasi (kedai_id, type, title, message, is_read, created_at) values
  ('a1000000-0000-4000-8000-000000000001', 'produksi',  'Produksi selesai', 'Batch nasi goreng & rendang dari dapur pusat sudah masuk gudang.', true,  now() - interval '4 days'),
  ('a1000000-0000-4000-8000-000000000002', 'assign',    'Stok dikirim',      'Mutasi stok masuk ke Kedai Nusantara Sentosa.', true, now() - interval '3 days'),
  ('a1000000-0000-4000-8000-000000000001', 'stock_low', 'Stok menipis',      'Ayam Geprek hampir habis di Kedai Nusantara Harmoni.', false, now() - interval '2 hours');

-- ------------------------------------------ koreksi akhir (stok menipis)
-- Sengaja menurunkan dua menu supaya badge "Menipis" / "Habis" muncul di
-- halaman Stok tanpa harus menunggu penjualan nyata.
do $$
declare
  v_owner uuid;
begin
  select id into v_owner from admin_users where email = 'owner@kedaidev.test';
  perform adjust_stock('a1000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000005', 4,
    'Stok opname: ayam geprek hampir habis', v_owner);
  perform adjust_stock('a1000000-0000-4000-8000-000000000002',
    'a3000000-0000-4000-8000-000000000018', 3,
    'Stok opname: kacang goreng hampir habis', v_owner);
end $$;
